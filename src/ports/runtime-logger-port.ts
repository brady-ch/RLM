export interface RuntimeLogger {
  log(event: RuntimeLogEvent): void;
}

export interface RuntimeLogEvent {
  stage: string;
  message: string;
  data?: Record<string, unknown> | undefined;
}
