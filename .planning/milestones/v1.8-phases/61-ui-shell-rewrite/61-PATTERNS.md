# Phase 61: UI Shell Rewrite - Pattern Map

**Mapped:** 2026-05-22  
**Files analyzed:** 18 new/modified  
**Analogs found:** 15 / 18

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `ui/src/main.tsx` | entry | bootstrap | `ui/src/main.tsx` (current tail) | exact |
| `ui/src/shared/types.ts` | model | transform | `ui/src/main.tsx` lines 35–485 | exact |
| `ui/src/shared/graph-utils.ts` | utility | transform | `ui/src/main.tsx` lines 491–513 | exact |
| `ui/src/shared/api.ts` | utility | request-response | `ui/src/main.tsx` lines 2964–3046 | exact |
| `ui/src/shared/tokens.css` | config | — | `ui/src/styles.css` lines 1–28 | exact |
| `ui/src/styles.css` | config | — | `ui/src/styles.css` (element rules) | exact |
| `ui/src/app/AppShell.tsx` | provider | event-driven | `ui/src/main.tsx` `App()` lines 515–1017 | exact |
| `ui/src/app/TopBar.tsx` | component | request-response | `ui/src/main.tsx` inspector `<header>` lines 798–876 | exact |
| `ui/src/canvas/GraphCanvas.tsx` | component | event-driven | `ui/src/main.tsx` ReactFlow block lines 771–795 + handlers 696–767 | exact |
| `ui/src/nodes/ExecutionNodeCard.tsx` | component | CRUD | `ui/src/main.tsx` `ExecutionNodeCard` lines 1019–1238 | exact |
| `ui/src/nodes/NodeContextMenu.tsx` | component | request-response | `.planning/sketches/002-context-menu-node-editing/index.html` | partial (sketch) |
| `ui/src/nodes/QualityLoopCardSummary.tsx` | component | transform | `ui/src/main.tsx` `QualityLoopCardSummary` lines 2246–2272 | exact |
| `ui/src/run-panel/RunPanel.tsx` | component | request-response | `ui/src/main.tsx` clarification block lines 938–1013 + approve lines 2696–2718 | role-match |
| `ui/src/advanced/AdvancedHub.tsx` | component | request-response | `.planning/sketches/001-workflow-advanced-shell/index.html` variant C lines 184–243 | partial (sketch) |
| `ui/src/advanced/ModelsView.tsx` | component | CRUD | `ui/src/main.tsx` `ModelLibraryPanel` lines 1813–1982 | exact |
| `ui/src/advanced/PluginsView.tsx` | component | CRUD | `ui/src/main.tsx` `PluginPanel` lines 1994–2168 (Phase 51) | exact |
| `ui/src/advanced/SessionsView.tsx` | component | CRUD | `ui/src/main.tsx` `SavedSessionPanel` lines 1547–1683 | exact |
| `ui/src/advanced/MemoryView.tsx` | component | CRUD | `ui/src/main.tsx` `MemoryPanel` lines 1685–1811 | exact |
| `ui/src/advanced/SettingsView.tsx` | component | CRUD | `NodeInspector` + `RefineGraphPanel` + `GraphWorkflowPanel` + `QualityLoopInspector` | role-match |
| `ui/src/app/hooks/useSession.ts` (recommended) | hook | event-driven | `ui/src/main.tsx` `App()` refresh + SSE lines 567–649 | role-match |

## Extraction Inventory from `main.tsx`

### Components to relocate (verbatim logic first, then trim per UI-SPEC)

| Symbol | Current lines | Target |
|--------|---------------|--------|
| `App` | 515–1017 | `AppShell.tsx` (+ thin `main.tsx` entry) |
| `ExecutionNodeCard` | 1019–1238 | `nodes/ExecutionNodeCard.tsx` |
| `QualityLoopCardSummary` | 2246–2272 | `nodes/QualityLoopCardSummary.tsx` |
| `RefineGraphPanel` | 1241–1343 | `advanced/SettingsView.tsx` |
| `GraphWorkflowPanel` | 1345–1545 | `advanced/SettingsView.tsx` |
| `SavedSessionPanel` | 1547–1683 | `advanced/SessionsView.tsx` |
| `MemoryPanel` | 1685–1811 | `advanced/MemoryView.tsx` |
| `ModelLibraryPanel` + `ModelLibraryRow` | 1813–1982 | `advanced/ModelsView.tsx` |
| `PluginPanel` + `PluginRow` | 1994–2244 | `advanced/PluginsView.tsx` |
| `NodeInspector` | 2331–2778 | Split: card stays on canvas; overrides → `SettingsView.tsx` |
| `QualityLoopInspector` | 2780–2934 | `advanced/SettingsView.tsx` |
| `PortRows`, `PolicyRows`, `SamplingRows` | 2274–2302, 2936–2962 | `advanced/SettingsView.tsx` helpers |

