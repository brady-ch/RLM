# Conventions and Coding Patterns

## Snapshot
- Date: 2026-05-08
- Language profile: strict TypeScript with ESM and explicit interfaces.

## TypeScript Conventions
- Strict compile settings enabled (`strict`, `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`).
- Module style uses ESM with `.js` import specifiers from TS source (NodeNext convention).
- Strong typing via domain and port interfaces, especially in `src/ports/` and `src/domain/types.ts`.

## Architectural Conventions
- Ports/adapters boundary is explicit and consistently named.
- Domain logic avoids direct infra coupling and relies on injected ports.
- Composition happens primarily in `src/index.ts`.

## Error Handling Patterns
- Adapter/tool execution returns structured success/error outputs rather than throwing in many paths.
- Workflow command execution captures stdout/stderr and wraps failures into structured responses.
- Hard validation is applied through `zod` schemas in tool adapters.

## Configuration Conventions
- Runtime and behavior are YAML-driven (`rlm.config.yaml`).
- CLI flags can override config defaults.
- Model tier routing is centralized in model-provider/project-config modules.

## Logging and Trace Patterns
- Runtime logger abstraction via `src/ports/runtime-logger-port.ts`.
- Execution graph/status events emitted through execution control components.

## Naming Patterns
- Files generally use kebab-case names.
- Classes and interfaces use PascalCase.
- Domain constants and config identifiers use clear, descriptive names.

## Documentation Conventions
- README gives architecture + operational contract.
- AGENTS.md documents folder responsibilities and extension points.

## Observed Gaps
- No dedicated linter/formatter scripts declared in `package.json`.
- Style enforcement appears convention-based rather than tool-enforced.
