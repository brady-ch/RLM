/** Composition pipeline init stages in required order. */
export const COMPOSITION_INIT_ORDER = [
  "plugins",
  "interop",
  "tools-resolver",
  "agent-registry",
  "models",
] as const;

export type CompositionInitStage = (typeof COMPOSITION_INIT_ORDER)[number];

export type CompositionInitStageRecorder = (stage: CompositionInitStage) => void;