### API endpoints (frozen contract — do not rename paths)

| Concern | Methods | Source in `App()` |
|---------|---------|-------------------|
| Session + SSE | `GET /api/session`, `EventSource /api/events` | lines 567–573, 631–641 |
| Run control | `POST /api/chat/confirm-run`, `/api/stop`, `/api/pause-future-auto-approvals` | lines 833–871 |
| Graph layout | `POST /api/graph/layout`, `/api/graph/viewport` | lines 707–764 |
| Node mutations | `POST /api/nodes/:id/*`, `/api/nodes/add` | card, inspector, context menu |
| Clarification | `POST /api/clarifications/answer`, `/api/clarifications/abort` | lines 966–994 |
| Models | `GET /api/model-library`, search, install, select-tier | lines 575–581, 1855–1862 |
| Plugins | `GET/POST /api/plugins/*` | lines 609–622, PluginPanel |
| Sessions | `GET/POST /api/saved-sessions/*` | SavedSessionPanel |
| Memory | `GET /api/memory`, preferences CRUD | MemoryPanel |
| Workflows | `GET/POST /api/graph-workflows/*` | GraphWorkflowPanel |

### State to centralize (AppShell or `useSession`)

```typescript
// From App() — ui/src/main.tsx lines 516–555
const [snapshot, setSnapshot] = useState<SessionSnapshot>({ ... });
const [nodes, setNodes] = useState<Node<FlowNodeData>[]>([]);
const [edges, setEdges] = useState<Edge[]>([]);
const [selectedNodeId, setSelectedNodeId] = useState<string | undefined>();
const [errorMessage, setErrorMessage] = useState<string | undefined>();
const [planningNodeId, setPlanningNodeId] = useState<string | undefined>();
const [planningError, setPlanningError] = useState<{ nodeId: string; message: string } | undefined>();
const [clarificationAnswer, setClarificationAnswer] = useState("");
// Advanced-only (fetch on sub-tab mount, not on workflow mount):
const [modelLibrary, setModelLibrary] = useState<ModelLibrarySnapshot | undefined>();
const [pluginSnapshot, setPluginSnapshot] = useState<PluginSnapshot>({ plugins: [] });
// ... savedSessions, memory, graphWorkflows, etc.
```

---

## Pattern Assignments

### `ui/src/shared/types.ts` (model, transform)

**Analog:** `ui/src/main.tsx` lines 35–485

**Type block pattern** (lines 35–44, 142–237):

```typescript
type ExecutionStatus =
  | "planned"
  | "ready"
  | "awaiting_approval"
  | "approved"
  | "running"
  | "completed"
  | "skipped"
  | "failed"
  | "cancelled";

type ExecutionNode = {
  id: string;
  parentId?: string;
  position?: { x: number; y: number };
  kind: "task" | "workflow-agent" | "workflow-qa" | "quality-loop";
  composer?: { /* ... */ };
  label: string;
  prompt?: string;
  status: ExecutionStatus;
  loop?: QualityLoopMetadata;
  // expert/sampling fields unchanged
};

type SessionSnapshot = {
  graph: ExecutionGraph;
  status: ExecutionStatus;
  activeNodeId?: string;
  chat?: { readiness; pendingClarification; /* ... */ };
};
```

**FlowNodeData pattern** (lines 473–485):

```typescript
type FlowNodeData = {
  execution: ExecutionNode;
  activeNodeId?: string | undefined;
  runSummaryMessage?: string | undefined;
  refresh?: () => Promise<void>;
  setErrorMessage?: (message: string | undefined) => void;
  planningNodeId?: string | undefined;
  setPlanningNodeId?: (nodeId: string | undefined) => void;
  planningErrorNodeId?: string | undefined;
  planningErrorMessage?: string | undefined;
  setPlanningError?: (error: { nodeId: string; message: string } | undefined) => void;
  onlyRoot?: boolean | undefined;
};
```

