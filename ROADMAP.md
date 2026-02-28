# DevValue — Product Roadmap & Strategic Vision

## Mission
**The cost-effectiveness engine for AI-era software engineering.**

Not a time tracker. Not a cost dashboard. DevValue answers three questions:
1. What did this feature truly cost? (Human time + AI compute)
2. What should I charge for it? (Markup, quoting, invoicing)
3. Am I using the right AI tools? (Cross-tool comparison, optimization)

## Market Insight (Feb 2026)
- 40M developers using AI tools, 77% of orgs can't measure AI coding ROI
- AI API spend projected $15B in 2026, no dominant cost management tool exists
- CLI agents (Claude Code, Codex) = fastest growing segment at 200-300% YoY
- Zero tools offer unified cross-tool cost dashboard (Claude Code + Cursor + Copilot)
- Cloud FinOps analogy: started 2015, now $14.9B market → AI FinOps = $1-3B by 2030

## Core Positioning
- Target: CLI agent users (15-20% of devs, fastest growing) + multi-IDE users
- NOT a "save money" tool (only 5% buy for that) → "productivity decision tool" (56% buy for that)
- Key question: "Which AI tool gives the best results per dollar for MY work?"

## Architecture Principle: Build for the world 6 months from now
- Developers may not open IDEs → orchestrators dispatch agents directly
- A single feature may involve 5 agents across 3 providers simultaneously
- DevValue must be IDE-agnostic, tool-agnostic, deployment-agnostic
- VS Code extension = today's distribution channel, not the product boundary

### Platform Architecture (Target)
```
Data Sources (any combination):
├── Local log parsers (Claude Code, Cursor, Copilot, Codex, Gemini)
├── OpenTelemetry OTLP receiver
├── MCP protocol (AI agents report their own costs)
├── API webhooks (CI/CD pipelines, cloud agents)
└── Manual entry (for tools without telemetry)
          │
          ▼
    DevValue Core Engine (pure TS, runs anywhere)
    ├── Cost aggregation & deduplication
    ├── Pricing / markup / invoicing engine
    ├── Benchmarking & optimization recommendations
    └── Budget enforcement & alerting
          │
          ▼
Distribution (multiple frontends):
├── VS Code extension (v0.0.1 ✅ shipped)
├── CLI tool (`devvalue report`) ← NEXT PRIORITY
├── JetBrains plugin
├── Web dashboard (standalone SaaS)
├── MCP Server (AI agents query budgets)
└── API (integrate into any workflow)
```

---

## v0.0.1 ✅ SHIPPED (Built in 1 afternoon, $6.74)
- [x] PTA Flow Detection — intelligent idle timeout
- [x] Claude Code JSONL token sniffing with real pricing
- [x] Branch binding — cost per git branch
- [x] Status bar + Webview Dashboard
- [x] Workspace-scoped project filtering
- [x] UUID deduplication on restart
- [x] Published to VS Code Marketplace (ChrisZhang.devvalue)
- [x] GitHub: github.com/ChrisZHHG/devvalue

---

## v0.0.2 — CLI Tool + Multi-AI Support (CURRENT PRIORITY)

### CLI Tool (HIGH — unlocks terminal-first users)
- [ ] `devvalue report` — show cost summary in terminal
- [ ] `devvalue report --branch main` — filter by branch
- [ ] `devvalue report --json` — machine-readable output
- [ ] `devvalue watch` — live cost display (like `htop` for AI costs)
- [ ] Install via `npm install -g devvalue` / `brew install devvalue`
- [ ] Reuses entire core/ layer, only new CLI adapter needed

### Multi-AI Tool Sniffers (HIGH — core differentiator)
- [ ] Cursor — investigate ~/.cursor/ logs
- [ ] GitHub Copilot — check extension logs
- [ ] Codex CLI — OpenAI agent logs
- [ ] Aider / Windsurf — investigate log formats
- [ ] Auto-detect installed AI tools
- [ ] Dashboard: per-tool cost column (Claude: $5 | Cursor: $3 | Copilot: $1)

