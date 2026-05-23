# Requirements: Recursive Language Model CLI

**Defined:** 2026-05-22  
**Milestone:** v1.11 — UI Product Hardening  
**Core Value:** Developers can reliably plan, inspect, edit, and execute recursive AI node graphs with explicit model routing and no silent failures.

## v1.11 Requirements

### Shell Architecture (SHEL)

- [x] **SHEL-01**: Domain panels (Models, Plugins, Sessions, Memory, Settings) live in `advanced/*` views — not imported from `legacy/panels.tsx` monolith
- [ ] **SHEL-02**: Node context menu (Variant B) dispatches Plan, Run, Graph, and Advanced-link actions via existing `/api/nodes/*` and navigation mutations
- [ ] **SHEL-03**: Run panel mounts on node select only; shows approve/clarify/readiness — no prompt edit, plan buttons, or domain panels
- [ ] **SHEL-04**: Workflow view shows top bar + canvas only — models, plugins, sessions, and memory accessible only through Advanced hub
- [x] **SHEL-05**: `main.tsx` is thin entry (AppShell mount only); `run-panel/` does not import from `advanced/`

### Interaction Polish (UX)

- [x] **UX-01**: Canvas renders and interacts reliably on Rust-served UI
- [x] **UX-02**: User assigns plan/exec tiers from installed Ollama models in Advanced → Models without editing YAML
- [x] **UX-03**: Run/Stop and tier changes reflect server state — plan/exec models refresh after tier select; stop aborts in-flight inference
- [x] **UX-04**: UI server lifecycle is operator-safe — single-instance lock, `--stop`/`--replace`, documented in UAT runbook

### First-Run & Launcher (LAUN)

- [ ] **LAUN-01**: New workflow entry shows guided composer — prompt input and clear path to first plan/run on canvas
- [ ] **LAUN-02**: User can open an existing saved session or start fresh from a launcher before entering workflow view
- [ ] **LAUN-03**: Graph workspace remains primary surface after launcher; Advanced is secondary navigation

### Verification (REG)

- [ ] **REG-01**: Operator completes merged browser UAT checklist (`72-UAT.md` items 2–10) on Rust-served UI with live Ollama where applicable; evidence recorded; verification ratcheted to passed

## Future Requirements

Deferred beyond v1.11.

### Infrastructure

- **INFR-01**: Managed llama.cpp runtime (supervised process, GPU backends)
- **INFR-02**: Multi-runner adapters beyond Ollama (vLLM, cloud APIs)

### Release

- **REL-01**: Signed/reproducible release artifacts
- **REL-02**: Windows/macOS packages and auto-update channel

### UX Enhancements

- **UX-05**: Command palette (`⌘K`) for power-user navigation
- **NYQT-01**: Nyquist `*-VERIFICATION.md` artifacts for v1.10 phases 73–76

## Out of Scope

| Feature | Reason |
|---------|--------|
| New control-server endpoints (unless launcher requires minimal session bootstrap) | Shell restructure uses existing `/api/*` contract |
| Full visual redesign / new design system | Apply Phase 11/30 tokens; relocate existing panels first |
| Managed llama.cpp / multi-runner | Infrastructure milestone (INFR-01/02) |
| Release packaging / auto-update | Release milestone (REL-01/02) |
| Strict Rust boundary mode as default CI gate | Architecture debt; not UI milestone |
| Tauri desktop shell changes | Focus on browser-served Rust UI; Tauri inherits static build |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| UX-01 | Phase 77 | Complete |
| UX-02 | Phase 77 | Complete |
| UX-03 | Phase 77 | Complete |
| UX-04 | Phase 77 | Complete |
| SHEL-01 | Phase 78 | Complete |
| SHEL-05 | Phase 78 | Complete |
| SHEL-02 | Phase 79 | Pending |
| SHEL-03 | Phase 79 | Pending |
| SHEL-04 | Phase 79 | Pending |
| LAUN-01 | Phase 80 | Pending |
| LAUN-02 | Phase 80 | Pending |
| LAUN-03 | Phase 80 | Pending |
| REG-01 | Phase 81 | Pending |

**Coverage:**
- v1.11 requirements: 13 total
- Mapped to phases: 13
- Unmapped: 0 ✓

---
*Requirements defined: 2026-05-22*
*Last updated: 2026-05-22 after milestone v1.11 definition*