**Labels constant** (lines 461–471):

```typescript
const uiRunStatusLabels: Record<ExecutionStatus, string> = {
  planned: "Planned",
  ready: "Ready",
  awaiting_approval: "Awaiting approval",
  // ...
};
```

Export all types; move labels to `shared/labels.ts` if types file grows large.

---

### `ui/src/shared/graph-utils.ts` (utility, transform)

**Analog:** `ui/src/main.tsx` lines 487–513

```typescript
const nodeTypes = {
  execution: ExecutionNodeCard,
};

function executionToFlowNode(
  node: ExecutionNode,
  index: number,
  data: Omit<FlowNodeData, "execution"> = {},
): Node<FlowNodeData> {
  return {
    id: node.id,
    type: "execution",
    position: node.position ?? { x: node.depth * 430, y: index * 245 },
    data: { execution: node, ...data },
  };
}

function graphToFlowEdges(edges: ExecutionGraph["edges"]): Edge[] {
  return edges.map((edge, i) => ({
    id: `${edge.from}->${edge.to}-${i}`,
    source: edge.from,
    target: edge.to,
    animated: true,
  }));
}
```

---

### `ui/src/shared/api.ts` (utility, request-response)

**Analog:** `ui/src/main.tsx` lines 2964–3046

**runAction wrapper** (lines 2964–2977):

```typescript
async function runAction(
  setErrorMessage: (message: string | undefined) => void,
  operation: () => Promise<void>,
  refresh: () => Promise<void> = async () => undefined,
) {
  try {
    setErrorMessage(undefined);
    await operation();
    await refresh();
  } catch (error) {
    setErrorMessage(error instanceof Error ? error.message : String(error));
    await refresh();
  }
}
```

**post with JSON error parsing** (lines 2992–3018):

```typescript
async function post(path: string, body: Record<string, unknown>) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const text = await response.text();
    try {
      const parsed = JSON.parse(text) as {
        code?: string;
        error?: string;
        message?: string;
        details?: string;
        suggestedFix?: string;
      };
      const parts = [
        parsed.code,
        parsed.error ?? parsed.message,
        parsed.details,
        parsed.suggestedFix,
      ].filter(Boolean);
      throw new Error(parts.join(" | "));
    } catch {
      throw new Error(text);
    }
  }
}
```

**Planning error copy** (lines 2979–2990) — preserve for context-menu Plan actions:

```typescript
function formatPlanningError(message: string): string {
  if (message.includes("planning_failed")) {
    return `Planning failed: ${message}. Check the planner model tier and prompt, then try Plan children again.`;
  }
  // invalid_planner_output, invalid_prompt branches unchanged
  return message;
}
```

Also export: `postJson`, `del`, `approvalModeLabel`, `truncateFailureMessage`, `phaseLabel`, `formatPreferenceValue`, `deleteStrategyLabel`.

---

### `ui/src/shared/tokens.css` (config)

**Analog:** `ui/src/styles.css` lines 1–28

```css
:root {
  --space-xs: 4px;
  --space-sm: 8px;
  --space-md: 16px;
  --space-lg: 24px;
  --space-xl: 32px;
  --space-2xl: 48px;
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-pill: 999px;

  --font-body: 16px;
  --font-label: 12px;
  --font-heading: 22px;
  --font-meta: 11px;

  --color-bg: #eef2ef;
  --color-surface: #f8faf8;
  --color-card: #fbfcfd;
  --color-accent: #2d6cdf;
  --color-primary: #1f3d32;
  --color-danger: #923b34;
  --color-border: #d9e0db;

  color: #16201a;
  background: var(--color-bg);
  font-family: "Aptos", "Segoe UI", sans-serif;
}
```

**styles.css import pattern:**

```css
@import './shared/tokens.css';

* { box-sizing: border-box; }
/* element rules stay here — no duplicate :root */
```

Add new shell classes (`.topbar`, `.run-panel`, `.ctx-menu`, `.advanced-shell`) using existing token names; selected node outline uses `--color-accent` per UI-SPEC.

---

