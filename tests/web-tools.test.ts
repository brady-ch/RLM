import assert from "node:assert/strict";
import test from "node:test";
import {
  WebFetchTool,
  WebSearchTool,
  buildSearchQuery,
  parseUddgLines,
} from "../src/adapters/index.js";
import {
  analyzeHtmlContent,
  stripFluffWords,
  stripHtmlTags,
} from "../src/application/content-tree.js";

test("search query builder applies search operators", () => {
  const query = buildSearchQuery({
    terms: ["recursive language model"],
    exactPhrases: ["tool calling"],
    requiredTerms: ["benchmark"],
    excludedTerms: ["reddit"],
    siteFilters: ["arxiv.org"],
    fileType: "pdf",
    after: "2025-01-01",
    before: "2026-01-01",
  });

  assert.equal(
    query,
    'recursive language model "tool calling" +benchmark -reddit site:arxiv.org filetype:pdf after:2025-01-01 before:2026-01-01',
  );
});

test("parseUddgLines extracts title, link, and optional snippet", () => {
  const htmlLine = `<a class="result__a" href="https://duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2Fdocs">Official docs</a>`;
  assert.deepEqual(parseUddgLines(htmlLine), [
    {
      title: "Official docs",
      link: "https://example.com/docs",
      snippet: "",
    },
  ]);
});

test("web_search returns error when provider serves an interactive challenge", async () => {
  const tool = new WebSearchTool({
    runCurl: async () => '<html><div class="anomaly-modal__title">blocked</div></html>',
  });

  const result = await tool.execute({
    terms: ["test"],
  });

  assert.equal(result.status, "error");
  assert.match(result.output, /interactive challenge|automated access blocked/i);
});

test("web_search parses DuckDuckGo-style redirect HTML", async () => {
  let requestedUrl = "";
  const fixture = `<!DOCTYPE html><html><body>
<a class="result__a" href="https://duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2Fdocs">Official docs</a>
</body></html>`;

  const tool = new WebSearchTool({
    runCurl: async (url) => {
      requestedUrl = url;
      return fixture;
    },
  });

  const result = await tool.execute({
    exactPhrases: ["tool calling"],
    siteFilters: ["example.com"],
  });

  assert.equal(result.status, "success");
  const u = new URL(requestedUrl);
  assert.equal(u.searchParams.get("q"), '"tool calling" site:example.com');
  const output = JSON.parse(result.output);
  assert.equal(output.query, '"tool calling" site:example.com');
  assert.deepEqual(output.results, [
    {
      position: 1,
      title: "Official docs",
      link: "https://example.com/docs",
      snippet: "",
    },
  ]);
});

test("web_search falls back to raw HTML parsing when sed is unavailable", async () => {
  const fixture = `<!DOCTYPE html><html><body>
<a class="result__a" href="https://duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2Ffallback">Fallback docs</a>
</body></html>`;

  const tool = new WebSearchTool({
    sedPath: "definitely-missing-sed-binary",
    runCurl: async () => fixture,
  });

  const result = await tool.execute({
    terms: ["fallback"],
  });

  assert.equal(result.status, "success");
  const output = JSON.parse(result.output);
  assert.deepEqual(output.results, [
    {
      position: 1,
      title: "Fallback docs",
      link: "https://example.com/fallback",
      snippet: "",
    },
  ]);
});

test("content analysis strips html and fluff words into scored sections", () => {
  const html = `
    <html>
      <head><title>The Best Guide to Tool Calling</title><style>.x{}</style></head>
      <body>
        <h1>Tool Calling Architecture</h1>
        <p>This is the best practical guide for model tool calling systems.</p>
        <h2>Unrelated Notes</h2>
        <p>The weather and office lunch are not important.</p>
        <script>alert("ignore")</script>
      </body>
    </html>
  `;

  assert.equal(stripHtmlTags("<p>The useful text</p>"), "The useful text");
  assert.equal(stripFluffWords("The useful text is in the guide"), "useful text guide");
  const analysis = analyzeHtmlContent(html, "tool calling architecture", 1);

  assert.equal(analysis.title, "best guide tool calling");
  assert.equal(analysis.selected[0]?.title, "tool calling architecture");
  assert.match(analysis.selected[0]?.text ?? "", /practical guide model tool calling systems/);
});

test("web fetch tool returns selected content tree sections", async () => {
  const tool = new WebFetchTool({
    fetchFn: async () =>
      new Response(
        `
      <html>
        <head><title>Docs</title></head>
        <body>
          <h1>Install Tool Calling</h1>
          <p>Use bind tools with structured schemas for model calls.</p>
          <h1>Other</h1>
          <p>General unrelated content.</p>
        </body>
      </html>
    `,
        {
          status: 200,
          headers: {
            "content-type": "text/html",
          },
        },
      ),
  });

  const result = await tool.execute({
    url: "https://example.com/docs",
    query: "tool calling schemas",
    maxSections: 1,
  });

  assert.equal(result.status, "success");
  const output = JSON.parse(result.output);
  assert.equal(output.url, "https://example.com/docs");
  assert.equal(output.selected.length, 1);
  assert.equal(output.selected[0].title, "install tool calling");
});
