export function AdvancedLoadingFallback({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="advanced-loading" data-testid="advanced-loading" aria-busy="true">
      <p>{label}</p>
    </div>
  );
}
