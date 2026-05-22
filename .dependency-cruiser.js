/** @type {import('dependency-cruiser').IConfiguration} */
export default {
  forbidden: [
    {
      name: "no-domain-to-application",
      severity: "error",
      comment:
        "Domain layer must not depend on application orchestration (AGENTS.md concern map).",
      from: { path: "^src/domain" },
      to: { path: "^src/application" },
    },
    {
      name: "no-domain-to-adapters",
      severity: "error",
      comment:
        "Domain layer must not depend on concrete adapters (AGENTS.md concern map).",
      from: { path: "^src/domain" },
      to: { path: "^src/adapters" },
    },
    {
      name: "no-domain-to-cli",
      severity: "error",
      comment:
        "Domain layer must not depend on CLI / I-O surface (AGENTS.md concern map).",
      from: { path: "^src/domain" },
      to: { path: "^src/cli" },
    },
    {
      name: "no-ports-to-application",
      severity: "error",
      comment:
        "Ports (interfaces) must not reference application implementations (AGENTS.md concern map).",
      from: { path: "^src/ports" },
      to: { path: "^src/application" },
    },
    {
      name: "no-ports-to-adapters",
      severity: "error",
      comment:
        "Ports must not reference adapter implementations (AGENTS.md concern map).",
      from: { path: "^src/ports" },
      to: { path: "^src/adapters" },
    },
    {
      name: "no-ports-to-cli",
      severity: "error",
      comment:
        "Ports must not reference CLI modules (AGENTS.md concern map).",
      from: { path: "^src/ports" },
      to: { path: "^src/cli" },
    },
    {
      name: "no-adapters-to-application",
      severity: "error",
      comment:
        "Adapters must implement ports/domain without importing application orchestration (AGENTS.md concern map).",
      from: { path: "^src/adapters" },
      to: { path: "^src/application" },
    },
    {
      name: "no-adapters-to-cli",
      severity: "error",
      comment:
        "Adapters must not depend on CLI (AGENTS.md concern map).",
      from: { path: "^src/adapters" },
      to: { path: "^src/cli" },
    },
    {
      name: "no-plugins-to-application",
      severity: "error",
      comment:
        "Plugins register through ExtensionHostPort, not application orchestration (AGENTS.md concern map).",
      from: { path: "^src/plugins" },
      to: { path: "^src/application" },
    },
    {
      name: "no-plugins-to-cli",
      severity: "error",
      comment:
        "Plugins must not import CLI modules (AGENTS.md concern map).",
      from: { path: "^src/plugins" },
      to: { path: "^src/cli" },
    },
    {
      name: "no-plugins-to-domain",
      severity: "error",
      comment:
        "Plugins register tools; domain recursion policy stays separate (AGENTS.md concern map).",
      from: { path: "^src/plugins" },
      to: { path: "^src/domain" },
    },
    {
      name: "no-runtime-to-cli",
      severity: "error",
      comment:
        "Runtime composition/interop stays below CLI; inject CLI helpers at bootstrap (AGENTS.md concern map).",
      from: { path: "^src/runtime" },
      to: { path: "^src/cli" },
    },
    {
      name: "no-builtin-plugin-to-external-loader",
      severity: "error",
      comment:
        "Built-in plugins must not depend on external install machinery (AGENTS.md concern map).",
      from: { path: "^src/plugins/builtin" },
      to: { path: "^src/plugins/external" },
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    tsPreCompilationDeps: true,
    includeOnly: "^src/",
    exclude: {
      path: "(^|/)dist(/|$)|/plugins/__depcruise-fixtures__/",
    },
  },
};
