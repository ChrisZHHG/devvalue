# Change Log

All notable changes to the DevValue extension will be documented in this file.

## [0.0.8] — 2026-03-15

- fix: export command now surfaces error message on write failure
- chore: add `icon`, `license`, and `keywords` to marketplace metadata
- chore: set proper `displayName` ("DevValue") for Marketplace listing
- chore: align README glob path and fix repository URL typo
- chore: remove debug `console.log` statements from extension host

## [0.0.7]

- fix: token cost accuracy — streaming deduplication by `message.id`
- fix: `HEAD` session migration on activate (resolves branch via git reflog)
- fix: Haiku subagent costs now captured via `type:"progress"` records
- docs: rewrite README for v0.0.7

## [0.0.6]

- feat: second FileWatcherAdapter for subagent JSONL files
- feat: all local git branches shown in dashboard (zero-data placeholders)
- feat: `seenMessageIds` dedup prevents double-counting across parent/subagent files
- fix: `branchAtTime()` resolves tokens recorded while on HEAD detached state

## [0.0.5]

- feat: webview dashboard — per-branch cost breakdown with stat cards
- feat: two-step reset confirmation to prevent accidental data loss
- feat: rate editor in dashboard footer triggers live config update

## [0.0.4]

- chore: remove CLI tool (`src/cli.ts`, `src/adapters/cli/`, `HistoricalTokenReader`)
- chore: tighten `.vscodeignore` — exclude ROADMAP, CLAUDE.md, pnpm-lock, scripts

## [0.0.1]

- Initial release: PTA flow detection, Claude Code token sniffing, branch binding, status bar
