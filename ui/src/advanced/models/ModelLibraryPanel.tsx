import React from "react";
import { Download, RefreshCw, Search } from "lucide-react";
import type { ModelLibraryEntry, ModelLibrarySnapshot } from "../../shared/types";
import { post, runAction } from "../../shared/api";
export function tierModelOptions(library?: ModelLibrarySnapshot): string[] {
  const ids = new Set<string>();
  for (const entry of library?.installed ?? []) {
    if (entry.status === "installed" && entry.ollamaModel) {
      ids.add(entry.ollamaModel);
    }
  }
  for (const entry of library?.curated ?? []) {
    if (entry.status === "installed" && entry.ollamaModel) {
      ids.add(entry.ollamaModel);
    }
  }
  return [...ids].sort((a, b) => a.localeCompare(b));
}

export function ModelLibraryPanel({
  library,
  search,
  setSearch,
  searchResults,
  setSearchResults,
  refresh,
  setErrorMessage,
}: {
  library?: ModelLibrarySnapshot;
  search: string;
  setSearch: (value: string) => void;
  searchResults: ModelLibraryEntry[];
  setSearchResults: (value: ModelLibraryEntry[]) => void;
  refresh: () => Promise<void>;
  setErrorMessage: (message: string | undefined) => void;
}) {
  const tierEntries = Object.entries(library?.tiers ?? {});
  const assignableModels = tierModelOptions(library);
  return (
    <div className="model-library-panel">
      <div className="panel-heading">
        <label>Model Library</label>
        <button
          className="icon"
          title="Refresh models"
          onClick={() => runAction(setErrorMessage, refresh, refresh)}
        >
          <RefreshCw size={16} />
        </button>
      </div>
      <div className="model-search">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search Hugging Face"
        />
        <button
          disabled={search.trim().length === 0}
          onClick={() =>
            runAction(
              setErrorMessage,
              async () => {
                const response = await fetch(
                  `/api/model-library/search?q=${encodeURIComponent(search)}`,
                );
                if (!response.ok) {
                  throw new Error(await response.text());
                }
                const payload = (await response.json()) as { results: ModelLibraryEntry[] };
                setSearchResults(payload.results);
              },
              refresh,
            )
          }
        >
          <Search size={16} /> Search
        </button>
      </div>
      <div className="tier-grid">
        {tierEntries.map(([tier, model]) => (
          <label className="tier-row" key={tier}>
            <span className="tier-label">{tier}</span>
            <select
              aria-label={`Assign ${tier} tier model`}
              value={model}
              disabled={!library || assignableModels.length === 0}
              onChange={(event) => {
                const next = event.target.value;
                if (!next || next === model) {
                  return;
                }
                void runAction(
                  setErrorMessage,
                  () =>
                    post("/api/model-library/select-tier", {
                      tier,
                      model: next,
                    }),
                  refresh,
                );
              }}
            >
              {assignableModels.map((id) => (
                <option key={id} value={id}>
                  {id}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
      <div className="model-list">
        {(library?.curated ?? []).map((entry) => (
          <ModelLibraryRow
            key={entry.id}
            entry={entry}
            library={library}
            refresh={refresh}
            setErrorMessage={setErrorMessage}
          />
        ))}
      </div>
      {searchResults.length > 0 ? (
        <div className="model-list">
          <label>Hugging Face Results</label>
          {searchResults.map((entry) => (
            <ModelLibraryRow
              key={entry.id}
              entry={entry}
              library={library}
              refresh={refresh}
              setErrorMessage={setErrorMessage}
            />
          ))}
        </div>
      ) : null}
      {(library?.jobs ?? []).map((job) => (
        <div className={`meta-row model-job ${job.status}`} key={job.id}>
          {job.model}: {job.status} {Math.round(job.progress * 100)}% - {job.message}
        </div>
      ))}
    </div>
  );
}

export function ModelLibraryRow({
  entry,
  library,
  refresh,
  setErrorMessage,
}: {
  entry: ModelLibraryEntry;
  library?: ModelLibrarySnapshot;
  refresh: () => Promise<void>;
  setErrorMessage: (message: string | undefined) => void;
}) {
  const selectableModel = entry.ollamaModel ?? entry.id;
  const installEnabled =
    (entry.source === "curated" || entry.source === "huggingface") &&
    entry.status !== "installed" &&
    entry.status !== "installing" &&
    entry.status !== "unsupported";
  const onInstall = () => {
    if (entry.source === "huggingface") {
      return post("/api/model-library/download", { model: entry.id });
    }
    return post("/api/model-library/install", { model: selectableModel });
  };
  return (
    <div className={`model-row ${entry.status}`}>
      <div>
        <b>{entry.label}</b>
        <p>{entry.description}</p>
        <div className="tag-row">
          {entry.tags.slice(0, 4).map((tag) => (
            <span key={tag}>{tag}</span>
          ))}
        </div>
        {entry.reason ? <div className="meta-row warning">{entry.reason}</div> : null}
      </div>
      <div className="actions model-actions">
        <button
          disabled={!installEnabled}
          onClick={() => runAction(setErrorMessage, onInstall, refresh)}
        >
          <Download size={16} /> Install
        </button>
        <select
          disabled={entry.status !== "installed" || !library}
          onChange={(event) => {
            if (!event.target.value) {
              return;
            }
            void runAction(
              setErrorMessage,
              () =>
                post("/api/model-library/select-tier", {
                  tier: event.target.value,
                  model: selectableModel,
                }),
              refresh,
            );
            event.target.value = "";
          }}
          defaultValue=""
        >
          <option value="">Assign tier</option>
          {Object.keys(library?.tiers ?? {}).map((tier) => (
            <option key={tier} value={tier}>
              {tier}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
