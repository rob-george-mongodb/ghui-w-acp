# GitHub inbox-style PR list plan

## Status

Researching.

## Problem Summary

We want ghui to show pull requests more like GitHub's web inbox, rather than only the current queue/repository list view. The requested direction is to support a PR list shaped like the GitHub web UI and to apply an `updated` time filter that defaults to the last month.

The updated-time default does not need to be changed at runtime, but it must be configurable through config and/or an environment variable.

## Current Code Context

Research in progress.

## Proposed Changes

Research in progress.

## Verification Plan

Research in progress.

## Risks / Open Questions

- Scope is still being confirmed: does “as the GH web UI shows” require full inbox-style grouped sections (for example `Needs your review`, `Your drafts`, `Waiting for review`, `Needs action`, `Ready to merge`), or is a single richer PR list acceptable for the first pass?
- Need to confirm the best configuration surface for the default updated window so it fits the repo’s existing config/env model.
- Need to confirm whether the existing GitHub CLI + GraphQL query layer already exposes enough fields to derive GitHub-web-style sections, or whether the app will need broader search/query coverage.

## Relevant Files / Research References

- Research in progress.