### `ui/src/app/AppShell.tsx` (provider, event-driven)

**Analog:** `ui/src/main.tsx` `App()` lines 515–1017

**SSE + initial fetch pattern** (lines 624–649):

```typescript
useEffect(() => {
  void refresh();
  const events = new EventSource("/api/events");
  events.addEventListener("snapshot", (event) => {
    setSnapshot(JSON.parse((event as MessageEvent).data) as SessionSnapshot);
  });
  events.addEventListener("execution", () => {
    void refresh();
    // Advanced views refresh their own domains on mount only
  });
  return () => events.close();
}, [refresh]);
```

**Graph sync effect** (lines 651–679) — keep in AppShell or GraphCanvas parent:

```typescript
useEffect(() => {
  if (draggingRef.current) return;
  const key = JSON.stringify({ nodes: snapshot.graph.nodes, edges: snapshot.graph.edges });
  if (key === lastGraphSyncKey.current) return;
  lastGraphSyncKey.current = key;
  setNodes(
    snapshot.graph.nodes.map((node, index) =>
      executionToFlowNode(node, index, {
        refresh,
        setErrorMessage,
        planningNodeId,
        setPlanningError,
        activeNodeId: snapshot.activeNodeId,
        runSummaryMessage: snapshot.runSummary?.message,
      }),
    ),
  );
  setEdges(graphToFlowEdges(snapshot.graph.edges));
}, [planningError, planningNodeId, refresh, snapshot]);
```

**Routing pattern** (new — from sketch 001 variant C):

```typescript
type ShellView = "workflow" | "advanced";
type AdvancedTab = "models" | "plugins" | "sessions" | "memory" | "settings";

const [view, setView] = useState<ShellView>("workflow");
const [advancedTab, setAdvancedTab] = useState<AdvancedTab>("models");

return view === "workflow" ? (
  <>
    <TopBar onOpenAdvanced={() => setView("advanced")} /* ... */ />
    <div className="shell workflow-shell">
      <GraphCanvas /* ... */ />
      {selectedNodeId ? <RunPanel nodeId={selectedNodeId} /* ... */ /> : null}
    </div>
  </>
) : (
  <AdvancedHub
    tab={advancedTab}
    onTabChange={setAdvancedTab}
    onBack={() => setView("workflow")}
  />
);
```

**Layout CSS change:** replace `.shell { grid-template-columns: minmax(0, 1fr) 380px }` with full-width canvas; run panel ~360px only when `selectedNodeId` set (sketch 002-B `.shell.with-dock`).

Boundary: workflow view must not mount `ModelLibraryPanel`, `PluginPanel`, etc. Domain fetches move to Advanced sub-views.

---

### `ui/src/app/TopBar.tsx` (component, request-response)

**Analog:** `ui/src/main.tsx` lines 798–876

```typescript
<header>
  <div className="run-status-block" aria-live="polite">
    <span className={`status ${snapshot.status}`} title={snapshot.runSummary?.message}>
      {uiRunStatusLabels[snapshot.status] ?? snapshot.status}
    </span>
    {snapshot.activeNodeId ? (
      <span className="run-active-node">
        Running: {activeNode.label} ({activeNode.expertAgentId ?? "default"}, {activeNode.expertRuntime ?? "single-pass"})
      </span>
    ) : null}
  </div>
  <span className="meta-pill">{approvalModeLabel(snapshot.approvalMode)}</span>
  <button className="icon" aria-label="Run workflow" onClick={() =>
    runAction(setErrorMessage, async () => {
      setActiveRunVariant(runVariant);
      return post("/api/chat/confirm-run", { variant: runVariant, input: runVariant === "pipeline" ? pipelineInput : undefined });
    }, refresh)
  }>Run workflow</button>
  <button className="icon danger" aria-label="Stop run" onClick={() =>
    runAction(setErrorMessage, () => post("/api/stop", { reason: "stopped from UI" }), refresh)
  }>
    <Square size={16} aria-hidden />
  </button>
  {/* NEW: Advanced entry per UI-SPEC copy */}
  <button type="button" onClick={onOpenAdvanced}>Advanced</button>
</header>
```

Move `runVariant` / `pipelineInput` controls to Advanced → Settings (GraphWorkflowPanel); TopBar keeps status + run/stop + Advanced only.

