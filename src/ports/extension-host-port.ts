import type { LanguageModelPort } from "./language-model-port.js";
import type { SkillLoaderPort } from "./skill-loader-port.js";
import type { ToolPort } from "./tool-port.js";

type NamedModelHost = LanguageModelPort & { name: string };

export interface ExtensionHostPort {
  readonly tools: {
    register(tool: ToolPort): void;
    get(name: string): ToolPort | undefined;
    all(): ToolPort[];
  };
  readonly skillLoaders: {
    register(loader: SkillLoaderPort): void;
    get(name: string): SkillLoaderPort | undefined;
  };
  readonly modelHosts: {
    register(adapter: NamedModelHost): void;
    get(name: string): LanguageModelPort | undefined;
  };
}
