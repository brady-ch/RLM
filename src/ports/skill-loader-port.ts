export interface SkillLoaderPort {
  name: string;
  load(): Promise<void>;
}
