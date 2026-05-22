/** @type {import('dependency-cruiser').IConfiguration} */
export default {
  forbidden: [
    {
      name: "no-domain-to-application",
      severity: "warn",
      comment: "Domain layer must not depend on application orchestration.",
      from: { path: "^src/domain" },
      to: { path: "^src/application" },
    },
    {
      name: "no-domain-to-adapters",
      severity: "warn",
      comment: "Domain layer must not depend on concrete adapters.",
      from: { path: "^src/domain" },
      to: { path: "^src/adapters" },
    },
    {
      name: "no-domain-to-cli",
      severity: "warn",
      comment: "Domain layer must not depend on CLI / I-O surface.",
      from: { path: "^src/domain" },
      to: { path: "^src/cli" },
    },
    {
      name: "no-ports-to-application",
      severity: "warn",
      comment: "Ports (interfaces) must not reference application implementations.",
      from: { path: "^src/ports" },
      to: { path: "^src/application" },
    },
    {
      name: "no-ports-to-adapters",
      severity: "warn",
      comment: "Ports must not reference adapter implementations.",
      from: { path: "^src/ports" },
      to: { path: "^src/adapters" },
    },
    {
      name: "no-ports-to-cli",
      severity: "warn",
      comment: "Ports must not reference CLI modules.",
      from: { path: "^src/ports" },
      to: { path: "^src/cli" },
    },
    {
      name: "no-adapters-to-application",
      severity: "warn",
      comment: "Adapters must implement ports/domain without importing application orchestration.",
      from: { path: "^src/adapters" },
      to: { path: "^src/application" },
    },
    {
      name: "no-adapters-to-cli",
      severity: "warn",
      comment: "Adapters must not depend on CLI.",
      from: { path: "^src/adapters" },
      to: { path: "^src/cli" },
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    tsPreCompilationDeps: true,
    includeOnly: "^src/",
    exclude: {
      path: "(^|/)dist(/|$)",
    },
  },
};
