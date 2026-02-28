/**
 * Returns the complete HTML document for the DevValue webview dashboard.
 * All CSS and JS are inline, guarded by a CSP nonce.
 */
export function getDashboardHtml(nonce: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy"
        content="default-src 'none'; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}';">
  <title>DevValue Dashboard</title>
  <style nonce="${nonce}">
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: var(--vscode-font-family, system-ui, sans-serif);
      font-size: var(--vscode-font-size, 13px);
      color: var(--vscode-editor-foreground, #ccc);
      background: var(--vscode-editor-background, #1e1e1e);
      height: 100vh;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    /* ── Header ──────────────────────────────────────────────── */
    .header {
      padding: 10px 16px;
      background: var(--vscode-sideBar-background, #252526);
      border-bottom: 1px solid var(--vscode-widget-border, #454545);
      flex-shrink: 0;
    }
    .header-title { font-size: 13px; font-weight: 600; letter-spacing: 0.2px; }

    /* ── Summary bar ─────────────────────────────────────────── */
    .summary-bar {
      display: flex;
      align-items: center;
      gap: 28px;
      padding: 8px 16px;
      min-height: 50px;
      background: var(--vscode-sideBar-background, #252526);
      border-bottom: 1px solid var(--vscode-widget-border, #454545);
      flex-shrink: 0;
    }
    .metric { display: flex; flex-direction: column; }
    .metric-lbl {
      font-size: 10px; text-transform: uppercase;
      letter-spacing: 0.6px; opacity: 0.65;
    }
    .metric-val {
      font-size: 17px; font-weight: 700;
      font-variant-numeric: tabular-nums; line-height: 1.25;
    }
    .metric-val.green  { color: var(--vscode-charts-green,  #4ec994); }
    .metric-val.blue   { color: var(--vscode-charts-blue,   #4d9de0); }
    .metric-val.orange { color: var(--vscode-charts-orange, #d48f43); }
    .hint { font-size: 12px; opacity: 0.55; }

    /* ── Layout ──────────────────────────────────────────────── */
    .content { display: flex; flex: 1; overflow: hidden; }

    /* ── Sidebar ─────────────────────────────────────────────── */
    .branch-list {
      width: 190px;
      flex-shrink: 0;
      overflow-y: auto;
      background: var(--vscode-sideBar-background, #252526);
      border-right: 1px solid var(--vscode-widget-border, #454545);
      display: flex;
      flex-direction: column;
    }

    /* ── View tabs (Branches / Days) ─────────────────────────── */
    .view-tabs {
      display: flex;
      flex-shrink: 0;
      border-bottom: 1px solid var(--vscode-widget-border, #454545);
    }
    .view-tab {
      flex: 1; padding: 6px 4px;
      border: none; border-bottom: 2px solid transparent;
      margin-bottom: -1px;
      cursor: pointer; font-size: 10px;
      font-weight: 700; text-transform: uppercase; letter-spacing: 0.6px;
      background: transparent;
      color: var(--vscode-editor-foreground, #ccc);
      opacity: 0.5; font-family: inherit;
    }
    .view-tab.active {
      opacity: 1;
      color: var(--vscode-focusBorder, #007acc);
      border-bottom-color: var(--vscode-focusBorder, #007acc);
    }
    .view-tab:hover:not(.active) { opacity: 0.75; }

    .sidebar-scroll { overflow-y: auto; flex: 1; }

    .branch-list-hdr {
      padding: 8px 12px 5px;
      font-size: 10px; font-weight: 700;
      text-transform: uppercase; letter-spacing: 0.7px; opacity: 0.6;
    }
    .branch-item {
      display: flex; align-items: center;
      padding: 7px 12px; cursor: pointer;
      border-left: 2px solid transparent;
      user-select: none;
    }
    .branch-item:hover {
      background: var(--vscode-list-hoverBackground, rgba(255,255,255,.05));
    }
    .branch-item.selected {
      background: var(--vscode-list-activeSelectionBackground, #094771);
      color: var(--vscode-list-activeSelectionForeground, #fff);
      border-left-color: var(--vscode-focusBorder, #007acc);
    }
    .b-dot {
      width: 6px; height: 6px; border-radius: 50%;
      background: var(--vscode-focusBorder, #007acc);
      flex-shrink: 0; margin-right: 7px;
    }
    .b-spacer { width: 13px; flex-shrink: 0; }
    .b-name {
      flex: 1; font-size: 12px;
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    .b-cost {
      font-size: 11px; font-variant-numeric: tabular-nums;
      opacity: 0.8; flex-shrink: 0; margin-left: 4px;
    }
    .branch-empty { padding: 12px; font-size: 11px; opacity: 0.5; }

    /* ── Detail panel ────────────────────────────────────────── */
    .detail { flex: 1; overflow-y: auto; padding: 16px 20px; }

    .detail-head {
      display: flex; align-items: center; gap: 10px;
      margin-bottom: 16px;
    }
    .detail-branch { font-size: 15px; font-weight: 700; }
    .badge {
      font-size: 10px; padding: 2px 8px;
      background: var(--vscode-badge-background, #4d4d4d);
      color: var(--vscode-badge-foreground, #fff);
      border-radius: 8px;
    }

    /* ── Stat cards ──────────────────────────────────────────── */
    .stat-grid {
      display: grid; grid-template-columns: repeat(3, 1fr);
      gap: 10px; margin-bottom: 20px;
    }
    .stat-card {
      background: var(--vscode-input-background, #3c3c3c);
      border: 1px solid var(--vscode-input-border, transparent);
      border-radius: 4px; padding: 11px 13px;
    }
    .stat-lbl {
      font-size: 10px; text-transform: uppercase;
      letter-spacing: 0.6px; opacity: 0.65;
    }
    .stat-val {
      font-size: 19px; font-weight: 700;
      font-variant-numeric: tabular-nums; margin-top: 3px;
    }

    /* ── Section ─────────────────────────────────────────────── */
    .section { margin-bottom: 18px; }
    .section-hdr {
      font-size: 10px; font-weight: 700;
      text-transform: uppercase; letter-spacing: 0.7px; opacity: 0.6;
      margin-bottom: 8px;
    }

    /* ── Cost breakdown bars ─────────────────────────────────── */
    .bdown-row {
      display: flex; align-items: center;
      gap: 10px; margin-bottom: 7px;
    }
    .bdown-lbl { width: 76px; font-size: 12px; }
    .bdown-track {
      flex: 1; height: 7px;
      background: var(--vscode-input-background, #3c3c3c);
      border-radius: 4px; overflow: hidden;
    }
    .bdown-fill {
      height: 100%; border-radius: 4px;
      transition: width .4s ease;
    }
    .bdown-fill.human { background: var(--vscode-charts-blue,   #4d9de0); }
    .bdown-fill.ai    { background: var(--vscode-charts-orange, #d48f43); }
    .bdown-val {
      width: 68px; text-align: right;
      font-size: 12px; font-variant-numeric: tabular-nums;
    }

    /* ── Day detail: branch breakdown rows ───────────────────── */
    .day-branch-row {
      display: flex; align-items: center;
      gap: 10px; margin-bottom: 7px;
    }
    .day-branch-name {
      width: 150px; font-size: 12px;
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      flex-shrink: 0;
    }

    /* ── Daily activity table (inside branch detail) ─────────── */
    .day-table { width: 100%; }
    .day-row {
      display: flex; justify-content: space-between;
      font-size: 12px; padding: 5px 0;
      border-bottom: 1px solid var(--vscode-widget-border, #454545);
    }
    .day-row-date { opacity: 0.75; }
    .day-row-cost { font-variant-numeric: tabular-nums; font-weight: 600; }

    /* ── Token rows ──────────────────────────────────────────── */
    .token-grid {
      display: grid; grid-template-columns: 1fr 1fr;
      column-gap: 20px;
    }
    .token-row {
      display: flex; justify-content: space-between;
      font-size: 12px; padding: 5px 0;
      border-bottom: 1px solid var(--vscode-widget-border, #454545);
    }
    .tok-lbl { opacity: 0.75; }
    .tok-val { font-variant-numeric: tabular-nums; font-weight: 600; }
    .model-pills { margin-top: 8px; display: flex; flex-wrap: wrap; gap: 4px; }
    .model-pill {
      font-size: 10px; padding: 2px 8px;
      background: var(--vscode-badge-background, #4d4d4d);
      color: var(--vscode-badge-foreground, #fff);
      border-radius: 8px; font-variant-numeric: tabular-nums;
    }

    /* ── Buttons ─────────────────────────────────────────────── */
    .actions { display: flex; gap: 8px; margin-top: 4px; }
    button {
      padding: 5px 13px; border: none; border-radius: 3px;
      cursor: pointer; font-size: 12px; font-family: inherit;
      background: var(--vscode-button-background, #0e639c);
      color: var(--vscode-button-foreground, #fff);
    }
    button:hover { background: var(--vscode-button-hoverBackground, #1177bb); }
    button.secondary {
      background: transparent;
      color: var(--vscode-editor-foreground, #ccc);
      border: 1px solid var(--vscode-input-border, #454545);
    }
    button.secondary:hover {
      background: var(--vscode-list-hoverBackground, rgba(255,255,255,.05));
    }
    button.danger {
      background: transparent;
      color: var(--vscode-errorForeground, #f48771);
      border: 1px solid var(--vscode-errorForeground, #f48771);
    }
    button.danger:hover { background: rgba(244,135,113,.12); }
    button.confirm {
      background: var(--vscode-errorForeground, #f48771);
      color: #fff; border: none;
    }
    button.confirm:hover { opacity: 0.9; }

    /* ── Footer ──────────────────────────────────────────────── */
    .footer {
      display: flex; align-items: center; gap: 8px;
      padding: 9px 16px; font-size: 12px;
      border-top: 1px solid var(--vscode-widget-border, #454545);
      background: var(--vscode-sideBar-background, #252526);
      flex-shrink: 0;
    }
    .footer label { opacity: 0.75; }
    .footer input {
      width: 64px; padding: 3px 7px;
      background: var(--vscode-input-background, #3c3c3c);
      color: var(--vscode-input-foreground, #ccc);
      border: 1px solid var(--vscode-input-border, #3c3c3c);
      border-radius: 2px; font-size: 12px; font-family: inherit;
    }
    .footer input:focus {
      outline: 1px solid var(--vscode-focusBorder, #007acc);
      border-color: var(--vscode-focusBorder, #007acc);
    }
    .footer .unit { opacity: 0.65; }
    .footer .spacer { flex: 1; }
    .footer .total-lbl { opacity: 0.65; }
    .footer .total-val { font-weight: 700; font-variant-numeric: tabular-nums; }

    /* ── Pricing notice ──────────────────────────────────────── */
    .pricing-notice {
      text-align: center;
      padding: 4px 0;
      color: var(--vscode-descriptionForeground, #aaa);
      font-size: 11px;
      font-style: italic;
      border-bottom: 1px solid var(--vscode-widget-border, #454545);
      margin-bottom: 0;
      flex-shrink: 0;
    }

    /* ── Empty / loading ─────────────────────────────────────── */
    .loading, .empty-detail {
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      height: 160px; opacity: 0.55; font-size: 12px; gap: 6px;
    }
  </style>
</head>
<body>
  <div class="header">
    <span class="header-title">DevValue Dashboard</span>
  </div>

  <div id="summary-bar" class="summary-bar">
    <span class="hint">Loading&hellip;</span>
  </div>

  <div class="pricing-notice">
    ⓘ Based on Anthropic's published API rates · Enterprise & Education pricing may differ
  </div>

  <div class="content">
    <div id="branch-list" class="branch-list"></div>
    <div id="detail" class="detail">
      <div class="loading">Waiting for data&hellip;</div>
    </div>
  </div>

  <div class="footer">
    <label for="rate-input">Hourly rate:</label>
    <span>$</span>
    <input id="rate-input" type="number" min="1" max="9999" step="1" value="75">
    <span class="unit">/hr</span>
    <button id="btn-apply">Apply</button>
    <span class="spacer"></span>
    <span class="total-lbl">All branches:&nbsp;</span>
    <span id="footer-total" class="total-val">$0.00</span>
  </div>

  <script nonce="${nonce}">
  (function () {
    'use strict';

    var vscode = acquireVsCodeApi();

    // ── State ────────────────────────────────────────────────
    var sessions       = [];
    var currentBranch  = '';
    var config         = { hourlyRate: 75 };
    var selectedBranch = '';
    var resetPending   = false;
    var sidebarView    = 'branches';  // 'branches' | 'days'
    var selectedDay    = '';          // ISO date string e.g. '2026-02-28'

    // ── Formatters ───────────────────────────────────────────
    function fmtCost(n) {
      if (n === 0) { return '$0.00'; }
      if (n < 0.005) { return '<$0.01'; }
      return '$' + n.toFixed(2);
    }

    function fmtTime(secs) {
      secs = Math.round(secs);
      if (secs < 60)  { return secs + 's'; }
      var h = Math.floor(secs / 3600);
      var m = Math.floor((secs % 3600) / 60);
      if (h === 0)    { return m + 'm'; }
      if (m === 0)    { return h + 'h'; }
      return h + 'h ' + m + 'm';
    }

    function fmtNum(n) {
      return n.toLocaleString();
    }

    function esc(s) {
      return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    }

    var MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

    /** Format an ISO date string ('2026-02-28') as 'Feb 28'. */
    function fmtDate(iso) {
      var p = iso.split('-');
      return MONTHS[parseInt(p[1]) - 1] + ' ' + parseInt(p[2]);
    }

    // ── Derived ──────────────────────────────────────────────
    function allTotals() {
      return sessions.reduce(function (a, s) {
        return {
          cost:  a.cost  + s.breakdown.totalCostUsd,
          secs:  a.secs  + s.focusSeconds,
          ai:    a.ai    + s.breakdown.aiCostUsd,
          human: a.human + s.breakdown.humanCostUsd,
        };
      }, { cost: 0, secs: 0, ai: 0, human: 0 });
    }

    function tokenStats(tokenUsage) {
      var r = { input: 0, output: 0, calls: 0, models: {} };
      for (var i = 0; i < tokenUsage.length; i++) {
        var t = tokenUsage[i];
        if (t.isBackground) { continue; }
        r.input  += t.inputTokens;
        r.output += t.outputTokens;
        r.calls++;
        var m = t.model.startsWith('claude-') ? t.model.slice(7) : t.model;
        r.models[m] = (r.models[m] || 0) + t.costUsd;
      }
      return r;
    }

    /**
     * Compute per-UTC-day costs grouped by branch, across all sessions.
     * Costs are attributed using the session's branchName (the final attributed
     * branch), not the per-usage gitBranch field, for consistency with the rest
     * of the dashboard.
     *
     * Returns an array sorted newest-first:
     *   [{ date: '2026-02-28', total: 7.49,
     *      branches: [{ branch: 'master', cost: 6.54 }, ...] }, ...]
     */
    function computeDailyByBranch() {
      var byDay = {};
      for (var si = 0; si < sessions.length; si++) {
        var sess    = sessions[si];
        var branch  = sess.branchName;
        var usages  = sess.tokenUsage;
        for (var ti = 0; ti < usages.length; ti++) {
          var t = usages[ti];
          if (!t.timestamp) { continue; }
          var d   = new Date(t.timestamp);
          var key = d.getUTCFullYear() + '-' +
                    String(d.getUTCMonth() + 1).padStart(2, '0') + '-' +
                    String(d.getUTCDate()).padStart(2, '0');
          if (!byDay[key]) { byDay[key] = {}; }
          byDay[key][branch] = (byDay[key][branch] || 0) + t.costUsd;
        }
      }
      return Object.keys(byDay).sort().reverse().map(function (date) {
        var branchMap = byDay[date];
        var total = Object.keys(branchMap).reduce(function (s, k) {
          return s + branchMap[k];
        }, 0);
        var branches = Object.keys(branchMap)
          .map(function (b) { return { branch: b, cost: branchMap[b] }; })
          .sort(function (a, b) { return b.cost - a.cost; });
        return { date: date, total: total, branches: branches };
      });
    }

    // ── Build HTML fragments ─────────────────────────────────
    function mkMetric(lbl, val, cls) {
      return '<div class="metric">' +
        '<span class="metric-lbl">' + esc(lbl) + '</span>' +
        '<span class="metric-val ' + (cls || '') + '">' + esc(val) + '</span>' +
        '</div>';
    }

    function mkStatCard(lbl, val) {
      return '<div class="stat-card">' +
        '<div class="stat-lbl">' + esc(lbl) + '</div>' +
        '<div class="stat-val">' + esc(val) + '</div>' +
        '</div>';
    }

    function mkBarRow(lbl, pctStr, cls, val) {
      return '<div class="bdown-row">' +
        '<span class="bdown-lbl">' + esc(lbl) + '</span>' +
        '<div class="bdown-track">' +
          '<div class="bdown-fill ' + cls + '" style="width:' + pctStr + '%"></div>' +
        '</div>' +
        '<span class="bdown-val">' + esc(val) + '</span>' +
        '</div>';
    }

    function mkTokRow(lbl, val) {
      return '<div class="token-row">' +
        '<span class="tok-lbl">' + esc(lbl) + '</span>' +
        '<span class="tok-val">' + esc(val) + '</span>' +
        '</div>';
    }

    /** Bar row with a wide branch-name label (for day detail). */
    function mkDayBranchRow(branch, pctStr, costStr) {
      return '<div class="day-branch-row">' +
        '<span class="day-branch-name" title="' + esc(branch) + '">' + esc(branch) + '</span>' +
        '<div class="bdown-track">' +
          '<div class="bdown-fill ai" style="width:' + pctStr + '%"></div>' +
        '</div>' +
        '<span class="bdown-val">' + esc(costStr) + '</span>' +
        '</div>';
    }

    // ── Render sections ──────────────────────────────────────
    function renderSummary() {
      if (!sessions.length) {
        return '<span class="hint">Start coding to begin tracking</span>';
      }
      var t = allTotals();
      return mkMetric('All Branches', fmtCost(t.cost), 'green') +
        mkMetric('Focus Time', fmtTime(t.secs), '') +
        mkMetric('Human Cost', fmtCost(t.human), 'blue') +
        mkMetric('AI Cost', fmtCost(t.ai), 'orange') +
        mkMetric('Branches', String(sessions.length), '');
    }

    function renderTabs() {
      return '<div class="view-tabs">' +
        '<button class="view-tab' + (sidebarView === 'branches' ? ' active' : '') + '"' +
          ' data-action="tab-branches">Branches</button>' +
        '<button class="view-tab' + (sidebarView === 'days' ? ' active' : '') + '"' +
          ' data-action="tab-days">By Day</button>' +
        '</div>';
    }

    function renderBranchList() {
      if (!sessions.length) {
        return '<div class="branch-empty">No branches tracked yet</div>';
      }
      var sorted = sessions.slice().sort(function (a, b) {
        return b.breakdown.totalCostUsd - a.breakdown.totalCostUsd;
      });
      var hdr = '<div class="branch-list-hdr">Branches</div>';
      var items = sorted.map(function (s) {
        var isActive   = s.branchName === currentBranch;
        var isSelected = s.branchName === selectedBranch;
        return '<div class="branch-item' + (isSelected ? ' selected' : '') + '"' +
          ' data-action="select" data-branch="' + esc(s.branchName) + '">' +
          (isActive ? '<div class="b-dot"></div>' : '<div class="b-spacer"></div>') +
          '<span class="b-name" title="' + esc(s.branchName) + '">' + esc(s.branchName) + '</span>' +
          '<span class="b-cost">' + fmtCost(s.breakdown.totalCostUsd) + '</span>' +
          '</div>';
      });
      return hdr + items.join('');
    }

    function renderDayList() {
      var days = computeDailyByBranch();
      if (!days.length) {
        return '<div class="branch-empty">No daily data yet</div>';
      }
      var hdr = '<div class="branch-list-hdr">UTC Calendar Days</div>';
      var items = days.map(function (d) {
        var isSelected = d.date === selectedDay;
        return '<div class="branch-item' + (isSelected ? ' selected' : '') + '"' +
          ' data-action="select-day" data-day="' + esc(d.date) + '">' +
          '<div class="b-spacer"></div>' +
          '<span class="b-name">' + esc(fmtDate(d.date)) + '</span>' +
          '<span class="b-cost">' + fmtCost(d.total) + '</span>' +
          '</div>';
      });
      return hdr + items.join('');
    }

    function renderBranches() {
      var list = sidebarView === 'days' ? renderDayList() : renderBranchList();
      return renderTabs() + '<div class="sidebar-scroll">' + list + '</div>';
    }

    function renderDayDetail() {
      var days = computeDailyByBranch();
      var dayData = null;
      for (var i = 0; i < days.length; i++) {
        if (days[i].date === selectedDay) { dayData = days[i]; break; }
      }
      if (!dayData) {
        return '<div class="empty-detail">Select a day to see its breakdown</div>';
      }

      var p = selectedDay.split('-');
      var fullLabel = MONTHS[parseInt(p[1]) - 1] + ' ' + parseInt(p[2]) + ', ' + p[0];

      var html = '<div class="detail-head">' +
        '<span class="detail-branch">' + esc(fullLabel) + '</span>' +
        '</div>';

      html += '<div class="stat-grid">' +
        mkStatCard('Total AI Cost', fmtCost(dayData.total)) +
        mkStatCard('Branches', String(dayData.branches.length)) +
        mkStatCard('Largest', fmtCost(dayData.branches[0] ? dayData.branches[0].cost : 0)) +
        '</div>';

      html += '<div class="section"><div class="section-hdr">Cost by Branch</div>';
      dayData.branches.forEach(function (entry) {
        var pct = dayData.total > 0
          ? (entry.cost / dayData.total * 100).toFixed(1)
          : '0.0';
        html += mkDayBranchRow(entry.branch, pct, fmtCost(entry.cost));
      });
      html += '</div>';

      return html;
    }

    function renderDetail() {
      if (sidebarView === 'days') {
        return renderDayDetail();
      }

      var sess = null;
      for (var i = 0; i < sessions.length; i++) {
        if (sessions[i].branchName === selectedBranch) {
          sess = sessions[i];
          break;
        }
      }
      if (!sess) {
        return '<div class="empty-detail">Select a branch to see its cost breakdown</div>';
      }

      var b   = sess.breakdown;
      var ts  = tokenStats(sess.tokenUsage);
      var tot = b.totalCostUsd;
      var hPct = tot > 0 ? (b.humanCostUsd / tot * 100).toFixed(1) : '100.0';
      var aPct = tot > 0 ? (b.aiCostUsd    / tot * 100).toFixed(1) : '0.0';
      var isActive = sess.branchName === currentBranch;

      var html = '';

      // Header
      html += '<div class="detail-head">' +
        '<span class="detail-branch">' + esc(sess.branchName) + '</span>' +
        (isActive ? '<span class="badge">active</span>' : '') +
        '</div>';

      // Stat cards
      html += '<div class="stat-grid">' +
        mkStatCard('Total Cost',  fmtCost(b.totalCostUsd)) +
        mkStatCard('Focus Time',  fmtTime(sess.focusSeconds)) +
        mkStatCard('AI Cost',     fmtCost(b.aiCostUsd)) +
        '</div>';

      // Cost breakdown
      html += '<div class="section">' +
        '<div class="section-hdr">Cost Breakdown</div>' +
        mkBarRow('Human', hPct, 'human', fmtCost(b.humanCostUsd)) +
        mkBarRow('AI', aPct, 'ai', fmtCost(b.aiCostUsd)) +
        '</div>';

      // Token usage
      html += '<div class="section"><div class="section-hdr">Token Usage</div>';
      if (ts.calls > 0) {
        html += '<div class="token-grid">' +
          mkTokRow('Input tokens',  fmtNum(ts.input))  +
          mkTokRow('Output tokens', fmtNum(ts.output)) +
          mkTokRow('API calls',     fmtNum(ts.calls))  +
          mkTokRow('Avg/call',      fmtCost(b.aiCostUsd / ts.calls)) +
          '</div>';
        var modelEntries = Object.entries(ts.models);
        if (modelEntries.length > 0) {
          html += '<div class="model-pills">' +
            modelEntries.map(function (entry) {
              return '<span class="model-pill">' + esc(entry[0]) + ' &middot; ' + fmtCost(entry[1]) + '</span>';
            }).join('') +
            '</div>';
        }
      } else {
        html += '<div style="font-size:12px;opacity:.55">No AI usage recorded on this branch</div>';
      }
      html += '</div>';

      // Daily activity for this branch
      var allDays = computeDailyByBranch();
      var branchDays = allDays.filter(function (d) {
        return d.branches.some(function (e) { return e.branch === sess.branchName; });
      });
      if (branchDays.length > 0) {
        html += '<div class="section"><div class="section-hdr">Daily Activity</div>';
        html += '<div class="day-table">';
        branchDays.forEach(function (d) {
          var dayCost = 0;
          d.branches.forEach(function (e) {
            if (e.branch === sess.branchName) { dayCost = e.cost; }
          });
          html += '<div class="day-row">' +
            '<span class="day-row-date">' + esc(fmtDate(d.date)) + '</span>' +
            '<span class="day-row-cost">' + fmtCost(dayCost) + '</span>' +
            '</div>';
        });
        html += '</div></div>';
      }

      // Actions
      if (resetPending) {
        html += '<div class="actions">' +
          '<button class="confirm" data-action="reset-confirm" data-branch="' + esc(sess.branchName) + '">Confirm Reset</button>' +
          '<button class="secondary" data-action="reset-cancel">Cancel</button>' +
          '</div>';
      } else {
        html += '<div class="actions">' +
          '<button class="danger" data-action="reset-ask" data-branch="' + esc(sess.branchName) + '">Reset Branch Data</button>' +
          '</div>';
      }

      return html;
    }

    // ── Full render ──────────────────────────────────────────
    function render() {
      document.getElementById('summary-bar').innerHTML = renderSummary();
      document.getElementById('branch-list').innerHTML = renderBranches();
      document.getElementById('detail').innerHTML      = renderDetail();

      // Footer total
      if (sessions.length > 0) {
        document.getElementById('footer-total').textContent = fmtCost(allTotals().cost);
      } else {
        document.getElementById('footer-total').textContent = '$0.00';
      }

      // Event delegation — re-attach after innerHTML swap
      document.getElementById('branch-list').addEventListener('click', handleClick);
      document.getElementById('detail').addEventListener('click', handleClick);
    }

    function handleClick(e) {
      var el = e.target.closest('[data-action]');
      if (!el) { return; }
      var action = el.dataset.action;
      var branch = el.dataset.branch;

      if (action === 'select') {
        if (selectedBranch !== branch) {
          selectedBranch = branch;
          resetPending = false;
          render();
        }
      } else if (action === 'tab-branches') {
        if (sidebarView !== 'branches') {
          sidebarView = 'branches';
          render();
        }
      } else if (action === 'tab-days') {
        if (sidebarView !== 'days') {
          sidebarView = 'days';
          // Auto-select the most recent day if none selected yet
          if (!selectedDay) {
            var days = computeDailyByBranch();
            if (days.length > 0) { selectedDay = days[0].date; }
          }
          render();
        }
      } else if (action === 'select-day') {
        var day = el.dataset.day;
        if (selectedDay !== day) {
          selectedDay = day;
          render();
        }
      } else if (action === 'reset-ask') {
        resetPending = true;
        render();
      } else if (action === 'reset-cancel') {
        resetPending = false;
        render();
      } else if (action === 'reset-confirm') {
        resetPending = false;
        vscode.postMessage({ type: 'resetBranch', branchName: branch });
      }
    }

    // ── Messages from extension ──────────────────────────────
    window.addEventListener('message', function (event) {
      var msg = event.data;
      if (msg.type !== 'update') { return; }

      var prev = selectedBranch;
      sessions      = msg.sessions;
      currentBranch = msg.currentBranch;
      config        = msg.config;

      // Keep branch selection valid; fall back to current branch
      var stillValid = false;
      for (var i = 0; i < sessions.length; i++) {
        if (sessions[i].branchName === prev) { stillValid = true; break; }
      }
      if (!stillValid) {
        selectedBranch = currentBranch;
        resetPending   = false;
      }

      // Auto-select most recent day whenever we're in days view with no selection
      if (sidebarView === 'days' && !selectedDay) {
        var days = computeDailyByBranch();
        if (days.length > 0) { selectedDay = days[0].date; }
      }

      // Sync rate input only when not focused (avoid clobbering user input)
      var rateEl = document.getElementById('rate-input');
      if (rateEl && document.activeElement !== rateEl) {
        rateEl.value = String(config.hourlyRate);
      }

      render();
    });

    // ── Footer: apply rate ───────────────────────────────────
    document.getElementById('btn-apply').addEventListener('click', function () {
      var inp = document.getElementById('rate-input');
      var val = parseFloat(inp.value);
      if (!isNaN(val) && val > 0) {
        vscode.postMessage({ type: 'setRate', hourlyRate: val });
      }
    });

    document.getElementById('rate-input').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        document.getElementById('btn-apply').click();
      }
    });

    // ── Request initial data ─────────────────────────────────
    vscode.postMessage({ type: 'requestUpdate' });

  }());
  </script>
</body>
</html>`;
}
