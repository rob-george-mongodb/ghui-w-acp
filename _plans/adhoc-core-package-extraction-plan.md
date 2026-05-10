# Core package extraction plan

## Status

In progress.

## Problem Summary

The repo appears to contain reusable GitHub/domain/service logic under `src/` and `src/services/` that is currently coupled to the existing TUI package layout. We need a plan for extracting the non-UI logic into a new package, then updating the existing TUI to consume that package without losing current behavior.

## Current Code Context

Initial observations before deeper research:

- The root package `@kitlangton/ghui` is the published TUI package and already uses workspaces (`package.json`).
- There is already one extracted workspace package under `packages/keymap`.
- Candidate non-UI areas likely include domain models, command/config helpers, cache/loading flows, and service interfaces/implementations under `src/services/`.
- Existing plans under `plans/` cover cache evolution and may affect package-boundary decisions.

## Proposed Changes

To be filled in after codebase research. Likely topics:

1. Identify which files can move wholesale into a new core package.
2. Identify files that need API reshaping because they currently depend on TUI/runtime concerns.
3. Define package boundaries, entrypoints, dependency direction, and migration sequencing.
4. Define how the current TUI package will consume the new package.

## Verification Plan

To be filled in after research. Expected verification areas:

- workspace/package build wiring
- typecheck and test coverage for moved modules
- smoke coverage that the TUI still launches against the extracted package

## Risks / Open Questions

Open questions to answer with research:

1. What exactly counts as “not tied to any specific UI” in the current tree?
2. Should the new package be publishable as a public API or only an internal workspace package first?
3. Which files in `src/` are coupled to React, Atom runtime wiring, or TUI-specific state shape and therefore need adapters instead of direct moves?
4. How much of `src/services/GitHubService.ts` and cache/load code is reusable without also extracting app-level state management?
5. Does the repo already contain packaging/build conventions for multiple published artifacts beyond `packages/keymap`?

## Relevant Files / Research References

Initial references:

- `package.json`
- `plans/README.md`
- `plans/sqlite-cache.md`
- `plans/cache-v2.md`

Research artifacts to add:

- `_findings/codebase-research-*.md`
