# Phase 63 Context — Quality Loop Parity

**Goal:** Rust recursive engine runs the full quality loop matching TypeScript behavior.

**Requirements:** ENGN-01, ENGN-02, REG-02

**Upstream:** Phase 62 UI regression fixes (complete)

**Deferred from v1.8:** Quality loop in Rust was draft-only; TypeScript runs draft → critique → refine → gate → best_of_progress with rubric selection, gate stops, budget guard, and graph metadata sync.

**Success criteria (from ROADMAP):**

1. Quality-loop-enabled runs expose full iteration history on graph nodes
2. Golden parity tests pass for loop metadata and budget stops
3. Session readiness JSON uses structured `{ state, reason }` shape consistent with TypeScript
