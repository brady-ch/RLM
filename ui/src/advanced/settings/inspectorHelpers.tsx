import type { ExecutionNode, SamplingOptions } from "../../shared/types";
export function SamplingRows({
  sampling,
  override,
}: {
  sampling?: ExecutionNode["effectiveSampling"];
  override?: SamplingOptions;
}) {
  const values = sampling?.values ?? {};
  const sources = sampling?.sources ?? {};
  const keys = ["temperature", "topP", "maxTokens"] as const;
  if (!sampling && !override) {
    return <div className="meta-row">Effective values pending.</div>;
  }
  return (
    <div className="sampling-rows">
      {keys.map((key) => (
        <div className="meta-row" key={key}>
          {key}: {values[key] ?? override?.[key] ?? "unset"} (
          {sources[key] ?? (override?.[key] !== undefined ? "node" : "pending")})
        </div>
      ))}
      {(sampling?.warnings ?? []).map((warning) => (
        <div className="meta-row warning" key={warning}>
          {warning}
        </div>
      ))}
    </div>
  );
}

export function toInputValue(value: number | undefined): string {
  return value === undefined ? "" : String(value);
}

export function parseOptionalNumber(value: string): number | undefined {
  const trimmed = value.trim();
  return trimmed === "" ? undefined : Number(trimmed);
}

export function parseJsonObject(value: string): Record<string, string> {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return {};
  }
  const parsed = JSON.parse(trimmed) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Purpose tiers must be a JSON object.");
  }
  const normalized: Record<string, string> = {};
  for (const [key, raw] of Object.entries(parsed)) {
    if (typeof raw === "string" && raw.trim().length > 0) {
      normalized[key] = raw.trim();
    }
  }
  return normalized;
}

export function PortRows({
  title,
  ports,
}: {
  title: string;
  ports: NonNullable<ExecutionNode["composer"]>["inputs"];
}) {
  return (
    <div className="port-row-group">
      <span>{title}</span>
      {ports.map((port) => (
        <code key={port.id}>
          {port.label}: {port.artifactType}
        </code>
      ))}
    </div>
  );
}

export function PolicyRows({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="policy-row">
      <span>{title}</span>
      <p>{items.join(", ")}</p>
    </div>
  );
}