---

### `ui/src/canvas/GraphCanvas.tsx` (component, event-driven)

**Analog:** `ui/src/main.tsx` lines 696–795

**ReactFlow mount** (lines 772–795):

```typescript
<ReactFlow
  nodes={nodes}
  edges={edges}
  nodeTypes={nodeTypes}
  onNodesChange={onNodesChange}
  onConnect={onConnect as OnConnect}
  nodesConnectable
  nodesDraggable
  onNodeDragStart={() => { draggingRef.current = true; }}
  onNodeDragStop={() => { draggingRef.current = false; }}
  onMoveEnd={onViewportMoveEnd}
  onInit={(inst) => { rfInstanceRef.current = inst; }}
  onNodeClick={(_, node) => setSelectedNodeId(node.id)}
  onPaneClick={() => setSelectedNodeId(undefined)}  /* NEW: clear selection per UI-SPEC */
>
  <Background gap={20} color="#d8ded9" />
  <MiniMap pannable zoomable />
  <Controls />
</ReactFlow>
```

**Debounced layout flush** (lines 696–715):

```typescript
const flushLayout = useCallback(() => {
  layoutFlushTimer.current = setTimeout(() => {
    const payload = { ...pendingLayoutRef.current };
    pendingLayoutRef.current = {};
    if (Object.keys(payload).length === 0) return;
    void runAction(setErrorMessage, async () => {
      await post("/api/graph/layout", { positions: payload });
    }, refresh);
  }, 150);
}, [refresh]);
```

Wire `NodeContextMenu` at canvas level: listen for `onNodeContextMenu` from React Flow or card `contextmenu` event.

---

### `ui/src/nodes/ExecutionNodeCard.tsx` (component, CRUD)

**Analog:** `ui/src/main.tsx` lines 1019–1238

**Card structure** (lines 1081–1135):

```typescript
<div
  className={`node-card ${node.status} ${isActive ? "active-execution" : ""}`}
  aria-busy={node.status === "running" || isPlanning ? "true" : undefined}
>
  {/* Handles for ports — unchanged */}
  <div className="node-header">...</div>
  <div className="node-title">{node.label}</div>
  {editable ? (
    <textarea
      className="node-card-prompt"
      value={prompt}
      onChange={(event) => setPrompt(event.target.value)}
      aria-label={`Prompt for ${node.label || node.id}`}
    />
  ) : null}
  {node.loop ? <QualityLoopCardSummary loop={node.loop} /> : null}
  {/* ports, budget-line, pendingPlan, replan-gate — keep on card */}
</div>
```

**Protected replan gate stays on card** (lines 1176–1188):

```typescript
{planningError?.includes("replan_requires_choice") ? (
  <div className="replan-gate" role="alert">
    <b>Protected replan</b>
    <div className="actions">
      <button className="danger" onClick={() => chooseReplan("replace")}>Replace subtree</button>
      <button onClick={() => chooseReplan("merge")}>Merge</button>
      <button onClick={() => chooseReplan("cancel")}>Cancel</button>
    </div>
  </div>
) : null}
```

**Phase 61 delta — remove from card:**

- `node-card-footer` / `btn-primary-plan` block (lines 1189–1199) → context menu
- `node-models` meta block (lines 1208–1217) → Advanced Settings
- Add `.ctx-hint`: "Right-click for actions" (sketch 002 line 284)
- Selected state: add class when `selectedNodeId === node.id`; CSS `outline: 2px solid var(--color-accent); outline-offset: 2px`

**Prompt save:** debounce or blur → `POST /api/nodes/:id/edit` (today planFromCard saves before plan; context menu Plan should save prompt first like lines 1047–1049).

---

### `ui/src/nodes/NodeContextMenu.tsx` (component, request-response)

**Analog:** `.planning/sketches/002-context-menu-node-editing/index.html` lines 104–123, 241–342

**No production React analog.** Copy sketch structure:

```html
<div class="ctx-menu open" role="menu">
  <div class="section">Plan</div>
  <button role="menuitem">Plan children</button>
  ...
  <hr />
  <button role="menuitem" class="danger">Delete subtree</button>
</div>
```

**React implementation pattern:**

