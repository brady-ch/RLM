export interface SearchQueryArgs {
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

export function buildSearchQuery(args: SearchQueryArgs): string {
  const parts = [
    clean(args.rawQuery),
    ...cleanList(args.terms),
    ...cleanList(args.exactPhrases).map((phrase) => `"${phrase.replaceAll('"', '\\"')}"`),
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

function cleanList(values: string[] | undefined): string[] {
  return values?.map(clean).filter((value): value is string => Boolean(value)) ?? [];
}

function clean(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}
