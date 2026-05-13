# Phase 11 UI Review

## UI Audit Scope

- Phase: 11 — `node-embedded-chat-and-intuitive-graph-editing-ux`
- Baseline: `11-UI-SPEC.md`
- Sources reviewed:
  - `ui/src/main.tsx`
  - `ui/src/styles.css`
  - `11-01-PLAN.md`
  - `11-01-SUMMARY.md`
  - `11-CONTEXT.md`
- Method: code-only audit (no Playwright MCP in this session)

## Score Summary

**Overall: 15/24**

| Pillar | Score | Notes |
|---|---:|---|
| Copywriting | 2/4 | Core intent is clear, but key labels diverge from contract language. |
| Visuals | 3/4 | Dense typed-node visual structure is implemented and coherent. |
| Color | 3/4 | Palette mostly matches contract, with clear state coding and contrast. |
| Typography | 2/4 | Font family matches, but size system exceeds 4-role contract. |
| Spacing | 1/4 | Multiple non-4px values break the declared spacing scale. |
| Experience Design | 4/4 | Node-local planning, budget gating, typed ports, and layout persistence are implemented. |

## Pillar Findings

### 1. Copywriting — 2/4

What matches:
- Empty-state and status communication exists and is actionable (`ui/src/main.tsx:488`, `ui/src/main.tsx:382`).
- Clarification flow is explicit with abort affordance (`ui/src/main.tsx:433-470`).

Gaps:
- Primary run CTA label is `Confirm graph and run` instead of the contract’s `Run workflow`/approval-oriented wording (`ui/src/main.tsx:355-359`).
- Clarification submit label is `Answer and continue`, not `Submit answer` (`ui/src/main.tsx:459`).
- Delete strategy options expose raw internal enum text (`delete_subtree`, `rewire_dependents`) instead of user-facing copy (`ui/src/main.tsx:407-409`).

### 2. Visuals — 3/4

What matches:
- ComfyUI-style dense node cards with typed headers, ports, budget strip, and model metadata (`ui/src/main.tsx:494-558`, `ui/src/styles.css:116-238`).
- Right-rail inspector with structured composer sections and runtime controls (`ui/src/main.tsx:579-650`).

Gap:
- Header control cluster risks visual crowding and readability degradation as labels expand (`ui/src/main.tsx:343-375`, `ui/src/styles.css:60-70`).

### 3. Color — 3/4

What matches:
- Dominant shell and panel colors align with spec direction (`ui/src/styles.css:1-4`, `ui/src/styles.css:51-53`).
- Accent/failure/destructive states are clearly encoded (`ui/src/styles.css:34-39`, `ui/src/styles.css:72-74`, `ui/src/styles.css:97-142`).
- Input/output handle color distinction is implemented (`ui/src/styles.css:232-238`).

Gap:
- Color system is hardcoded throughout and not tokenized, increasing drift risk against future brand updates.

### 4. Typography — 2/4

What matches:
- Font family contract is implemented (`ui/src/styles.css:4`).
- Label/body/meta emphasis hierarchy is present (`ui/src/styles.css:279-285`, `ui/src/styles.css:395-399`).

Gaps:
- Additional type sizes beyond the 4-role contract are used (`10px`, `11px`, `12px`, `13px`, `22px`) (`ui/src/styles.css:154`, `ui/src/styles.css:187`, `ui/src/styles.css:197`, `ui/src/styles.css:437`).
- `13px` usage for node title/error introduces a non-contract scale (`ui/src/styles.css:153-156`, `ui/src/styles.css:432-438`).

### 5. Spacing — 1/4

What matches:
- Many blocks use 8/12/16 multiples.

Gaps:
- Non-4px spacing values are pervasive: `18px`, `10px`, `6px`, `5px`, `9px`, `7px`, etc. (`ui/src/styles.css:56-57`, `ui/src/styles.css:93`, `ui/src/styles.css:150`, `ui/src/styles.css:201-223`, `ui/src/styles.css:283`, `ui/src/styles.css:437`).
- This violates the declared phase scale contract and reduces visual rhythm consistency.

### 6. Experience Design — 4/4

What matches:
- Plan mode + node-local breakdown actions are present (`ui/src/main.tsx:684-692`).
- Budget exhaustion is visible and extension is explicitly gated (`ui/src/main.tsx:613-614`, `ui/src/main.tsx:694-699`).
- Port-centric edge authoring is supported through `onConnect` with handle metadata (`ui/src/main.tsx:289-299`).
- Node layout and viewport persistence are implemented through debounced server sync (`ui/src/main.tsx:262-277`, `ui/src/main.tsx:302-312`).
- Artifact refs and context policy are surfaced in inspector (`ui/src/main.tsx:621-649`).

## Top Fixes (Priority Order)

1. Normalize UX copy to UI-SPEC contract for run/clarification/delete actions.
2. Enforce spacing scale refactor to 4px-multiple tokens and remove odd-pixel values.
3. Collapse typography to the 4-role scale defined in `11-UI-SPEC.md`.

## Detailed Action Items

1. Replace primary CTA and clarification labels with spec terms (`Run workflow`, `Submit answer`) and present delete choices in human-readable language.
2. Introduce spacing tokens (xs/sm/md/lg/xl/2xl) in CSS variables and migrate layout rules in `ui/src/styles.css`.
3. Remove non-contract font sizes (`10px`, `13px`) by mapping all text to approved roles.
4. Convert repeated color literals into named design tokens to reduce drift and simplify future theme adjustments.

## Verdict

Phase 11 UI implementation is functionally strong and delivers the typed-node composer interaction model. The primary gaps are design-system conformance (copy, spacing, and typography consistency), not feature completeness.
