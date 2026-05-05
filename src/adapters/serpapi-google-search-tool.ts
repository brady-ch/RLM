import { z } from "zod";
import type { ToolExecutionResult, ToolPort } from "../ports/tool-port.js";

const searchSchema = z.object({
  rawQuery: z.string().optional().describe("Optional free-form Google query to combine with structured fields."),
  terms: z.array(z.string()).optional().describe("General search terms."),
  exactPhrases: z.array(z.string()).optional().describe("Phrases to wrap in quotes."),
  requiredTerms: z.array(z.string()).optional().describe("Terms to require with +term syntax."),
  excludedTerms: z.array(z.string()).optional().describe("Terms to exclude with -term syntax."),
  siteFilters: z.array(z.string()).optional().describe("Domains to restrict with site:domain."),
  fileType: z.string().optional().describe("File type to restrict with filetype:, such as pdf."),
  after: z.string().optional().describe("Lower date bound as YYYY-MM-DD, emitted as after:YYYY-MM-DD."),
  before: z.string().optional().describe("Upper date bound as YYYY-MM-DD, emitted as before:YYYY-MM-DD."),
  num: z.number().int().positive().max(10).optional().describe("Number of organic results to return. Defaults to 5."),
});

export interface SerpApiGoogleSearchToolOptions {
  apiKey?: string;
  fetchFn?: typeof fetch;
  defaultNum?: number;
  gl?: string;
  hl?: string;
}

export class SerpApiGoogleSearchTool implements ToolPort {
  readonly name = "google_search";
  readonly description =
    "Search Google via SerpAPI. Prefer structured fields for exact phrases, required terms, exclusions, site filters, and date bounds.";
  readonly schema = searchSchema;

  private readonly apiKey: string | undefined;
  private readonly fetchFn: typeof fetch;
  private readonly defaultNum: number;
  private readonly gl: string;
  private readonly hl: string;

  constructor(options: SerpApiGoogleSearchToolOptions = {}) {
    this.apiKey = options.apiKey ?? process.env.SERPAPI_API_KEY;
    this.fetchFn = options.fetchFn ?? fetch;
    this.defaultNum = options.defaultNum ?? 5;
    this.gl = options.gl ?? "us";
    this.hl = options.hl ?? "en";
  }

  async execute(args: Record<string, unknown>): Promise<ToolExecutionResult> {
    const parsed = searchSchema.safeParse(args);
    if (!parsed.success) {
      return {
        status: "error",
        output: `Invalid google_search arguments: ${parsed.error.message}`,
      };
    }

    if (!this.apiKey) {
      return {
        status: "error",
        output: "Missing SERPAPI_API_KEY for google_search.",
      };
    }

    const query = buildGoogleQuery(parsed.data);
    if (!query) {
      return {
        status: "error",
        output: "Missing search query. Provide rawQuery, terms, exactPhrases, or filters.",
      };
    }

    const url = new URL("https://serpapi.com/search");
    url.searchParams.set("engine", "google");
    url.searchParams.set("q", query);
    url.searchParams.set("api_key", this.apiKey);
    url.searchParams.set("hl", this.hl);
    url.searchParams.set("gl", this.gl);
    url.searchParams.set("num", String(parsed.data.num ?? this.defaultNum));
    url.searchParams.set("output", "json");

    try {
      const response = await this.fetchFn(url);
      const body = await response.json() as SerpApiResponse;
      if (!response.ok || body.error) {
        return {
          status: "error",
          output: body.error ?? `SerpAPI request failed with HTTP ${response.status}.`,
        };
      }

      return {
        status: "success",
        output: JSON.stringify({
          query,
          results: normalizeOrganicResults(body.organic_results ?? []),
        }),
      };
    } catch (error: unknown) {
      return {
        status: "error",
        output: error instanceof Error ? error.message : String(error),
      };
    }
  }
}

interface SearchArgs {
  rawQuery?: string | undefined;
  terms?: string[] | undefined;
  exactPhrases?: string[] | undefined;
  requiredTerms?: string[] | undefined;
  excludedTerms?: string[] | undefined;
  siteFilters?: string[] | undefined;
  fileType?: string | undefined;
  after?: string | undefined;
  before?: string | undefined;
}

interface SerpApiResponse {
  error?: string;
  organic_results?: SerpApiOrganicResult[];
}

interface SerpApiOrganicResult {
  position?: number;
  title?: string;
  link?: string;
  displayed_link?: string;
  snippet?: string;
  date?: string;
}

export function buildGoogleQuery(args: SearchArgs): string {
  const parts = [
    clean(args.rawQuery),
    ...cleanList(args.terms),
    ...cleanList(args.exactPhrases).map((phrase) => `"${phrase.replaceAll("\"", "\\\"")}"`),
    ...cleanList(args.requiredTerms).map((term) => `+${term}`),
    ...cleanList(args.excludedTerms).map((term) => `-${term}`),
    ...cleanList(args.siteFilters).map((site) => `site:${site}`),
  ];

  const fileType = clean(args.fileType);
  if (fileType) {
    parts.push(`filetype:${fileType}`);
  }

  const after = clean(args.after);
  if (after) {
    parts.push(`after:${after}`);
  }

  const before = clean(args.before);
  if (before) {
    parts.push(`before:${before}`);
  }

  return parts.filter(Boolean).join(" ").trim();
}

function normalizeOrganicResults(results: SerpApiOrganicResult[]): Array<Record<string, unknown>> {
  return results.map((result) => ({
    position: result.position,
    title: result.title ?? "",
    link: result.link ?? "",
    displayedLink: result.displayed_link ?? "",
    snippet: result.snippet ?? "",
    date: result.date,
  }));
}

function cleanList(values: string[] | undefined): string[] {
  return values?.map(clean).filter((value): value is string => Boolean(value)) ?? [];
}

function clean(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}
