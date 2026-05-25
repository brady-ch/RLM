import { useCallback, useEffect, useState } from "react";
import type { ModelLibraryEntry, ModelLibrarySnapshot } from "../shared/types";
import { ModelLibraryPanel } from "./models/ModelLibraryPanel";

export function ModelsView({
  setErrorMessage,
}: {
  setErrorMessage: (message: string | undefined) => void;
}) {
  const [library, setLibrary] = useState<ModelLibrarySnapshot | undefined>();
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<ModelLibraryEntry[]>([]);

  const refresh = useCallback(async () => {
    const response = await fetch("/api/model-library");
    if (!response.ok) {
      return;
    }
    setLibrary((await response.json()) as ModelLibrarySnapshot);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <ModelLibraryPanel
      library={library}
      search={search}
      setSearch={setSearch}
      searchResults={searchResults}
      setSearchResults={setSearchResults}
      refresh={refresh}
      setErrorMessage={setErrorMessage}
    />
  );
}
