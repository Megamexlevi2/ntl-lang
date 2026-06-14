# NTL-lang Changelog

## v4.1.0 — 2026-06-12

### Fixed
- **ESM generation bug** — `ntl build --target esm` now correctly converts all
  `require()` / `module.exports` forms to valid ES module `import`/`export`
  statements. Previously, regex edge cases caused broken ESM output when
  multiple imports from the same module existed, or when re-exports were used.
- **Hardcoded Android path** — `examples/06_multi_file/main.js` contained
  absolute `/storage/emulated/0/` paths from the original build machine.
  The file is now fully portable and runs on any platform.
- **Broken `teste.ntl`** — replaced with a proper `utils.ntl` helper module.

### Added
- **Selective embedding** — when bundling a local `.ntl` module, only the
  exported functions that are actually used in the calling file are included
  in the compiled output. Unused exports are stripped at compile time.
  Controlled by `--no-treeshake` if you want to keep all exports.
- **`src/runtime/selective_embed.js`** — new internal module implementing
  used-name detection and selective export stripping.

### Changed
- Branding updated from `NTL` → `NTL-lang` across CLI, help text, README,
  and source file headers.
- Version bumped to **4.1.0**.
- README fully rewritten in English with corrected examples that use
  CommonJS (`require`) syntax throughout (matching the actual compiler output).
- `examples/05_modules.ntl` — added `async fn main()` wrapper for the
  bcrypt/JWT calls that require `await`.
- `examples/07_http_server.ntl` — version string updated from 3.5.0 → 4.1.0.
- `examples/06_multi_file/main.ntl` — updated string from "NTL 2026" → "NTL-lang 2026".