```typescript
type ContextMenuState = { nodeId: string; x: number; y: number } | null;

// Position fixed at clientX/clientY; clamp to viewport (sketch lines 332–333)
// Close on Escape, outside click (sketch lines 350–351)
// Disabled items when node.status !== 'awaiting_approval' for Approve/Skip
```

**API mapping** (from UI-SPEC — reuse existing `runAction` + `post`):

| Item | Endpoint |
|------|----------|
| Plan children | `POST /api/nodes/:id/edit` then `POST /api/nodes/:id/plan` |
| Break down | `POST /api/nodes/:id/breakdown` |
| Extend budget | `POST /api/nodes/:id/extend-budget` |
| Approve / Skip | `POST /api/nodes/:id/approve` / `skip` with `approvalToken` |
| Add child | modal → `POST /api/nodes/add` |
| Connect parent | modal → `POST /api/nodes/:id/connect` |
| Delete subtree | `confirm()` → `POST /api/nodes/:id/delete` |
| Expert overrides | `onNavigateAdvanced('settings')` — no API |

Trigger: `onContextMenu` on card, ⋮ button (`aria-haspopup="menu"`), Menu key / Shift+F10 on focused node.

---

### `ui/src/run-panel/RunPanel.tsx` (component, request-response)

**Analog:** `ui/src/main.tsx` lines 938–1013 + approve buttons 2696–2718

**Header** (derive from sketch 002 dock-head):

```typescript
<aside className="run-panel" aria-label="Run control">
  <div className="dock-head">
    <h2>{node.label}</h2>
    <p className="meta">{node.id} · {node.status}</p>
  </div>
```

**Approval block** (from NodeInspector, only when `awaiting_approval`):

```typescript
<button disabled={!waiting} onClick={() =>
  runAction(setErrorMessage, () =>
    post(`/api/nodes/${node.id}/approve`, { token: node.approvalToken }), refresh)
}>Approve</button>
```

**Clarification block** (lines 950–998):

```typescript
{pendingClarification ? (
  <>
    <div><b>Pending:</b> {pendingClarification.promptText}</div>
    <textarea value={clarificationAnswer} onChange={...} placeholder="Type clarification answer" />
    <button onClick={() => post("/api/clarifications/answer", { questionId, userAnswer })}>Submit answer</button>
    <button className="danger" onClick={() => post("/api/clarifications/abort", { questionId })}>Abort run</button>
  </>
) : null}
```

**Readiness** (lines 941–946):

```typescript
{runDisabled ? <div className="meta-row">{readiness.reason}</div> : null}
```

**Explicit exclusions:** no prompt textarea, no Plan/Save, no model trail — panel returns `null` when no selection (UI-SPEC: hidden, no placeholder rail).

**Responsive:** `@media (max-width: 800px)` — bottom sheet overlay (extend existing `.shell` media query in styles.css).

---

### `ui/src/advanced/AdvancedHub.tsx` (component, request-response)

**Analog:** `.planning/sketches/001-workflow-advanced-shell/index.html` lines 184–243

```html
<div class="advanced-shell">
  <header class="advanced-header">
    <button type="button" class="secondary">← Back to workflow</button>
    <nav class="advanced-tabs" aria-label="Advanced sections">
      <button type="button" class="active">Models</button>
      <button>Plugins</button>
      ...
    </nav>
  </header>
  <main class="advanced-content"><!-- active tab view --></main>
</div>
```

Lazy-mount sub-views: only render active tab component so `useEffect` fetch runs on first visit.

```typescript
{tab === "models" ? <ModelsView setErrorMessage={setErrorMessage} /> : null}
```

Copy: Back button = "← Back to workflow" (UI-SPEC).

---

### `ui/src/advanced/ModelsView.tsx` (component, CRUD)

**Analog:** `ui/src/main.tsx` `ModelLibraryPanel` lines 1813–1982

**Panel heading pattern** (lines 1832–1842):

```typescript
<div className="panel-heading">
  <label>Model Library</label>
  <button className="icon" title="Refresh models" onClick={() => runAction(setErrorMessage, refresh, refresh)}>
    <RefreshCw size={16} />
  </button>
</div>
```

**Fetch on mount** (move from App initial load):

```typescript
useEffect(() => { void refreshModelLibrary(); }, [refreshModelLibrary]);
```

Keep `.model-library-panel` styles; remove `max-height: 46vh` cap or relax for full-screen Advanced content area.

