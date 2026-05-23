import { useEffect } from "react";
import type { ModelLibraryEntry, ModelLibrarySnapshot } from "../shared/types";
import { ModelLibraryPanel } from "./models/ModelLibraryPanel";

export type ModelsViewProps = {
  library: ModelLibrarySnapshot | undefined;
  search: string;
  setSearch: (value: string) => void;
  searchResults: ModelLibraryEntry[];
  setSearchResults: (results: ModelLibraryEntry[]) => void;
  refresh: () => Promise<void>;
  setErrorMessage: (message: string | undefined) => void;
  onMount: () => void;
};

export function ModelsView(props: ModelsViewProps) {
  const { onMount, ...panelProps } = props;
  useEffect(() => {
    onMount();
  }, [onMount]);
  return <ModelLibraryPanel {...panelProps} />;
}
