# Pitfalls Research

## Pitfall 1: Graph Mutation Breaks Parent/Child Integrity
- Warning signs: orphaned nodes, cycles in supposed DAG segments, wrong resume target.
- Prevention: validate node references and edge constraints before mutation commit.
- Phase mapping: mutation API phase.

## Pitfall 2: Approval State Drift Between UI and Runtime
- Warning signs: UI shows paused while runtime continues or vice versa.
- Prevention: single authoritative execution state machine in controller; event acknowledgments.
- Phase mapping: approval gate phase.

## Pitfall 3: Model Override Not Reflected at Runtime
- Warning signs: node card shows one model but execution logs another.
- Prevention: central assignment source-of-truth and execution-time audit logging.
- Phase mapping: model routing visibility phase.

## Pitfall 4: Silent Error Paths in Async UI Events
- Warning signs: missing node updates, frozen UI, no terminal error.
- Prevention: structured error events + explicit failure status transitions.
- Phase mapping: error surfacing and reliability phase.

## Pitfall 5: Override Mode Bypasses Critical Safety Checks
- Warning signs: auto-run continues after invalid edits.
- Prevention: keep validation gates active even when approval prompts are skipped after initial plan.
- Phase mapping: override mode phase.
