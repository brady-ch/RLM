import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import { z } from "zod";
import { buildSearchQuery } from "./search-query.js";
import type { ToolExecutionResult, ToolPort } from "../../ports/tool-port.js";

const execFileAsync = promisify(execFile);

const searchSchema = z.object({
  rawQuery: z
    .string()
    .optional()
    .describe("Optional free-form query text combined with structured fields."),
  terms: z.array(z.string()).optional().describe("General search terms."),
  exactPhrases: z.array(z.string()).optional().describe("Phrases to wrap in quotes."),
  requiredTerms: z.array(z.string()).optional().describe("Terms to require with +term syntax."),
  excludedTerms: z.array(z.string()).optional().describe("Terms to exclude with -term syntax."),
  siteFilters: z.array(z.string()).optional().describe("Domains to restrict with site:domain."),
  fileType: z.string().optional().describe("File type to restrict with filetype:, such as pdf."),
  after: z
    .string()
    .optional()
    .describe("Lower date bound as YYYY-MM-DD, emitted as after:YYYY-MM-DD."),
  before: z
    .string()
    .optional()
    .describe("Upper date bound as YYYY-MM-DD, emitted as before:YYYY-MM-DD."),
  num: z
    .number()
    .int()
    .positive()
    .max(10)
    .optional()
    .describe("Number of results to return. Defaults to 5."),
});

/** DuckDuckGo Lite; HTML includes redirect links with uddg= target URLs when access is not blocked. */
const DDG_LITE_SEARCH = "https://lite.duckduckgo.com/lite/";

const ACCESS_BLOCKED_MARKER = "anomaly-modal__title";

export interface WebSearchToolOptions {
  defaultNum?: number;
  timeoutSeconds?: number;
  curlPath?: string;
  sedPath?: string;
  /** Test hook: skip curl and return fixed HTML. */
  runCurl?: (url: string) => Promise<string>;
}

export class WebSearchTool implements ToolPort {
  readonly name = "web_search";
  readonly description =
    "Search the public web via DuckDuckGo Lite (curl and sed). Use structured fields for phrases, required terms, exclusions, site filters, and date bounds, then open promising URLs with web_fetch.";
  readonly schema = searchSchema;

  private readonly defaultNum: number;
  private readonly timeoutSeconds: number;
  private readonly curlPath: string;
  private readonly sedPath: string;
  private readonly runCurl?: (url: string) => Promise<string>;

  constructor(options: WebSearchToolOptions = {}) {
    this.defaultNum = options.defaultNum ?? 5;
    this.timeoutSeconds = options.timeoutSeconds ?? 15;
    this.curlPath = options.curlPath ?? "curl";
    this.sedPath = options.sedPath ?? "sed";
    if (options.runCurl !== undefined) {
      this.runCurl = options.runCurl;
    }
  }

  async execute(args: Record<string, unknown>): Promise<ToolExecutionResult> {
    const parsed = searchSchema.safeParse(args);
    if (!parsed.success) {
      return {
        status: "error",
        output: `Invalid web_search arguments: ${parsed.error.message}`,
      };
    }

    const query = buildSearchQuery(parsed.data);
    if (!query) {
      return {
        status: "error",
        output: "Missing search query. Provide rawQuery, terms, exactPhrases, or filters.",
      };
    }

    const num = parsed.data.num ?? this.defaultNum;
    const targetUrl = new URL(DDG_LITE_SEARCH);
    targetUrl.searchParams.set("q", query);

    try {
      const html = this.runCurl
        ? await this.runCurl(targetUrl.toString())
        : await fetchHtmlWithCurl(targetUrl.toString(), this.curlPath, this.timeoutSeconds);

      if (html.includes(ACCESS_BLOCKED_MARKER)) {
        return {
          status: "error",
          output:
            "web_search received an interactive challenge page from the provider (automated access blocked). Retry from a normal browser session or network, or try again later.",
        };
      }

      const reduced = await filterHtmlForSearchResults(html, this.sedPath);
      const results = parseUddgLines(reduced)
        .slice(0, num)
        .map((row, index) => ({
          position: index + 1,
          title: row.title,
          link: row.link,
          snippet: row.snippet,
        }));

      return {
        status: "success",
        output: JSON.stringify({ query, results }),
      };
    } catch (error: unknown) {
      return {
        status: "error",
        output: error instanceof Error ? error.message : String(error),
      };
    }
  }
}

async function fetchHtmlWithCurl(
  url: string,
  curlPath: string,
  timeoutSeconds: number,
): Promise<string> {
  try {
    const { stdout } = await execFileAsync(
      curlPath,
      [
        "-sS",
        "-L",
        "--max-time",
        String(timeoutSeconds),
        "-A",
        "Mozilla/5.0 (compatible; RLM-web-search/1.0)",
        url,
      ],
      { maxBuffer: 4_000_000, encoding: "utf8" },
    );
    return stdout;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`curl failed: ${message}`);
  }
}

function filterHtmlWithSed(html: string, sedPath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const errChunks: Buffer[] = [];
    const child = spawn(sedPath, ["-n", "/uddg=/p"], { stdio: ["pipe", "pipe", "pipe"] });
    child.stderr.on("data", (chunk: Buffer) => errChunks.push(chunk));
    child.stdout.on("data", (chunk: Buffer) => chunks.push(chunk));
    child.on("error", (err) => reject(err));
    child.on("close", (code) => {
      if (code !== 0) {
        const detail = Buffer.concat(errChunks).toString("utf8").trim();
        reject(new Error(detail ? `sed exited ${code}: ${detail}` : `sed exited ${code}`));
        return;
      }
      resolve(Buffer.concat(chunks).toString("utf8"));
    });
    child.stdin.write(html, "utf8");
    child.stdin.end();
  });
}

async function filterHtmlForSearchResults(html: string, sedPath: string): Promise<string> {
  try {
    return await filterHtmlWithSed(html, sedPath);
  } catch {
    return html;
  }
}

interface UddgRow {
  title: string;
  link: string;
  snippet: string;
}

export function parseUddgLines(reduced: string): UddgRow[] {
  const out: UddgRow[] = [];
  const seen = new Set<string>();

  for (const line of reduced.split("\n")) {
    if (!line.includes("uddg=")) {
      continue;
    }

    const encodedMatch = /uddg=([^&"']+)/.exec(line);
    if (!encodedMatch || encodedMatch[1] === undefined) {
      continue;
    }

    const rawParam = encodedMatch[1].replaceAll("&amp;", "&");
    let link: string;
    try {
      link = decodeURIComponent(rawParam);
    } catch {
      continue;
    }

    if (!link.startsWith("http://") && !link.startsWith("https://")) {
      continue;
    }

    const titleMatch = />([^<]+)<\/a>/i.exec(line);
    const titleRaw = titleMatch?.[1];
    const title = titleRaw !== undefined ? stripTags(titleRaw.trim()) : link;

    if (seen.has(link)) {
      continue;
    }
    seen.add(link);

    const snippetMatch =
      /class="[^"]*result-snippet[^"]*"[^>]*>([^<]*)</i.exec(line) ??
      /class="[^"]*result__snippet[^"]*"[^>]*>([^<]*)</i.exec(line);
    const snippetRaw = snippetMatch?.[1];
    const snippet = snippetRaw !== undefined ? stripTags(snippetRaw.trim()).slice(0, 240) : "";

    out.push({ title, link, snippet });
  }

  return out;
}

function stripTags(s: string): string {
  return s
    .replaceAll(/<[^>]+>/g, " ")
    .replaceAll(/\s+/g, " ")
    .trim();
}
