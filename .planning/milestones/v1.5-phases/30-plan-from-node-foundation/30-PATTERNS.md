# Phase 30 — Pattern Map

**Mapped:** 2026-05-21

## Files to Create/Modify

| File | Role | Closest Analog |
|------|------|----------------|
| `src/application/graph-planner.ts` | NEW — model planner | `src/domain/recursive-language-model.ts` JSON parse + `src/application/agent-runner.ts` model call pattern |
| `src/application/execution-controller.ts` | planNode orchestration | Existing `planNode()` lines 319–398; `addNode()` for manual children |
| `src/application/control-server.ts` | API route | Existing `/api/nodes/:id/plan` handler lines 262–266 |
| `src/ports/language-model-port.ts` | Purpose enum | Existing `quality_loop_*` purposes |
| `src/application/project-config.ts` | Config validation | `MODEL_PURPOSES` array |
| `rlm.config.yaml` | plan tier | Existing `decompose: small` entries |
| `src/domain/types.ts` | Composer metadata | `NodeComposer.pendingPlan` block |
| `src/index.ts` | Wire model to session | UI session creation ~line 301 |
| `ui/src/main.tsx` | Node card + inspector | `NodeInspector` actions ~1280; `ExecutionNodeCard` ~692 |
| `ui/src/styles.css` | Focus/failure styles | Existing `.meta-row.warning`, `.budget-stop` |
| `tests/recursive-language-model.test.ts` | Plan tests | Lines 1761–1842 |

## Analog: MutationError pattern

From `execution-controller.ts`:

```typescript
class MutationError extends Error implements GraphMutationError {
  constructor(
    public readonly code: string,
    message: string,
    public readonly nodeIds: string[],
    public readonly details?: string,
    public readonly suggestedFix?: string,
  ) { /* ... */ }
}
```

New codes to add: `planning_failed`, `invalid_planner_output`. Reuse `invalid_prompt` for empty prompt.

## Analog: planNode child registration

From `execution-controller.ts` lines 349–372 — preserve this loop; only replace `childSpecs` source:

```typescript
for (const spec of childSpecs) {
  const id = `plan-${this.nodes.size + 1}`;
  const child: ExecutionGraphNode = {
    id, parentId: node.id, kind: "task",
    label: spec.label, prompt: spec.prompt,
    status: "planned", depth: node.depth + 1,
    composer: createComposer({ type: spec.type, /* ... */ }),
  };
  this.registerNode(child);
}
```

## Analog: PurposeRoutingLanguageModel.complete

From `model-provider.ts`:

```typescript
await model.complete(messages, { purpose: "plan", complexityDepth: node.depth });
```

## Analog: JSON extraction

From `recursive-language-model.ts` ~line 1951:

```typescript
return JSON.parse(value.slice(start, end + 1));
```

## Analog: control-server error mapping

From `control-server.ts` lines 449–461 — `toMutationError` already maps MutationError to 409 JSON.

## Analog: UI runAction + post

From `ui/src/main.tsx`:

```typescript
runAction(setErrorMessage, () => post(`/api/nodes/${node.id}/plan`, {}), refresh)
```

## Analog: Test session factory

```typescript
const session = createInteractiveExecutionSession({ seedRootPrompt: "..." });
const result = await session.planNode("root-composer");
```

Inject mock: extend factory with `{ planModel: mockModel }`.