---

### `ui/src/advanced/PluginsView.tsx` (component, CRUD)

**Analog:** `ui/src/main.tsx` `PluginPanel` lines 1994–2168 (Phase 51)

Phase 51 established patterns — reuse verbatim:

**Restart banner** (lines 2062–2067):

```typescript
{restartRequired ? (
  <div className="meta-row warning plugin-restart-banner" role="status">
    <AlertTriangle size={16} aria-hidden />
    Restart RLM to load plugin changes. Tools are not updated until the session restarts.
  </div>
) : null}
```

**Remote install confirm** (lines 2086–2109):

```typescript
{pendingInstall ? (
  <div className="plugin-confirm" role="dialog" aria-labelledby="plugin-confirm-title">
    ...
    <button onClick={() => runInstall(pendingInstall.source, true)}>Install (--yes)</button>
  </div>
) : null}
```

**Doctor block** (lines 2112–2150) — `formatDoctorIssue` matches CLI vocabulary.

51-UI-REVIEW: reuse `panel-heading`, `meta-row`, `tag-row`, `actions`; aria-label on install input and refresh.

---

### `ui/src/advanced/SessionsView.tsx` (component, CRUD)

**Analog:** `ui/src/main.tsx` `SavedSessionPanel` lines 1547–1683

**Empty state** (lines 1591–1597):

```typescript
<div className="empty session-empty">
  <b>No saved sessions</b>
  <span>Save this workflow to reopen the graph, approvals, artifacts, and memory contract later.</span>
</div>
```

**Row actions** (lines 1600–1645): inspect detail via `GET /api/saved-sessions/:id`, open via `POST .../open`.

---

### `ui/src/advanced/MemoryView.tsx` (component, CRUD)

**Analog:** `ui/src/main.tsx` `MemoryPanel` lines 1685–1811

**Preference editor grid** (lines 1721–1748):

```typescript
<div className="preference-editor">
  <input placeholder="Preference key" ... />
  <input placeholder="Preference value" ... />
  <button onClick={() => post("/api/memory/preferences", { key, value, lifetime: "project" })}>Save</button>
</div>
```

Fetch: `GET /api/memory` on mount only.

---

### `ui/src/advanced/SettingsView.tsx` (component, CRUD)

**Analog:** composite of `NodeInspector` (2331–2778), `RefineGraphPanel` (1241–1343), `GraphWorkflowPanel` (1345–1545), `QualityLoopInspector` (2780–2934)

Relocate entire `NodeInspector` expert/sampling/model override forms here. Pass `selectedNodeId` from AppShell context or route state.

**Expert override POST** (lines 2587–2607):

```typescript
post(`/api/nodes/${node.id}/expert`, {
  agentId: expertAgentId,
  runtime: expertRuntime,
  toolAllowlist: expertTools.split(",").map((t) => t.trim()).filter(Boolean),
  purposeTiers: parseJsonObject(expertPurposeTiers),
})
```

**Quality loop inspector actions** (lines 2899–2931):

```typescript
post(`/api/nodes/${node.id}/quality-loop/accept`, { reason: "accepted from quality-loop inspector" })
post(`/api/nodes/${node.id}/quality-loop/stop`, { reason: "stopped from quality-loop inspector" })
```

**Test contract:** `tests/domain/recursion/recursive-language-model.test.ts` line 3112 reads `main.tsx` for strings `Full checkpoints`, `QualityLoopInspector`, `quality-loop/accept` — preserve in `shared/labels.ts` or `SettingsView` exports; update test import path in a later plan if needed.

---

### `ui/src/main.tsx` (entry, bootstrap)

**Analog:** current file lines 3048

```typescript
import { createRoot } from "react-dom/client";
import { AppShell } from "./app/AppShell";
import "./styles.css";

createRoot(document.getElementById("root")!).render(<AppShell />);
```

Target: under ~50 lines per seed doc.

---

## Shared Patterns

### API mutation + error surfacing

**Source:** `ui/src/main.tsx` lines 2964–3018  
**Apply to:** All views, context menu, RunPanel

Every user action uses `runAction(setErrorMessage, operation, refresh)`; never bare `fetch` without error handling.

### Panel chrome

