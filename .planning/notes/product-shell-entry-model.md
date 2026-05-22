---
title: Product Shell Entry Model
date: 2026-05-22
context: "$gsd-explore product gaps — closing user stories for an agentic recursive language model graph workflow product"
---

# Product Shell Entry Model

## Intent

The product should feel like one coherent local-first application for advanced AI work:

1. Say what you want.
2. Generate an executable recursive node graph.
3. Inspect, edit, approve, and run that graph.
4. Reuse the result as a saved session or workflow.
5. Extend capabilities through plugins, model hosts, structured memory, and vector retrieval.

The core product promise is not "chat with an AI." It is "turn an intent into an inspectable, executable agentic graph."

## Recommended entry model

Use a three-surface product shell:

| Surface | Role | Primary use |
|---------|------|-------------|
| Guided composer | Default first-run and new-workflow entry | Capture intent, project/session context, model readiness, memory scopes, and plugin capability choices before graph generation |
| Graph workspace | Primary working surface | Inspect, edit, protect, approve, execute, and observe recursive graph workflows |
| Project/session launcher | Home and resume surface | Reopen saved sessions, graph workflows, recent projects, model/plugin status, and memory stores |

Default flow:

```text
Launch -> Guided composer -> Generated graph workspace -> Approve/run -> Save/reopen/export from launcher
```

After the user has saved sessions or graph workflows, the launcher becomes the home/resume screen, while "New workflow" still opens the guided composer.

## Design constraints

- The guided composer must create a graph, not a chat answer.
- The graph workspace remains the product identity and main interaction surface.
- Setup problems must be surfaced as recoverable product states: missing model, unavailable runner, disabled plugin, missing memory store, degraded vector index, invalid saved workflow.
- Plugins, tools, model hosts, memory scopes, and retrieval should be visible as capabilities the user can inspect and adjust, not hidden config-only behavior.
- First-run should not require YAML edits or terminal setup for the default path.
- Advanced controls should remain accessible without taking over the first-run experience.

## Product gaps this closes

- First-run coherence: the app can guide the user from blank state to graph generation without requiring documentation-first setup.
- Capability coherence: plugins, models, memory, and retrieval become visible parts of workflow creation rather than disconnected settings.
- Workflow coherence: generated graphs become durable work products that can be saved, reopened, edited, run, and exported.
- Trust coherence: failures and degraded states are explicit before or during graph execution, preserving the no-silent-failures rule.

## Relationship to current roadmap

- v1.5 should still finish graph safety, expert binding, graph execution, graph export/import, and UI/CLI parity.
- A later product-shell milestone should unify first-run/new-workflow composition, launcher/resume, plugin management, model readiness, and memory/retrieval status around the graph workflow.
- This note supersedes treating "launcher," "plugin manager," and "first-run onboarding" as unrelated features; they are one product-shell closure theme.
