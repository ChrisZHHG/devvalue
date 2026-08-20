/* Attest prototype — rendering only.
 *
 * Every number on the page comes from window.__TIMESHEET_DEMO__, which is
 * produced at build time by src/core/timesheet. Nothing is computed here that
 * the engine did not already decide; this file lays it out and lets you click
 * into the evidence.
 */
(() => {
  const data = window.__TIMESHEET_DEMO__;
  const { meta, engagements, draft, blocks, signals, stats, learning } = data;

  /* ── Colour assignment ───────────────────────────────────────────────────
   * Slots are bound to engagement codes once, in sorted order, so a colour
   * always means the same engagement no matter which rows are on screen.
   * Client codes are numeric and sort ahead of the INT-* internal buckets,
   * which puts the chargeable work in the leading slots.                     */
  const SLOTS = ['--s1', '--s2', '--s3', '--s4', '--s5', '--s6'];
  const PALE = new Set(['--s4']); // needs dark ink on top
  const colourOf = new Map();
  [...engagements].sort((a, b) => a.code.localeCompare(b.code)).forEach((e, i) => {
    colourOf.set(e.code, SLOTS[i % SLOTS.length]);
  });
  const UNASSIGNED = meta.policy.unattributedCode;

  const engById = new Map(engagements.map(e => [e.code, e]));
  const blockById = new Map(blocks.map(b => [b.id, b]));

  const css = code => (code === UNASSIGNED ? 'var(--unassigned)' : `var(${colourOf.get(code)})`);
  const isPale = code => code !== UNASSIGNED && PALE.has(colourOf.get(code));
  const label = code =>
    code === UNASSIGNED ? 'Unassigned' : `${engById.get(code).clientName} — ${engById.get(code).name}`;
  /** Client name for chargeable work; the bucket's own name for internal time. */
  const partyOf = code => {
    if (code === UNASSIGNED) { return 'Unassigned'; }
    const eng = engById.get(code);
    return eng.chargeable ? eng.clientName : eng.name;
  };

  const CONFIDENCE = {
    high: { icon: '✓', text: 'High' },
    medium: { icon: '!', text: 'Medium' },
    low: { icon: '▲', text: 'Low' },
    unattributed: { icon: '?', text: 'Unassigned' },
  };
  const METER = { high: 'var(--good)', medium: 'var(--warning)', low: 'var(--serious)', unattributed: 'var(--unassigned)' };

  const el = (tag, cls, html) => {
    const node = document.createElement(tag);
    if (cls) { node.className = cls; }
    if (html !== undefined) { node.innerHTML = html; }
    return node;
  };
  const h = n => `${n.toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1')}h`;
  const dayName = iso =>
    new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'UTC' });
  const dayLabel = iso => `${dayName(iso)} ${iso.slice(8)}/${iso.slice(5, 7)}`;
  const clock = ms =>
    new Date(ms).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });

  /* ── Tooltip ─────────────────────────────────────────────────────────── */
  const tip = document.getElementById('tip');
  function bindTip(node, html) {
    node.addEventListener('pointerenter', () => { tip.innerHTML = html; tip.style.opacity = '1'; });
    node.addEventListener('pointermove', ev => {
      const pad = 14;
      const x = Math.min(ev.clientX + pad, window.innerWidth - tip.offsetWidth - 8);
      tip.style.left = `${Math.max(8, x)}px`;
      tip.style.top = `${Math.max(8, ev.clientY - tip.offsetHeight - pad)}px`;
    });
    node.addEventListener('pointerleave', () => { tip.style.opacity = '0'; });
  }

  /* ── Stat tiles ──────────────────────────────────────────────────────── */
  const needsReview = draft.lines.filter(l => l.confidence !== 'high');
  const unassignedRows = needsReview.filter(l => l.confidence === 'unattributed').length;

  const tiles = [
    {
      lbl: 'Week reconstructed', val: draft.totalHours, unit: 'h',
      note: `${stats.signalCount} signals · ${Object.keys(stats.signalsBySource).length} sources`,
    },
    {
      lbl: 'Chargeable', val: draft.chargeableHours, unit: 'h',
      note: `${Math.round((draft.chargeableHours / draft.totalHours) * 100)}% of reconstructed time`,
    },
    {
      lbl: 'Submittable unedited', val: Math.round(draft.autoAcceptRatio * 100), unit: '%',
      note: `${draft.lines.length - needsReview.length} of ${draft.lines.length} rows are high confidence`,
    },
    {
      lbl: 'Rows needing a human', val: needsReview.length, unit: '',
      note: `${unassignedRows} unassigned · ${needsReview.length - unassignedRows} mixed confidence`,
    },
  ];
  const tilesRoot = document.getElementById('tiles');
  for (const t of tiles) {
    const node = el('div', 'tile');
    node.append(
      el('div', 'tile-lbl', t.lbl),
      el('div', 'tile-val', `${t.val}${t.unit ? `<small>${t.unit}</small>` : ''}`),
      el('div', 'tile-note', t.note),
    );
    tilesRoot.append(node);
  }
  document.getElementById('badge-engine').textContent =
    `${stats.signalCount} signals → ${stats.timeBlockCount} time blocks → ${stats.blockCount} attributed blocks`;
  document.getElementById('draft-week').textContent = `Week of ${draft.weekStart}`;
  document.getElementById('foot-meta').textContent =
    `Generated ${meta.generatedAt.slice(0, 10)} · idle budget ${meta.policy.idleBudgetSeconds / 60} min ` +
    `(×${meta.policy.flowMultiplier} under sustained density) · rounding ${meta.policy.roundingIncrement}h · ` +
    `${stats.agentMinutes} minutes of AI agent time attributed to an engagement`;

  /* ── Legend ──────────────────────────────────────────────────────────── */
  const legend = document.getElementById('legend');
  const shown = [...new Set(draft.lines.map(l => l.engagementCode))].sort((a, b) =>
    a === UNASSIGNED ? 1 : b === UNASSIGNED ? -1 : a.localeCompare(b),
  );
  for (const code of shown) {
    const item = el('span', 'lg');
    const sw = el('span', code === UNASSIGNED ? 'swatch hatched' : 'swatch');
    sw.style.backgroundColor = css(code);
    const eng = engById.get(code);
    item.append(sw, el('span', null,
      code === UNASSIGNED
        ? 'Unassigned — no authoritative match'
        : `${partyOf(code)}<span class="eng-code"> · ${code}</span>${eng.chargeable ? '' : ' · non-chargeable'}`,
    ));
    legend.append(item);
  }

  /* ── Week allocation chart ───────────────────────────────────────────── */
  const SCALE_H = Math.max(meta.policy.standardDayHours, ...draft.coverage.map(c => c.attributedHours + c.unattributedHours));
  const week = document.getElementById('week');
  for (const day of meta.days) {
    const lines = draft.lines
      .filter(l => l.date === day)
      .sort((a, b) =>
        a.engagementCode === UNASSIGNED ? 1 : b.engagementCode === UNASSIGNED ? -1
          : a.engagementCode.localeCompare(b.engagementCode));
    const used = lines.reduce((s, l) => s + l.hours, 0);

    week.append(el('div', 'c-day', dayLabel(day)));
    const track = el('div', 'track');
    const bar = el('div', 'bar');

    for (const line of lines) {
      const pct = (line.hours / SCALE_H) * 100;
      const seg = el('div', `seg${line.engagementCode === UNASSIGNED ? ' hatched' : ''}${isPale(line.engagementCode) ? ' pale' : ''}`);
      seg.style.cssText = `flex:0 0 ${pct}%; background-color:${css(line.engagementCode)}`;
      if (line.hours >= 0.75) {
        seg.append(el('span', 'seg-lbl', h(line.hours)));
      }
      bindTip(seg,
        `<b>${label(line.engagementCode)}</b><br>${h(line.hours)} · ${CONFIDENCE[line.confidence].text} confidence` +
        `<br><span class="t-dim">${line.narrative}</span>`);
      bar.append(seg);
    }
    track.append(bar);

    const gap = meta.policy.standardDayHours - used;
    if (gap > 0.05) {
      const fill = el('div', 'gapfill', `<span>${h(gap)} unexplained</span>`);
      fill.style.cssText = `left:${(used / SCALE_H) * 100}%; width:${(gap / SCALE_H) * 100}%`;
      bindTip(fill,
        `<b>${h(gap)} unexplained</b><br><span class="t-dim">The standard day expects ` +
        `${meta.policy.standardDayHours}h; signals account for ${h(used)}. Left for the reviewer to fill or dismiss.</span>`);
      track.append(fill);
    }
    week.append(track);
  }
  const axis = el('div', 'c-axis');
  for (let t = 0; t <= SCALE_H; t += 2) { axis.append(el('span', null, `${t}h`)); }
  week.append(axis);

  /* ── Confidence meter ───────────────────────────────────────────────── */
  const byConf = {};
  for (const line of draft.lines) {
    byConf[line.confidence] = (byConf[line.confidence] || 0) + line.hours;
  }
  const meter = document.getElementById('meter');
  const key = document.getElementById('meter-key');
  for (const level of ['high', 'medium', 'low', 'unattributed']) {
    const hours = byConf[level] || 0;
    if (hours <= 0) { continue; }
    const seg = el('div');
    seg.style.cssText = `flex:0 0 ${(hours / draft.totalHours) * 100}%; background-color:${METER[level]}`;
    bindTip(seg, `<b>${CONFIDENCE[level].text}</b><br>${h(hours)} of ${h(draft.totalHours)}`);
    meter.append(seg);
    key.append(el('span', 'lg',
      `<span class="pill ${level}">${CONFIDENCE[level].icon} ${CONFIDENCE[level].text}</span> ${h(hours)}`));
  }

  /* ── Draft table ─────────────────────────────────────────────────────── */
  const rows = document.getElementById('rows');

  /** The evidence drawer: the source records, and why each one counted. */
  function detailRow(line) {
    const tr = el('tr', 'detail');
    const td = el('td');
    td.colSpan = 6;

    const lineBlocks = line.blockIds.map(id => blockById.get(id)).filter(Boolean);
    const flagged = lineBlocks.filter(b => b.confidence !== 'high');
    td.append(el('div', 'ev-head',
      `Reconstructed from <b>${lineBlocks.length}</b> block${lineBlocks.length === 1 ? '' : 's'} of time · ` +
      `raw ${h(line.rawHours)} rounded to ${h(line.hours)}` +
      (flagged.length ? ` · <b>${flagged.length}</b> flagged for review` : '')));

    const list = el('div', 'ev-list');
    for (const ev of line.evidence) {
      const row = el('div', 'ev');
      row.append(
        el('span', 'ev-src', ev.source),
        el('span', null, ev.subject),
        el('span', 'ev-why', `${ev.matcherKind} · ${ev.matcherValue}`),
      );
      list.append(row);
    }
    if (!line.evidence.length) {
      list.append(el('div', 'ev',
        '<span class="ev-src">—</span><span>No matcher fired against any configured engagement.</span><span class="ev-why"></span>'));
    }
    td.append(list);

    // A rejected lead is more useful to a reviewer than a blank.
    const lead = lineBlocks.map(b => b.best).find(b => b);
    if (line.confidence === 'unattributed' && lead) {
      td.append(el('div', 'reject',
        `Leading candidate was <b>${lead.engagementCode}</b>, held back: matched on ` +
        `${[...new Set(lead.evidence.map(e => e.matcherKind))].join(' / ')} only — no folder, ` +
        `counterparty domain, repository or ticket project ties this time to that engagement.`));
    }
    const tie = lineBlocks.find(b => b.confidence === 'low' && b.runnerUp);
    if (tie) {
      td.append(el('div', 'reject',
        `${h(tie.focusSeconds / 3600)} inside this row scored <b>${tie.best.engagementCode}</b> and ` +
        `<b>${tie.runnerUp.engagementCode}</b> within ${(tie.margin * 100).toFixed(0)} points of each other ` +
        `(“${tie.signals[0].subject}”). The engine will not split a shared call on its own.`));
    }
    if (line.pooledFromCodes?.length) {
      td.append(el('div', 'reject',
        `Absorbed ${line.pooledFromCodes.length} sub-quarter-hour fragment(s) from ` +
        `${line.pooledFromCodes.join(', ')} — same chargeability, so nothing crossed onto a client.`));
    }

    tr.append(td);
    return tr;
  }

  const rendered = [];
  for (const line of draft.lines) {
    const tr = el('tr', 'row');
    const eng = engById.get(line.engagementCode);
    const sw = el('span', line.engagementCode === UNASSIGNED ? 'swatch hatched' : 'swatch');
    sw.style.backgroundColor = css(line.engagementCode);

    const cName = el('td');
    const wrap = el('div', 'eng');
    wrap.append(sw, el('span', null, partyOf(line.engagementCode)));
    cName.append(wrap, el('div', 'eng-code',
      `${line.engagementCode}${eng && !eng.chargeable ? ' · non-chargeable' : ''}`));

    const conf = CONFIDENCE[line.confidence];
    tr.append(
      el('td', null, `${dayName(line.date)}<div class="eng-code">${line.date}</div>`),
      cName,
      el('td', 'num mono', `<b>${h(line.hours)}</b>`),
      el('td', null, `<span class="pill ${line.confidence}">${conf.icon} ${conf.text}</span>`),
      el('td', 'narr', line.narrative),
      el('td', 'num', `<span class="tag">${line.evidence.length || '—'} ▸</span>`),
    );

    const detail = detailRow(line);
    detail.style.display = 'none';
    tr.addEventListener('click', () => {
      const open = detail.style.display !== 'none';
      detail.style.display = open ? 'none' : 'table-row';
      tr.classList.toggle('open', !open);
    });

    rows.append(tr, detail);
    rendered.push({ line, tr });
  }

  document.getElementById('accept').addEventListener('click', ev => {
    const button = ev.currentTarget;
    let accepted = 0;
    for (const { line, tr } of rendered) {
      if (line.confidence === 'high') { tr.classList.add('accepted'); accepted++; }
    }
    button.disabled = true;
    button.textContent = `${accepted} rows accepted · ${needsReview.length} left for you`;
  });

  /* ── Signal timeline ─────────────────────────────────────────────────── */
  const chips = document.getElementById('daychips');
  const tl = document.getElementById('timeline');
  const tlHours = document.getElementById('tl-hours');
  const tlNote = document.getElementById('tl-note');
  const dayOf = ms => new Date(ms).toISOString().slice(0, 10);

  function drawDay(day) {
    tl.innerHTML = '';
    tlHours.innerHTML = '';
    const dayBlocks = blocks.filter(b => dayOf(b.startedAt) === day);
    const daySignals = signals.filter(s => dayOf(s.startedAt) === day);
    if (!dayBlocks.length) { return; }

    const from = Date.parse(`${day}T08:00:00Z`);
    const to = Date.parse(`${day}T18:00:00Z`);
    const x = ms => ((ms - from) / (to - from)) * 100;

    for (const block of dayBlocks) {
      const bar = el('div',
        `tl-block${block.engagementCode === UNASSIGNED ? ' hatched' : ''}` +
        `${block.confidence === 'high' ? '' : ' flagged'}`);
      const left = Math.max(0, x(block.startedAt));
      bar.style.cssText =
        `left:${left}%; width:${Math.max(0.4, x(block.endedAt) - left)}%; ` +
        `background-color:${css(block.engagementCode)}`;
      bindTip(bar,
        `<b>${label(block.engagementCode)}</b><br>${clock(block.startedAt)}–${clock(block.endedAt)} · ` +
        `${h(block.focusSeconds / 3600)} · ${CONFIDENCE[block.confidence].text}<br>` +
        `<span class="t-dim">${block.signals.length} signals` +
        `${block.flowExtended ? ' · held open by sustained density' : ''}</span>`);
      tl.append(bar);
    }

    for (const signal of daySignals) {
      const owner = dayBlocks.find(b => signal.startedAt >= b.startedAt && signal.startedAt <= b.endedAt);
      const dot = el('div', 'tl-sig');
      dot.style.cssText =
        `left:${x(signal.startedAt)}%; background-color:${owner ? css(owner.engagementCode) : 'var(--ink-3)'}`;
      tl.append(dot);
    }

    for (let hour = 8; hour <= 18; hour += 2) { tlHours.append(el('span', null, `${hour}:00`)); }

    const flagged = dayBlocks.filter(b => b.confidence !== 'high');
    tlNote.innerHTML =
      `<b>${daySignals.length}</b> signals became <b>${dayBlocks.length}</b> blocks. ` +
      (flagged.length
        ? `${flagged.length} could not be placed confidently: ` +
          flagged.map(b => `“${b.signals[0].subject}”`).join(', ') + '.'
        : 'All placed with authoritative evidence.');
  }

  meta.days.forEach((day, i) => {
    const chip = el('button', 'btn', dayLabel(day));
    chip.setAttribute('aria-pressed', String(i === 2));
    chip.addEventListener('click', () => {
      chips.querySelectorAll('.btn').forEach(b => b.setAttribute('aria-pressed', 'false'));
      chip.setAttribute('aria-pressed', 'true');
      drawDay(day);
    });
    chips.append(chip);
  });
  drawDay(meta.days[2]);

  /* ── Learning panel ──────────────────────────────────────────────────── */
  const learnRoot = document.getElementById('learn');
  const best = [...learning].sort((a, b) => b.matchers.length - a.matchers.length)[0];

  if (best) {
    const block = blockById.get(best.blockId);
    const left = el('div');
    left.append(
      el('div', 'eyebrow', 'Unassigned block'),
      el('h3', null, `${h(block.focusSeconds / 3600)} · ${clock(block.startedAt)}–${clock(block.endedAt)}`),
      el('p', 'sec-sub',
        `${block.signals.length} signals the engine could not place. It had a leading guess — ` +
        `<b>${block.best ? block.best.engagementCode : 'none'}</b> — and refused it, because the only thing ` +
        `linking them was a word in a subject line.`),
    );
    const list = el('div', 'ev-list');
    list.style.marginTop = '12px';
    for (const signal of block.signals.slice(0, 5)) {
      list.append(el('div', 'ev',
        `<span class="ev-src">${signal.source}</span><span>${signal.subject}</span>` +
        `<span class="ev-why">${signal.path ? signal.path.split('/').slice(0, 3).join('/') : '—'}</span>`));
    }
    if (block.signals.length > 5) {
      list.append(el('div', 'ev',
        `<span class="ev-src">+${block.signals.length - 5}</span><span>more of the same</span><span class="ev-why"></span>`));
    }
    left.append(list);

    const right = el('div');
    right.append(
      el('div', 'eyebrow', 'One correction'),
      el('h3', null, `Assign to ${best.suggestedLabel}`),
      el('p', 'sec-sub',
        'A reviewer picks the engagement once. What the system keeps is not the answer but the ' +
        'reusable features behind it — the folder the work lives in, and the counterparty on the thread.'),
    );
    for (const matcher of best.matchers) {
      right.append(el('div', 'rule',
        `<span class="kind">${matcher.kind}</span><code>${matcher.value}</code>` +
        `<span style="flex:1"></span><span class="tag">weight ${matcher.weight}</span>`));
    }
    const apply = el('button', 'btn btn-primary', `Apply correction · learns ${best.matchers.length} rules`);
    apply.style.marginTop = '14px';
    apply.addEventListener('click', () => {
      apply.disabled = true;
      apply.textContent = `${best.matchers.length} rules added to ${best.suggestedCode}`;
      right.append(el('p', 'sec-sub',
        `Next week this engagement's folder and counterparty are authoritative locators. The same ` +
        `${h(block.focusSeconds / 3600)} would be drafted as high confidence with no review — and so ` +
        `would every hour that follows on it.`));
    });
    right.append(apply);

    learnRoot.append(left, right);
  }

  /* ── Theme ───────────────────────────────────────────────────────────── */
  const themeBtn = document.getElementById('theme');
  const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
  const setTheme = mode => {
    document.documentElement.dataset.theme = mode;
    themeBtn.textContent = mode === 'dark' ? 'Light' : 'Dark';
  };
  setTheme(prefersDark ? 'dark' : 'light');
  themeBtn.addEventListener('click', () => {
    setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
  });
})();