**Source:** `PluginPanel` / `ModelLibraryPanel` panel-heading  
**Apply to:** All Advanced *View.tsx files

```typescript
<div className="panel-heading">
  <div>
    <label id="...">Section title</label>
    <div className="meta-row">One-line description</div>
  </div>
  <button className="icon" aria-label="Refresh" onClick={...}>
    <RefreshCw size={16} aria-hidden />
  </button>
</div>
```

### Modal overlay (Add child, Connect parent, Save workflow)

**Source:** `GraphWorkflowPanel` lines 1453–1541

```typescript
<div className="modal-overlay" role="presentation" onClick={() => setOpen(false)}>
  <div className="modal-card" role="dialog" aria-labelledby="..." onClick={(e) => e.stopPropagation()}>
    ...
  </div>
</div>
```

Reuse for context-menu graph actions requiring input.

### Lucide icons

**Source:** `ui/src/main.tsx` import block lines 18–32

```typescript
import { AlertTriangle, Check, Download, GitBranchPlus, RefreshCw, Square, Trash2, X } from "lucide-react";
```

Always pair icon-only buttons with `aria-label`; decorative icons get `aria-hidden`.

### Accessibility

**Source:** Phase 51 review + existing focus styles (`styles.css` lines 57–62)

- Focus: `outline: 2px solid var(--color-accent); outline-offset: 2px`
- Live regions: `aria-live="polite"` on run status (TopBar)
- Context menu: `role="menu"`, items `role="menuitem"`, Escape closes

### Responsive shell

**Source:** `ui/src/styles.css` lines 1043–1053

Extend for run-panel bottom sheet at `max-width: 800px`; workflow shell becomes single column with overlay panel.

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `ui/src/nodes/NodeContextMenu.tsx` | component | request-response | No React context menu in repo; sketch 002 HTML/JS is reference |
| `ui/src/advanced/AdvancedHub.tsx` | component | request-response | No full-screen tab shell in production; sketch 001 variant C |
| `ui/src/app/hooks/useSession.ts` | hook | event-driven | All state inline in `App()` today; extract as new pattern |

---

## Tests

**UI test coverage:** None in `tests/` — `.planning/codebase/TESTING.md` notes gap.

**Backend contract test touching UI strings:**

```typescript
// tests/domain/recursion/recursive-language-model.test.ts lines 3100–3118
const uiSource = await readFile(join(process.cwd(), "ui/src/main.tsx"), "utf8");
assert.match(uiSource, /Full checkpoints/);
assert.match(uiSource, /QualityLoopInspector/);
assert.match(uiSource, /quality-loop\/accept/);
```

After extraction, either keep strings reachable from repo (re-export) or update this test to read `ui/src/shared/labels.ts` / `SettingsView.tsx`. REG-01 workflows are manual/integration — no automated UI regression suite yet.

---

## Metadata

**Analog search scope:** `ui/src/`, `.planning/sketches/`, `.planning/milestones/v1.7-phases/51-plugin-manager-ui/`, `.planning/milestones/v1.5-phases/30-plan-from-node-foundation/30-PATTERNS.md`, `tests/`  
**Files scanned:** 12  
**Pattern extraction date:** 2026-05-22

---

## PATTERN MAPPING COMPLETE

**Phase:** 61 - UI Shell Rewrite  
**Files classified:** 18  
**Analogs found:** 15 / 18

### Coverage

- Files with exact analog: 13
- Files with role-match analog: 2
- Files with no analog (sketch/new): 3

### Key Patterns Identified

- All mutations flow through `shared/api.ts` `runAction` + `post` with identical JSON error parsing — relocate, do not rewrite
- Advanced domain panels (`ModelLibraryPanel`, `PluginPanel`, etc.) lift verbatim from `main.tsx`; only mount location and fetch timing change
- Workflow view = full-width ReactFlow + TopBar; Run panel conditional on `selectedNodeId`; no sidebar stack
- Context menu and Advanced hub shell come from sketches 002-B and 001-C — no production React precedent
- Design tokens extract to `shared/tokens.css`; `--color-accent: #2d6cdf` drives selected node outline per UI-SPEC

### File Created

`.planning/phases/61-ui-shell-rewrite/61-PATTERNS.md`

### Ready for Planning

Pattern mapping complete. Planner can reference analog patterns in PLAN.md files.
