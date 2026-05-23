# Requirements: Recursive Language Model CLI

**Defined:** 2026-05-23  
**Milestone:** v1.12 — UI Canvas Visual Polish  
**Core Value:** Developers can reliably plan, inspect, edit, and execute recursive AI node graphs with explicit model routing and no silent failures.

## v1.12 Requirements

### Theme (THEME)

- [ ] **THEME-01**: UI defaults to system light/dark preference via `prefers-color-scheme` when no manual override is stored
- [ ] **THEME-02**: User can switch theme (light / dark / system) from the workflow TopBar; choice persists in `localStorage` across browser sessions
- [ ] **THEME-03**: Workflow canvas, node cards, TopBar, Run panel, and Advanced hub surfaces use semantic CSS tokens and render correctly in both light and dark themes

### Graph Edges (EDGE)

- [ ] **EDGE-01**: Default graph connection lines are clearly visible in light mode (minimum 4.5:1 contrast against canvas background)
- [ ] **EDGE-02**: Default graph connection lines are clearly visible in dark mode (minimum 4.5:1 contrast against canvas background)
- [ ] **EDGE-03**: Edge stroke color reflects execution state (default, running, completed, failed) in both themes without relying on low-contrast gray defaults

### Canvas Visual Polish (CANV)

- [ ] **CANV-01**: Canvas uses neutral dot-grid background per `79-UI-SPEC.md` in both themes
- [ ] **CANV-02**: Node cards use light-header design with status chips (no dark `#1f2937` header bar); card chrome matches spec in both themes
- [ ] **CANV-03**: Node context menu uses `@radix-ui/react-context-menu` with keyboard/a11y parity; all Plan/Run/Graph/Advanced actions preserved
- [ ] **CANV-04**: React Flow Background, MiniMap, handles, and controls are themed and remain usable in both modes

### Verification (REG)

- [ ] **REG-02**: Operator completes browser checklist for theme toggle, edge visibility, and canvas polish on Rust-served UI; evidence recorded

## Future Requirements

Deferred beyond v1.12.

### Infrastructure

- **INFR-01**: Managed llama.cpp runtime (supervised process, GPU backends)
- **INFR-02**: Multi-runner adapters beyond Ollama (vLLM, cloud APIs)

### Release

- **REL-01**: Signed/reproducible release artifacts
- **REL-02**: Windows/macOS packages and auto-update channel

### UX Enhancements

- **UX-05**: Command palette (`⌘K`) for power-user navigation
- **UX-06**: Execution trace/output panel surfacing LLM results on nodes
- **NYQT-01**: Nyquist `*-VERIFICATION.md` artifacts for v1.10 phases 73–76

## Out of Scope

| Feature | Reason |
|---------|--------|
| shadcn / full component library adoption | Radix context menu primitive only per 79-UI-SPEC |
| Advanced hub full visual redesign | Theme tokens only unless required for contrast |
| Backend/API changes | Visual milestone only |
| Radix Dialog for GraphActionModal | Modals work today; defer |
| Managed llama.cpp / multi-runner | Infrastructure milestone |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| THEME-01 | Phase 82 | Pending |
| THEME-02 | Phase 82 | Pending |
| THEME-03 | Phase 82 | Pending |
| EDGE-01 | Phase 82 | Pending |
| EDGE-02 | Phase 82 | Pending |
| EDGE-03 | Phase 82 | Pending |
| CANV-01 | Phase 83 | Pending |
| CANV-02 | Phase 83 | Pending |
| CANV-04 | Phase 83 | Pending |
| CANV-03 | Phase 84 | Pending |
| REG-02 | Phase 85 | Pending |

**Coverage:**
- v1.12 requirements: 11 total
- Mapped to phases: 11
- Unmapped: 0 ✓

---
*Requirements defined: 2026-05-23*