### Dashboard Improvements
- [ ] Per-tool icons and color coding
- [ ] Tool comparison view: "Which AI costs you most?"
- [ ] Disclaimer moved to summary bar area ✅

---

## v0.0.3 — Pricing Accuracy & Calibration

- [ ] "Calibrate" button — input actual bill → auto-calculate discount multiplier
- [ ] Enterprise/Education account detection
- [ ] Handle Haiku hidden background calls (not in local logs)
- [ ] Verify: DevValue shows ~1.54x actual bill for edu accounts (expected, documented)
- [ ] **Merged branch cost archival** — snapshot branch cost at merge time and store as immutable record; dashboard shows merged branches in a separate "Archived" section so feature costs survive the merge into master

---

## v0.0.4 — Markup & Quoting Engine (THE DIFFERENTIATOR)

- [ ] Markup calculator — set % per client/project (2x, 3x)
- [ ] "Feature X cost $45 → at 2.5x markup → quote $112.50"
- [ ] Export client-ready invoice (PDF/CSV)
- [ ] Per-branch cost summary for billing
- [ ] Freelancer mode: multiple clients, each with own markup rules
- [ ] Sprint/milestone total cost tracking

---

## v0.0.5 — Historical Intelligence & Benchmarking

- [ ] "Similar features cost $X on average" — learn from your history
- [ ] Time-series: cost per feature over time (getting more efficient?)
- [ ] Estimation: "Based on history, this feature will cost ~$X"
- [ ] Anonymous opt-in benchmark: compare to community averages
- [ ] "Developers using Cursor for this task type spend 40% less" — tool recommendations

---

## v0.1.0 — MCP Server & Budget Enforcement (THE MOAT)

- [ ] DevValue as MCP Server — agents query in real-time:
  - "What's my remaining budget for this branch?"
  - "What's the cheapest model for this task?"
  - "Developer fatigue level — should I pause?"
- [ ] Budget enforcement: agent auto-pauses when limit exceeded
- [ ] Cost-aware routing for multi-agent orchestrators (OpenClaw pattern)
- [ ] This makes DevValue the resource allocation brain for agent systems

---

## v0.2.0 — Team & Enterprise

- [ ] Team dashboard: manager sees cost per engineer per feature per sprint
- [ ] Budget allocation and tracking per department
- [ ] Cloud sync across machines
- [ ] Slack/Teams integration for alerts
- [ ] GitHub badge: "AI cost-efficiency score" (viral growth mechanism)

---

## Known Issues / Tech Debt
- [ ] EDH can't switch projects — VS Code limitation, not a bug
- [ ] Focus Time 0s until user interacts with editor
- [ ] Haiku background calls not in local JSONL logs (Claude Code limitation)
- [ ] Pricing ~1.54x for Education/Enterprise accounts (uses published rates, documented)
- [ ] Ambrosia branch remnants in globalState cache after first install
- [ ] **Merged branch cost loss** — when a branch is merged into master, its cost is absorbed into master's total; the per-feature cost record is not preserved. Intended behavior: merged branches should be archived with a "merged" snapshot so cost history survives the merge.

---

## Go-to-Market Strategy

### Distribution Sequence
1. VS Code extension ✅ (73.6% of devs, also works in Cursor/Windsurf)
2. CLI tool via npm (captures terminal-first Claude Code/Codex users)
3. Hacker News launch (WakaTime got first 1000 users from one HN post)
4. Reddit: r/programming, r/vscode, r/ClaudeAI
5. Product Hunt
6. GitHub badge for viral growth

### Pricing Model (Future)
- Free: VS Code extension + CLI, unlimited personal use
- Pro ($10-20/mo): Team dashboard, export/invoicing, calibration
- Enterprise: Custom pricing, SSO, budget enforcement, MCP Server

### Key Metric to Track
- "What did this feature cost?" answered per session
- Cross-tool cost visibility as primary activation metric