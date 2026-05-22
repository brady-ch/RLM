# Phase 65 Context — Skill Interop

**Goal:** Rust runtime supports configured skill loading matching Node interop.

**Requirements:** PLUG-01, PLUG-02, REG-02

**Upstream:** Phase 64 resume consumer (complete)

**Reference TypeScript:**
- `src/runtime/interop/mcp-skill-runtime.ts` — skill config, path policies, resolution
- `src/runtime/interop/interop-runtime.ts` — discovery, `skill` tool
- `src/runtime/composition/build-runtime-context.ts` — interop init order

**Success criteria (from ROADMAP):**

1. `skill` tool loads skills from configured search paths with path policy enforcement
2. Init order preserved: plugins → interop → tools resolver → agent registry → models
3. Plugin doctor warns on invalid skill paths

**Out of scope:**

- External ESM plugin `register()` skill loader execution (Rust-native manifest wiring only)
- Skill cache persistence across process restarts
- MCP lifecycle events in skill runtime (already in MCP module)
