import { z } from "zod";
import { analyzeHtmlContent } from "./content-tree.js";
import type { ToolExecutionResult, ToolPort } from "../../ports/tool-port.js";

const webFetchSchema = z.object({
  url: z.string().url().describe("HTTP or HTTPS URL to fetch and analyze."),
  query: z
    .string()
    .optional()
    .describe("Research question or keyword query used to score page sections."),
  maxSections: z
    .number()
    .int()
    .positive()
    .max(10)
    .optional()
    .describe("Maximum selected content sections to return. Defaults to 5."),
});

export interface WebFetchToolOptions {
  fetchFn?: typeof fetch;
  timeoutMs?: number;
}

export class WebFetchTool implements ToolPort {
  readonly name = "web_fetch";
  readonly description =
    "Fetch a web page, strip HTML and fluff words, build a content tree, and return the highest-scoring sections for a query.";
  readonly schema = webFetchSchema;

  private readonly fetchFn: typeof fetch;
  private readonly timeoutMs: number;

  constructor(options: WebFetchToolOptions = {}) {
    this.fetchFn = options.fetchFn ?? fetch;
    this.timeoutMs = options.timeoutMs ?? 10_000;
  }

  async execute(args: Record<string, unknown>): Promise<ToolExecutionResult> {
    const parsed = webFetchSchema.safeParse(args);
    if (!parsed.success) {
      return {
        status: "error",
        output: `Invalid web_fetch arguments: ${parsed.error.message}`,
      };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchFn(parsed.data.url, {
        signal: controller.signal,
        headers: {
          "user-agent": "recursive-language-model/1.0",
          accept: "text/html,text/plain,application/xhtml+xml",
        },
      });
      const contentType = response.headers.get("content-type") ?? "";
      if (!response.ok) {
        return {
          status: "error",
          output: `web_fetch failed with HTTP ${response.status}.`,
        };
      }

      if (!/text\/html|text\/plain|application\/xhtml\+xml/i.test(contentType)) {
        return {
          status: "error",
          output: `web_fetch only supports HTML or plain text responses. Received: ${contentType || "unknown"}`,
        };
      }

      const html = await response.text();
      const analysis = analyzeHtmlContent(
        html,
        parsed.data.query ?? "",
        parsed.data.maxSections ?? 5,
      );
      return {
        status: "success",
        output: JSON.stringify({
          url: parsed.data.url,
          title: analysis.title,
          selected: analysis.selected,
          tree: analysis.tree,
        }),
      };
    } catch (error: unknown) {
      return {
        status: "error",
        output: error instanceof Error ? error.message : String(error),
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}
