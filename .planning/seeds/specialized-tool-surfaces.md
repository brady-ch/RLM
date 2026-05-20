---
title: Specialized Tool Surfaces per Expert Role
planted_date: 2026-05-19
trigger_condition: "When expert-team v1 (allowlist-only shared tools) shows repeated constrained-tool-call or task failures for a specific role on small models"
status: active
---

## Intent

Expert team v1 uses **one tool implementation, per-expert allowlists** (explore C decision A). This seed captures when to add **role-specific tool surfaces**—narrower schemas and descriptions so small models select tools and arguments more reliably.

## Examples (candidates, not commitments)

| Role | Possible specialized tool | Why |
|------|---------------------------|-----|
| Research | `web_fetch_docs` | Markdown-oriented fetch, smaller schema than generic `web_fetch` + content tree |
| Coding | `grep_repo`, `read_file_range` | Safer than broad `shell` for navigation |
| QA | `run_validation` | Wraps allowlisted test/build commands with fixed args |
| Design | `web_search_patterns` | Curated search params for UX/market research |

## Evaluation checks (before building)

- Failures are **reproducible** on small tier with constrained calling enabled (not provider outage or DDG blocks).
- Allowlist tightening alone does not fix argument/schema errors.
- New tool reduces average tool-round count or parse failures for that role in regression fixtures.

## Constraints

- Register via existing extension/MCP path; do not fork tool execution stacks.
- Keep shared core (e.g. one HTTP fetch adapter) behind thin role-facing wrappers if possible.
- New tools must map to expert allowlists in `agents.*.tools`.

## Depends on

- Phase 20 expert team baseline shipped and measured.
