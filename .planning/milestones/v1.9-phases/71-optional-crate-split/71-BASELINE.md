# rlm-core Compile Baseline

**Captured:** 2026-05-22T22:38:23Z  
**Git SHA:** 058ecef  
**Toolchain:** rustc 1.94.0 (4a4ef493e 2026-03-02)

> Phases 69–70 must be complete before this baseline is authoritative for split decisions.

| Measurement | Wall seconds |
|-------------|-------------:|
| Clean build (`cargo build -p rlm-core`) | 7s |
| Incremental domain (`domain/types.rs`) | 2s |
| Incremental ports (`ports/language_model.rs`) | 1s |
| Incremental application (`application/mod.rs`) | 1s |
| Test iteration (`cargo test -p rlm-core --lib --no-fail-fast`) | 8s |

## Notes

- Clean build: `cargo clean -p rlm-core` then full rebuild.
- Incremental: touch target file, then `cargo build -p rlm-core`.
- Test iteration: library unit tests only; fails fast on compile errors.
