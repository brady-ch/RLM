/** Probe config for meta-tests — same forbidden arcs as production without fixture exclusions. */
/** @type {import('dependency-cruiser').IConfiguration} */
export default {
  forbidden: [
    {
      name: "no-plugins-to-application",
      severity: "error",
      comment:
        "Plugins register through ExtensionHostPort, not application orchestration (AGENTS.md concern map).",
      from: { path: "^src/plugins" },
      to: { path: "^src/application" },
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
