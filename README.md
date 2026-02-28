# DevValue — True Cost of AI-Era Software Engineering

> **What did this feature really cost?**  
> Human focus time × your hourly rate + AI compute cost, tracked per git branch.

Most developers have no idea what a feature actually costs when you factor in both their time and Claude/Cursor/Copilot API spend. DevValue answers that question automatically.

---

## How It Works

```
Total Cost = (Focus Time × Hourly Rate) + AI Token Cost
```

- **Focus Time** is measured intelligently — reading code, reviewing AI output, and debugging all count. Idle gaps are detected and excluded.
- **AI Token Cost** is parsed directly from Claude Code's local session logs (`~/.claude/projects/`), using real-time published pricing per model.
- Everything is scoped to your **current git branch** — so each feature, fix, or PR has its own cost record.

---

## Features

- **PTA Flow Detection** — dynamically extends the idle timeout (5→20 min) when you're actively reading/debugging, so flow state isn't broken mid-review
- **Claude Code Token Sniffing** — stream-parses local JSONL logs, deduplicates by UUID, and maps tokens to exact model pricing (Sonnet, Haiku, Opus)
- **Branch Binding** — switch branches, cost tracking switches with you; all history preserved per branch
- **Status Bar** — live `$(clock) 2h 15m | $(git-branch) main | $12.40` display; click to open dashboard
- **Dashboard** — per-branch cost breakdown showing focus time, token counts (input/output/cache), and total spend

---

## Settings

| Setting | Default | Description |
|---|---|---|
| `devvalue.hourlyRate` | `75` | Your hourly rate in USD |
| `devvalue.maxIdleTimeout` | `300` | Seconds before marking you as idle |
| `devvalue.flowThreshold` | `3` | Activity events/min to trigger flow mode |
| `devvalue.claudeLogGlob` | `~/.claude/projects/*/session_logs/*.jsonl` | Path glob for Claude Code logs |
| `devvalue.enableStatusBar` | `true` | Show/hide the status bar item |

---

## Commands

- `DevValue: Open Dashboard` — view per-branch cost breakdown
- `DevValue: Start / Stop Tracking` — manually control the timer
- `DevValue: Reset Branch Data` — clear current branch's records
- `DevValue: Export Data` — export session data

---

## Accuracy Note

DevValue uses Claude's **published list prices**. If you're on an Education or Enterprise plan with negotiated discounts, your actual bill will be lower (typically ~0.65× of what DevValue shows). A calibration feature is planned for v0.0.3.

---

## Roadmap

- v0.0.7 ✅ — Token cost accuracy improvements, streaming deduplication
- v0.1.0 — CLI tool (`devvalue report`), multi-AI sniffer (Cursor, Copilot, Codex)
- v0.2.0 — Markup & quoting engine ("this feature cost $45 → quote client $112")
- v0.3.0 — MCP Server: AI agents query remaining budget in real-time

---

Built in public: [github.com/ChrisZHHG/devvalue](https://github.com/ChrisZHHG/devvalue)

