# Codebase Research: Workspace & Packaging Structure

## Research Question
How is the monorepo structured, how is `packages/keymap` set up and consumed, and what constraints exist for adding a new extractable core package?

## Search Trail

| # | Search Query / Pattern | Files Found | Notes |
|---|------------------------|-------------|-------|
| 1 | Read root `package.json` | 1 | Workspace config, deps, scripts |
| 2 | Read `packages/` directory | 1 subdir | Only `keymap` exists |
| 3 | `@ghui/keymap` in `*.{ts,tsx}` | 25 matches | Heavy usage across `src/keymap/`, `src/keyboard/`, `src/App.tsx` |
| 4 | Read `dev/build-npm-packages.ts` | 1 | Custom publish pipeline, no workspace package publishing |
| 5 | Read `dev/package-smoke.ts` | 1 | Explicit assertion: published package must NOT depend on `@ghui/keymap` |
| 6 | Read `.changeset/config.json` | 1 | Standard changesets config, `ignore: []` |

## Relevant Files

| # | File Path | Relevance | Key Lines |
|---|-----------|-----------|-----------|
| 1 | `package.json` | Root workspace definition | L57-59 (`workspaces`), L71 (`@ghui/keymap` as devDep) |
| 2 | `packages/keymap/package.json` | Only existing workspace package; template for new packages | L1-18 (private, exports raw `.ts`, no build step) |
| 3 | `packages/keymap/tsconfig.json` | Standalone tsconfig per package | L1-19 |
| 4 | `dev/build-npm-packages.ts` | Builds the published npm artifact; completely ignores workspace packages | L81-108 (`buildMainPackage` copies `bin/` and metadata only) |
| 5 | `dev/build-cli.ts` | Bun bundle for dev; externals list matters | L3 (external packages list) |
| 6 | `dev/package-smoke.ts` | Guard: published package must not depend on `@ghui/keymap` | L42 |
| 7 | `.changeset/config.json` | Changesets config; `ignore: []` means all packages participate | L1-11 |
| 8 | `.github/workflows/publish.yml` | Release pipeline publishes only `@kitlangton/ghui` + per-platform binaries | L74-83, L116-125 |
| 9 | `tsconfig.json` (root) | Root TS config does NOT include `packages/` | L21 (`include: src/, dev/`) |

## Architecture Summary

### Workspace layout
- **Bun workspaces** declared in root `package.json` L57-59: `[".", "packages/*"]`.
- Single workspace package exists: `packages/keymap` (`@ghui/keymap`).
- Root package is the TUI app (`@kitlangton/ghui`).

### How `packages/keymap` works
- **Private** (`"private": true`), never published to npm.
- **No build step**: exports raw TypeScript via `"exports": { ".": "./src/index.ts", "./react": "./src/react.ts" }`.
- Own `tsconfig.json` with `moduleResolution: "bundler"`, `noEmit: true`.
- Referenced from root as `"@ghui/keymap": "workspace:*"` in **devDependencies** (not dependencies).
- Consumed by ~20 files under `src/keymap/` and `src/keyboard/opentuiAdapter.ts`, plus `src/App.tsx`.
- The `package-smoke.ts` test explicitly asserts the published package does **not** depend on `@ghui/keymap` (L42). This means workspace packages are bundled into the standalone binary and stripped from the npm publish manifest.

### Publishing pipeline
- `build:npm-packages` (`dev/build-npm-packages.ts`) constructs a **synthetic** `dist/npm/main/` directory with its own generated `package.json`. It does NOT copy `node_modules` or workspace package references — it only ships `bin/ghui.js` (the Node launcher that delegates to platform binaries).
- `build:standalone` compiles `src/standalone.ts` via `bun build --compile --bytecode` into a self-contained binary per platform. Workspace packages are bundled in at compile time.
- `build:cli` bundles `src/index.tsx` for dev use; externals are only runtime framework deps (effect, react, opentui).
- The publish workflow publishes exactly **5 npm packages** per release: the main `@kitlangton/ghui` + 4 platform binary packages (`@kitlangton/ghui-{platform}-{arch}`).

### Changesets
- Standard `@changesets/cli` invoked via `npm exec` (not installed as dep).
- Config at `.changeset/config.json`: `access: "public"`, `ignore: []`.
- If a new package is added and should NOT be independently published, it must be added to `ignore` or kept `private: true`.

## Constraints for Adding a New Package

1. **Workspace resolution works out of the box**: add `packages/core/package.json` and it's automatically part of `"packages/*"` workspace glob.

2. **No build needed for internal consumption**: keymap proves you can export raw `.ts` and let the app's bundler/Bun resolve it. A new core package can follow the same pattern.

3. **Publishing independence**: if the new core package should be published to npm separately, it needs:
   - Its own `publishConfig` with `access: "public"` and `provenance: true`.
   - A build step producing JS (the current keymap has none because it's private).
   - Addition to the publish workflow (new job or step).
   - A changeset entry for each version bump.

4. **If it stays private** (like keymap): mark `"private": true`, add to root `devDependencies` as `"workspace:*"`. The standalone `bun build --compile` will bundle it automatically. The smoke test will verify it's excluded from the published manifest.

5. **TypeScript**: each package has its own `tsconfig.json`. Root tsconfig does NOT use project references — each package typechecks independently via its own `bun test` / `tsc --noEmit`. Root `typecheck` script only covers `src/` and `dev/`.

6. **Smoke test guard** (`dev/package-smoke.ts` L42): asserts `@ghui/keymap` is absent from published deps. A new private workspace package would need a similar assertion added.

7. **Linting/formatting**: root scripts (`format:check`, `lint`) only target `src/ test/ dev/`. Packages under `packages/` are not covered — keymap has no lint config. A new package would need explicit inclusion or its own scripts.

## Recommended Package Shape (Future `@ghui/core`)

```
packages/core/
  package.json          # private: true, exports: {"." : "./src/index.ts"}, workspace:*
  tsconfig.json         # standalone, moduleResolution: "bundler", noEmit: true
  src/
    index.ts            # barrel export
    ...                 # domain types, services, pure logic
  test/
    ...                 # bun test
```

- Follow keymap's pattern: raw TS exports, private, devDep in root.
- Add `"@ghui/core": "workspace:*"` to root `devDependencies`.
- Add smoke assertion in `dev/package-smoke.ts` for `@ghui/core`.
- If it should eventually be public: add build step, changesets entry, and publish workflow job.
