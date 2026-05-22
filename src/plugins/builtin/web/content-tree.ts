export interface ContentTreeNode {
  id: string;
  title: string;
  text: string;
  keywords: string[];
  score: number;
  children: ContentTreeNode[];
}

export interface ContentTreeResult {
  title: string;
  cleanedText: string;
  tree: ContentTreeNode[];
  selected: ContentTreeNode[];
}

const STOPWORDS = new Set([
  "a",
  "about",
  "above",
  "after",
  "again",
  "all",
  "also",
  "am",
  "an",
  "and",
  "any",
  "are",
  "as",
  "at",
  "be",
  "because",
  "been",
  "before",
  "being",
  "between",
  "but",
  "by",
  "can",
  "could",
  "did",
  "do",
  "does",
  "doing",
  "during",
  "each",
  "few",
  "for",
  "from",
  "further",
  "had",
  "has",
  "have",
  "having",
  "here",
  "how",
  "if",
  "in",
  "into",
  "is",
  "it",
  "its",
  "just",
  "more",
  "most",
  "of",
  "on",
  "once",
  "only",
  "or",
  "other",
  "our",
  "out",
  "over",
  "same",
  "should",
  "so",
  "some",
  "such",
  "than",
  "that",
  "the",
  "their",
  "then",
  "there",
  "these",
  "they",
  "this",
  "those",
  "through",
  "to",
  "too",
  "under",
  "until",
  "up",
  "very",
  "was",
  "we",
  "were",
  "what",
  "when",
  "where",
  "which",
  "while",
  "who",
  "why",
  "will",
  "with",
  "would",
  "you",
  "your",
]);

interface ParsedBlock {
  kind: "heading" | "text";
  level: number;
  text: string;
}

export function analyzeHtmlContent(html: string, query = "", maxSections = 5): ContentTreeResult {
  const title = decodeEntities(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "");
  const blocks = parseBlocks(html);
  const tree = buildTree(blocks);
  const queryTerms = tokenize(query);
  scoreNodes(tree, queryTerms);
  const selected = flattenNodes(tree)
    .filter((node) => node.text || node.title)
    .sort((left, right) => right.score - left.score)
    .slice(0, maxSections);

  return {
    title: stripFluffWords(title),
    cleanedText: stripFluffWords(stripHtmlTags(html)).slice(0, 20_000),
    tree,
    selected,
  };
}

export function stripHtmlTags(html: string): string {
  return decodeEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
  );
}

export function stripFluffWords(text: string): string {
  return tokenize(text).join(" ");
}

function parseBlocks(html: string): ParsedBlock[] {
  const body = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ");
  const blocks: ParsedBlock[] = [];
  const pattern = /<(h[1-6]|p|li|article|section)[^>]*>([\s\S]*?)<\/\1>/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(body)) !== null) {
    const tag = match[1]?.toLowerCase() ?? "p";
    const text = stripHtmlTags(match[2] ?? "");
    const stripped = stripFluffWords(text);
    if (!stripped) {
      continue;
    }

    blocks.push({
      kind: tag.startsWith("h") ? "heading" : "text",
      level: tag.startsWith("h") ? Number.parseInt(tag.slice(1), 10) : 7,
      text: stripped,
    });
  }

  if (blocks.length === 0) {
    const text = stripFluffWords(stripHtmlTags(html));
    if (text) {
      blocks.push({
        kind: "text",
        level: 7,
        text,
      });
    }
  }

  return blocks;
}

function buildTree(blocks: ParsedBlock[]): ContentTreeNode[] {
  const roots: ContentTreeNode[] = [];
  const stack: Array<{ level: number; node: ContentTreeNode }> = [];
  let orphanIndex = 1;

  for (const block of blocks) {
    if (block.kind === "heading") {
      const node = createNode(`section-${roots.length + stack.length + 1}`, block.text, "");
      while (stack.length > 0 && (stack.at(-1)?.level ?? 0) >= block.level) {
        stack.pop();
      }

      const parent = stack.at(-1)?.node;
      if (parent) {
        parent.children.push(node);
      } else {
        roots.push(node);
      }

      stack.push({
        level: block.level,
        node,
      });
      continue;
    }

    const target = stack.at(-1)?.node;
    if (target) {
      target.text = `${target.text} ${block.text}`.trim();
      target.keywords = unique([...target.keywords, ...tokenize(block.text)]);
    } else {
      roots.push(createNode(`intro-${orphanIndex}`, "intro", block.text));
      orphanIndex += 1;
    }
  }

  return roots;
}

function scoreNodes(nodes: ContentTreeNode[], queryTerms: string[]): void {
  for (const node of nodes) {
    const titleTokens = tokenize(node.title);
    const textTokens = tokenize(node.text);
    const titleHits = queryTerms.filter((term) => titleTokens.includes(term)).length;
    const textHits = queryTerms.filter((term) => textTokens.includes(term)).length;
    const density = textTokens.length > 0 ? textHits / textTokens.length : 0;
    const lengthScore = Math.min(textTokens.length / 120, 1);
    node.score = titleHits * 4 + textHits * 1.5 + density * 10 + lengthScore;
    scoreNodes(node.children, queryTerms);
    node.score += Math.max(0, ...node.children.map((child) => child.score * 0.35));
  }
}

function flattenNodes(nodes: ContentTreeNode[]): ContentTreeNode[] {
  return nodes.flatMap((node) => [node, ...flattenNodes(node.children)]);
}

function createNode(id: string, title: string, text: string): ContentTreeNode {
  return {
    id,
    title,
    text,
    keywords: unique([...tokenize(title), ...tokenize(text)]).slice(0, 20),
    score: 0,
    children: [],
  };
}

function tokenize(text: string): string[] {
  return decodeEntities(text)
    .toLowerCase()
    .replace(/[^a-z0-9+#.-]+/g, " ")
    .split(/\s+/)
    .map((word) => word.trim())
    .filter((word) => word.length > 1 && !STOPWORDS.has(word));
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function decodeEntities(value: string): string {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}
