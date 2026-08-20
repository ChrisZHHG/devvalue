/* Attest — the explainer page.
 *
 * Every figure here is drawn from window.__TIMESHEET_DEMO__, which the engine in
 * src/core/timesheet produces at build time. The diagrams are explanatory, but
 * the shapes in them are real: the dots are the actual signals, the bars are the
 * actual blocks, the refusal is an attribution the engine actually declined.
 */
(() => {
  const data = window.__TIMESHEET_DEMO__;
  const { meta, engagements, draft, blocks, timeBlocks, signals, stats } = data;
  const UNASSIGNED = meta.policy.unattributedCode;

  /* Colour slots bound to engagement codes once, in sorted order, so a colour
     always means the same engagement across every figure on the page. */
  const SLOTS = ['--s1', '--s2', '--s3', '--s4', '--s5', '--s6'];
  const PALE = new Set(['--s4']);
  const slot = new Map();
  [...engagements].sort((a, b) => a.code.localeCompare(b.code))
    .forEach((e, i) => slot.set(e.code, SLOTS[i % SLOTS.length]));

  const engById = new Map(engagements.map(e => [e.code, e]));
  const css = c => (c === UNASSIGNED ? 'var(--unassigned)' : `var(${slot.get(c)})`);
  const pale = c => c !== UNASSIGNED && PALE.has(slot.get(c));
  const party = c => {
    if (c === UNASSIGNED) { return 'Unassigned'; }
    const e = engById.get(c);
    return e.chargeable ? e.clientName : e.name;
  };

  const el = (tag, cls, html) => {
    const n = document.createElement(tag);
    if (cls) { n.className = cls; }
    if (html !== undefined) { n.innerHTML = html; }
    return n;
  };
  const hrs = n => `${n.toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1')}`;
  const wd = iso => new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'UTC' });
  const clock = ms => new Date(ms).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
  const dayOf = ms => new Date(ms).toISOString().slice(0, 10);

  const tip = document.getElementById('tip');
  const bindTip = (node, html) => {
    node.addEventListener('pointerenter', () => { tip.innerHTML = html; tip.style.opacity = '1'; });
    node.addEventListener('pointermove', ev => {
      tip.style.left = `${Math.max(8, Math.min(ev.clientX + 14, innerWidth - tip.offsetWidth - 8))}px`;
      tip.style.top = `${Math.max(8, ev.clientY - tip.offsetHeight - 14)}px`;
    });
    node.addEventListener('pointerleave', () => { tip.style.opacity = '0'; });
  };

  /* Row order: chargeable client work first, then internal buckets, unassigned last. */
  const codes = [...new Set(draft.lines.map(l => l.engagementCode))].sort((a, b) => {
    const rank = c => (c === UNASSIGNED ? 2 : engById.get(c).chargeable ? 0 : 1);
    return rank(a) - rank(b) || a.localeCompare(b);
  });
  const cell = new Map(draft.lines.map(l => [`${l.engagementCode}|${l.date}`, l]));

  /* ── 1 & 7 · The timesheet grid, empty then drafted ────────────────────── */
  function grid(target, filled, rows = codes) {
    const root = document.getElementById(target);
    const head = el('div', 'tsrow');
    head.append(el('div', 'tsh', 'Engagement'));
    for (const d of meta.days) { head.append(el('div', 'tsh', `${wd(d)} ${d.slice(8)}`)); }
    head.append(el('div', 'tsh', 'Total'));
    root.append(head);

    for (const code of rows) {
      const row = el('div', 'tsrow');
      const lbl = el('div', 'tsc lbl');
      const sw = el('span', code === UNASSIGNED ? 'dot hatched' : 'dot');
      sw.style.backgroundColor = filled ? css(code) : 'var(--axis)';
      lbl.append(sw, el('span', null,
        `${party(code)}${code === UNASSIGNED ? '' : `<span style="color:var(--ink-3)"> · ${code}</span>`}`));
      row.append(lbl);

      let total = 0;
      for (const day of meta.days) {
        const line = cell.get(`${code}|${day}`);
        if (!filled) {
          row.append(el('div', 'tsc empty', '—'));
          continue;
        }
        if (!line) { row.append(el('div', 'tsc empty', '·')); continue; }
        total += line.hours;
        const c = el('div', 'tsc');
        const fill = el('span', `fill${pale(code) ? ' pale' : ''}${code === UNASSIGNED ? ' grey' : ''}`, hrs(line.hours));
        if (code !== UNASSIGNED) { fill.style.backgroundColor = css(code); }
        bindTip(fill, `<b>${party(code)}</b><br>${hrs(line.hours)}h · ${line.confidence}<br>${line.narrative}`);
        c.append(fill);
        row.append(c);
      }
      row.append(el('div', 'tsc tot', filled ? hrs(total) : '?'));
      root.append(row);
    }

    const foot = el('div', 'tsrow');
    foot.append(el('div', 'tsc lbl tot', 'Day total'));
    for (const day of meta.days) {
      const t = draft.lines.filter(l => l.date === day).reduce((s, l) => s + l.hours, 0);
      foot.append(el('div', `tsc tot${filled ? '' : ' empty'}`, filled ? hrs(t) : '?'));
    }
    foot.append(el('div', 'tsc tot', filled ? hrs(draft.totalHours) : '?'));
    root.append(foot);
  }
  // The blank form a person actually faces has no "unassigned" row — that row
  // only exists because the engine refuses to guess. Keep it out of scene 1.
  const formCodes = codes.filter(c => c !== UNASSIGNED);
  grid('grid-empty', false, formCodes);
  grid('grid-full', true);
  document.getElementById('ask-h').textContent =
    `${formCodes.length * meta.days.length} cells. From memory. ` +
    `${new Set(formCodes.filter(c => engById.get(c).chargeable).map(c => engById.get(c).clientName)).size} clients.`;
  document.getElementById('cap-empty').textContent =
    `${formCodes.length} engagement codes × ${meta.days.length} days. Every cell has to come from ` +
    `somewhere, and by Friday the only source left is memory.`;

  /* ── 2 · The dot field ─────────────────────────────────────────────────── */
  const LANE = { meeting: 6, calendar: 6, document: 19, code: 19, agent: 19, ticket: 19, mail: 32, chat: 32, desktop: 32 };
  const field = document.getElementById('field');
  const ownerOf = signal => blocks.find(b => signal.startedAt >= b.startedAt && signal.startedAt <= b.endedAt);

  for (const day of meta.days) {
    const wrap = el('div', 'fday');
    wrap.append(el('div', 'fday-lbl', `${wd(day)} ${day.slice(8)}`));
    const lanes = el('div', 'lanes');
    for (const y of [6, 19, 32]) {
      const rule = el('div', 'lane-rule');
      rule.style.top = `${y + 2}px`;
      lanes.append(rule);
    }
    const from = Date.parse(`${day}T08:00:00Z`);
    const to = Date.parse(`${day}T18:00:00Z`);

    for (const s of signals.filter(s => dayOf(s.startedAt) === day)) {
      const dot = el('div', 'sig');
      const owner = ownerOf(s);
      dot.style.cssText =
        `left:${((s.startedAt - from) / (to - from)) * 100}%; top:${LANE[s.source]}px; ` +
        `background-color:${owner ? css(owner.engagementCode) : 'var(--ink-3)'}`;
      bindTip(dot, `<b>${s.subject}</b><br>${s.source} · ${clock(s.startedAt)}`);
      lanes.append(dot);
    }
    wrap.append(lanes);
    field.append(wrap);
  }
  const ax = el('div', 'faxis');
  for (let t = 8; t <= 18; t += 2) { ax.append(el('span', null, `${t}:00`)); }
  field.append(ax);
  field.append(el('div', 'lanekey',
    '<span>top lane — meetings &amp; calls</span><span>middle — files, tickets, code, agents</span>' +
    '<span>bottom — mail &amp; chat</span>'));
  document.getElementById('cap-field').innerHTML =
    `<b>${stats.signalCount} traces</b> across the week, from ${Object.keys(stats.signalsBySource).length} ` +
    `kinds of system. Colour is which engagement each one turned out to belong to — at this ` +
    `point that is just texture. The useful observation is that the structure of the week is ` +
    `already visible to the naked eye.`;

  /* ── 4 · The mechanism: one real day, transformed four times ───────────
   * All four rows share one x-axis over the same day, so the reader watches the
   * same span get cut rather than comparing four unrelated pictures.            */
  const DAY = meta.days[2];
  const FROM = Date.parse(`${DAY}T08:00:00Z`);
  const TO = Date.parse(`${DAY}T18:00:00Z`);
  const px = ms => ((ms - FROM) / (TO - FROM)) * 100;

  const daySignals = signals.filter(s => dayOf(s.startedAt) === DAY);
  const dayTimeBlocks = timeBlocks.filter(b => dayOf(b.startedAt) === DAY);
  const dayBlocks = blocks.filter(b => dayOf(b.startedAt) === DAY);

  const dots = (top, coloured) => daySignals.map(s => {
    const owner = coloured ? ownerOf(s) : null;
    return `<div class="d" style="left:${px(s.startedAt)}%;top:${top}px` +
      `${owner ? `;background-color:${css(owner.engagementCode)}` : ''}"></div>`;
  }).join('');

  const bars = (list, coloured) => list.map(b => {
    const left = Math.max(0, px(b.startedAt));
    const width = Math.max(0.6, px(b.endedAt) - left);
    const cls = coloured && b.engagementCode === UNASSIGNED ? ' hatch' : '';
    const dash = coloured && b.confidence !== 'high' ? ' dash' : '';
    const colour = coloured ? css(b.engagementCode) : 'var(--axis)';
    const bar = `<div class="b${cls}${dash}" style="left:${left}%;width:${width}%;` +
      `background-color:${colour}"></div>`;
    return bar;
  }).join('');

  /* The gap between two consecutive blocks is time the engine threw away. That
     is the most reassuring thing about step 2, so it gets drawn and labelled. */
  const drops = list => list.slice(1).map((b, i) => {
    const previous = list[i];
    const left = px(previous.endedAt);
    const width = px(b.startedAt) - left;
    const minutes = Math.round((b.startedAt - previous.endedAt) / 60000);
    if (minutes < 20) { return ''; }
    return `<div class="drop" style="left:${left}%;width:${width}%"></div>` +
      `<div class="droplbl" style="left:${left + width / 2}%">${minutes} min dropped</div>`;
  }).join('');

  /* A cut mark belongs only where two blocks are contiguous — that is a context
     switch. A boundary with a gap in it is a dropped gap, already drawn above. */
  const cuts = list => list.slice(1)
    .filter((b, i) => b.startedAt === list[i].endedAt)
    .map(b => `<div class="cut" style="left:${px(b.startedAt)}%"></div>`).join('');

  const STEPS = [
    {
      n: '01', h: 'Signals',
      p: 'A file touched, a reply sent, a call attended. Metadata only — a title, a ' +
         'folder, a counterparty. Never contents.',
      viz: dots(23, false),
    },
    {
      n: '02', h: 'Was this person working?',
      p: `Gaps under ${meta.policy.idleBudgetSeconds / 60} minutes are credited — reading ` +
         'and reviewing are work. Longer ones are thrown away, so lunch is never billed.',
      viz: bars(dayTimeBlocks, false) + drops(dayTimeBlocks) + dots(40, false),
    },
    {
      n: '03', h: 'On what?',
      p: `The same span, re-cut wherever the subject changed: ${dayTimeBlocks.length} ` +
         `stretches became ${dayBlocks.length}. A boundary sits at the midpoint of the ` +
         'transition, so no time is created or destroyed.',
      viz: bars(dayBlocks, false) + cuts(dayBlocks) + dots(40, false),
    },
    {
      n: '04', h: 'Whose bill — and what proves it?',
      p: 'Each block scored against every engagement, keeping the winner, the runner-up ' +
         'it beat, and the source records behind both. Dashed = it would not place this alone.',
      viz: bars(dayBlocks, true) + dots(40, true),
    },
  ];

  const stepsRoot = document.getElementById('steps');
  for (const step of STEPS) {
    const row = el('div', 'srow');
    const txt = el('div', 'stxt');
    txt.append(el('div', 'fn', step.n), el('h3', null, step.h), el('p', null, step.p));
    row.append(txt, el('div', 'viz', step.viz));
    stepsRoot.append(row);
  }
  const sax = el('div', 'saxis');
  for (let t = 8; t <= 18; t += 2) { sax.append(el('span', null, `${t}:00`)); }
  stepsRoot.append(sax);

  document.getElementById('cap-steps').innerHTML =
    `One real day — ${wd(DAY)} ${DAY} — at each stage. ` +
    `<b>${daySignals.length} signals → ${dayTimeBlocks.length} stretches of working time → ` +
    `${dayBlocks.length} attributed blocks.</b> Hover any mark.`;

  /* ── 5 · The refusal ───────────────────────────────────────────────────── */
  const refused = blocks
    .filter(b => b.engagementCode === UNASSIGNED && b.best)
    .sort((a, b) => b.focusSeconds - a.focusSeconds)[0];

  if (refused) {
    const guessCode = refused.best.engagementCode;
    const reasons = [...new Set(refused.best.evidence.map(e => `${e.matcherKind} · ${e.matcherValue}`))];

    const no = el('div', 'rcard no');
    no.append(
      el('div', 'rk', 'Leading candidate'),
      el('div', 'rv', `<span class="strike">${party(guessCode)}</span>`),
      el('div', 'rw',
        `<code>${guessCode}</code> — matched only on ${reasons.map(r => `<b>${r}</b>`).join(', ')}. ` +
        `Two engagements in the same practice both produce documents titled that way.`),
    );

    const arrow = el('div', 'arrowcol', '→');

    const yes = el('div', 'rcard');
    yes.append(
      el('div', 'rk', 'What it filed instead'),
      el('div', 'rv', `Unassigned · ${hrs(refused.focusSeconds / 3600)}h`),
      el('div', 'rw',
        'No folder, counterparty domain, repository or ticket project tied this time to that ' +
        'engagement — so it is handed to a person, with the rejected guess attached.'),
    );
    for (const s of refused.signals.slice(0, 3)) {
      yes.append(el('div', 'evline',
        `<span class="es">${s.source}</span><span>${s.subject}</span>`));
    }

    document.getElementById('refuse').append(no, arrow, yes);

    const unHours = draft.lines
      .filter(l => l.engagementCode === UNASSIGNED)
      .reduce((s, l) => s + l.hours, 0);
    document.getElementById('cap-refuse').innerHTML =
      `Three rows this week are unassigned — <b>${hrs(unHours)} of ${hrs(draft.totalHours)} hours</b>. ` +
      `That is the tool working. A system that quietly rounded the week up to 40 would be easier ` +
      `to demo and impossible to defend.`;
  }

  /* ── 6 · Human hours vs supervised agent time ─────────────────────────── */
  const agentDay = meta.days[3];
  const agentHours = signals
    .filter(s => s.source === 'agent' && dayOf(s.startedAt) === agentDay)
    .reduce((s, sig) => s + (sig.endedAt - sig.startedAt) / 3_600_000, 0);
  const dayLine = draft.lines
    .filter(l => l.date === agentDay)
    .sort((a, b) => b.hours - a.hours)[0];
  const directHours = dayLine.hours - agentHours;

  const agentRoot = document.getElementById('agent');
  agentRoot.append(el('div', 'rk',
    `<span style="font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;` +
    `color:var(--ink-3)">${wd(agentDay)} · ${party(dayLine.engagementCode)} · ${hrs(dayLine.hours)}h billed</span>`));
  const bar = el('div', 'sbar');
  const a = el('div', null, `${hrs(directHours)}h person working`);
  a.style.cssText = `flex:0 0 ${(directHours / dayLine.hours) * 100}%; background-color:${css(dayLine.engagementCode)}`;
  const b = el('div', null, `${hrs(agentHours)}h supervising an agent`);
  b.style.cssText =
    `flex:0 0 ${(agentHours / dayLine.hours) * 100}%; background-color:var(--s1); ` +
    `background-image:repeating-linear-gradient(45deg,rgba(255,255,255,.28) 0 4px,transparent 4px 8px)`;
  bar.append(a, b);
  agentRoot.append(bar);
  agentRoot.append(el('div', 'eq',
    `<span class="strike2">delivered value = hours × rate</span><br>` +
    `<b>delivered value = human focus × rate&nbsp; +&nbsp; agent compute</b>`));

  /* ── 7 · Outcome numbers ─────────────────────────────────────────────── */
  const needsHuman = draft.lines.filter(l => l.confidence !== 'high').length;
  const NUMS = [
    { v: stats.signalCount, u: '', l: 'traces read' },
    { v: hrs(draft.totalHours), u: 'h', l: 'week reconstructed' },
    { v: Math.round(draft.autoAcceptRatio * 100), u: '%', l: 'submittable as-is' },
    { v: needsHuman, u: '', l: 'rows asking for a human' },
  ];
  const numsRoot = document.getElementById('nums');
  for (const n of NUMS) {
    const node = el('div', 'num');
    node.append(el('div', 'nv', `${n.v}${n.u ? `<small>${n.u}</small>` : ''}`), el('div', 'nl', n.l));
    numsRoot.append(node);
  }
  document.getElementById('foot').textContent =
    `${stats.signalCount} signals → ${stats.timeBlockCount} time blocks → ${stats.blockCount} ` +
    `attributed blocks → ${draft.lines.length} rows. Idle budget ` +
    `${meta.policy.idleBudgetSeconds / 60} min, ×${meta.policy.flowMultiplier} under sustained ` +
    `density; rounding ${meta.policy.roundingIncrement}h, redistributed per day so no day total moves.`;

  /* ── Theme ───────────────────────────────────────────────────────────── */
  const btn = document.getElementById('theme');
  const set = m => { document.documentElement.dataset.theme = m; btn.textContent = m === 'dark' ? 'Light' : 'Dark'; };
  set(matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  btn.addEventListener('click', () =>
    set(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'));
})();
