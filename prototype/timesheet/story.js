/* Attest — explainer page. Four panels, then the provenance of one real row,
 * then the mechanism. Every number and every identifier shown is read from
 * window.__TIMESHEET_DEMO__, which the engine in src/core/timesheet produces.
 * Text lives in T so the page can switch language without re-rendering logic. */
(() => {
const D = window.__TIMESHEET_DEMO__;
const { meta, engagements, draft, blocks, timeBlocks, signals, stats } = D;
const UN = meta.policy.unattributedCode;

/* ── copy ──────────────────────────────────────────────────────────────── */
const T = {
  zh: {
    deep: '完整草稿 →', lang: 'EN',
    h1: '工时表自己填好。<br>每一小时都追得到来源。',
    hs: '你已经把活干完了 —— 会议、邮件、文件、工单，全都留了记录。没有理由再让人凭记忆填一遍表。',
    panels: [
      { q: '① 现在是什么情况', a: '周五 17:40。<em>{cells} 个空格子</em>，四个客户。' },
      { q: '② 做不了什么', a: '周一上午干了什么？<em>想不起来了。</em>' },
      { q: '③ 但其实有什么', a: '会议、邮件、文件、工单、活动窗口 —— <b>全都记着。</b>' },
      { q: '④ 应该是什么样', a: '表已经填好。人<b>只需要确认。</b>' },
    ],
    kSrc: '数据来源', hSrc: '这 {h} 小时，是从哪几条记录里长出来的。',
    lSrc: '不猜。不读内容。只读事务所本来就为合规留着的元数据 —— 路径、域名、项目号、前台应用。',
    srcHdr: '真实来源记录', outHdr: '生成的这一行',
    never: ['不读邮件正文', '不截屏', '不记按键', '不上传文件内容', '不做个人排名'],
    cSrc: '引擎共读 9 类信号：{kinds}。Graph 通话记录保留 30 天、Purview 审计日志 180 天 —— 所以这类工具没法补录历史，只能从打开那天开始记。',
    kTop: '为什么这件事只能在顶上做', hTop: '痕迹在云上，工具就得在云上。',
    panePer: { t: '每人装一个', s: '每个人自己装、自己配、自己授权。4000 次谈判。' },
    paneTop: { t: '顶上连一次', s: '一个管理员，同意一次。下游每个人只收到一张草稿。' },
    walls: [
      { i: '🔒', t: '权限', d: '租户级读权限要 Global Admin。大所直接关掉 user consent —— 连读自己的日历都装不上。没有自下而上这条路。' },
      { i: '👁', t: '隐私', d: '在电脑上盯着人是监控，该被反对。在租户层只读合规本来就留的元数据。' },
      { i: '🗂', t: '分类', d: '哪个文件夹、哪个客户域名、哪个项目号 —— 全所只需定义一次，不该让 4000 人各录一遍。' },
    ],
    kHow: '原理', hHow: '四步。每步只回答一个问题。',
    steps: [
      { t: '① 信号', d: '一次文件改动、一封回信、一场会议。只有元数据。' },
      { t: '② 人在不在干活？', d: '{gap} 分钟以内的间隔算工作 —— 看和想也是干活。超过就丢掉，午饭不会被计费。' },
      { t: '③ 在干哪个项目？', d: '同一段时间，在换了对象的地方切开：{tb} 段变 {b} 块。' },
      { t: '④ 算谁的账？凭什么？', d: '每块和每个项目打分，留下赢家、被它压过的第二名，以及双方的原始记录。虚线 = 单凭这些不敢定。' },
    ],
    cHow: '这是真实的一天 —— {day}。{s} 条信号 → {tb} 段工作时间 → {b} 个已归因的块。鼠标放上去看每一条。',
    kOut: '结果', hOut: '同一周，自动填好了。',
    lOut: '是<b>草稿</b>，不是提交。人还是要点确认；引擎不确定的那几行会主动举手。',
    nums: ['条痕迹', '小时重建', '可直接提交', '行需要人看'],
    cta: '看每一小时的证据链 →',
    f1: '<b>数据全部为合成。</b>Northgate Advisory 及其客户均为虚构。页面上每一个小时、颜色、置信度标签都是构建时由 <code>src/core/timesheet/</code> 真实算出来的，不是手写的。',
    f2: '业内普遍估计手工填报会漏掉 8–12% 的可计费工时。',
  },
  en: {
    deep: 'Full draft →', lang: '中文',
    h1: 'The timesheet fills itself.<br>Every hour traces back.',
    hs: 'You already did the work — and the meetings, mail, files and tickets all recorded it. There is no reason to make a person reconstruct the week from memory.',
    panels: [
      { q: '① The situation', a: 'Friday 17:40. <em>{cells} blank cells</em>, four clients.' },
      { q: '② What you cannot do', a: 'What did you do Monday morning? <em>Gone.</em>' },
      { q: '③ What is actually there', a: 'Meetings, mail, files, tickets, focus windows — <b>all of it was recorded.</b>' },
      { q: '④ What it should be', a: 'The sheet is already filled. A person <b>just confirms.</b>' },
    ],
    kSrc: 'Provenance', hSrc: 'Where these {h} hours actually came from.',
    lSrc: 'No guessing, no contents. Only the metadata the firm already retains for compliance — paths, domains, project keys, foreground app.',
    srcHdr: 'Source records', outHdr: 'The row it produced',
    never: ['No mail bodies', 'No screenshots', 'No keystrokes', 'No file contents', 'No personal rankings'],
    cSrc: 'Nine signal kinds in all: {kinds}. Graph call records are retained 30 days, Purview audit logs 180 — so a tool like this cannot backfill history; it starts the day it is switched on.',
    kTop: 'Why this can only be built at the top', hTop: 'The traces live in the cloud. So does the tool.',
    panePer: { t: 'A tool each person installs', s: 'Each person installs, configures, grants. Four thousand negotiations.' },
    paneTop: { t: 'One connection at the top', s: 'One administrator, consenting once. Everyone downstream just receives a draft.' },
    walls: [
      { i: '🔒', t: 'Permission', d: 'Tenant-wide read scopes need a Global Admin. Large firms switch user consent off — so even reading your own calendar cannot be self-served. There is no bottom-up path.' },
      { i: '👁', t: 'Privacy', d: 'A keystroke or screen agent on a laptop is surveillance and deserves to be fought. At the tenant layer it reads only what compliance already logs.' },
      { i: '🗂', t: 'Taxonomy', d: 'Which folder, which client domain, which engagement code — defined once for the whole firm, not re-entered by four thousand people.' },
    ],
    kHow: 'Mechanism', hHow: 'Four steps. Each answers one question.',
    steps: [
      { t: '① Signals', d: 'A file touched, a reply sent, a call attended. Metadata only.' },
      { t: '② Was this person working?', d: 'Gaps under {gap} minutes count — reading and reviewing are work. Longer ones are dropped, so lunch is never billed.' },
      { t: '③ On what?', d: 'The same span, re-cut where the subject changed: {tb} stretches became {b} blocks.' },
      { t: '④ Whose bill, and what proves it?', d: 'Each block scored against every engagement, keeping the winner, the runner-up it beat, and the records behind both. Dashed = would not place this alone.' },
    ],
    cHow: 'One real day — {day}. {s} signals → {tb} stretches of working time → {b} attributed blocks. Hover any mark.',
    kOut: 'Output', hOut: 'The same week, drafted.',
    lOut: 'A <b>draft</b>, not a submission. A person still accepts it, and the rows the engine was unsure about raise their own hand.',
    nums: ['traces read', 'hours rebuilt', 'submittable as-is', 'rows need a human'],
    cta: 'See every hour and its evidence →',
    f1: '<b>Synthetic data throughout.</b> Northgate Advisory and its clients are fictional. Every hour, colour and confidence label is computed at build time by <code>src/core/timesheet/</code> — none of it is written by hand.',
    f2: 'Industry estimates put manual time-entry leakage at 8–12% of billable hours.',
  },
};

/* ── shared helpers ────────────────────────────────────────────────────── */
let L = 'zh';
const SLOTS = ['--s1', '--s2', '--s3', '--s4', '--s5', '--s6'];
const slot = new Map();
[...engagements].sort((a, b) => a.code.localeCompare(b.code))
  .forEach((e, i) => slot.set(e.code, SLOTS[i % SLOTS.length]));
const engById = new Map(engagements.map(e => [e.code, e]));
const col = c => (c === UN ? 'var(--grey)' : `var(${slot.get(c)})`);
const who = c => (c === UN ? (L === 'zh' ? '未归因' : 'Unassigned')
  : engById.get(c).chargeable ? engById.get(c).clientName : engById.get(c).name);
const hrs = n => String(+n.toFixed(2));
const wd = d => new Date(`${d}T12:00:00Z`).toLocaleDateString(L === 'zh' ? 'zh-CN' : 'en-GB',
  { weekday: 'short', timeZone: 'UTC' });
const clock = ms => new Date(ms).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
const day = ms => new Date(ms).toISOString().slice(0, 10);
const fill = (s, v) => s.replace(/\{(\w+)\}/g, (_, k) => v[k]);
const set = (id, html) => { document.getElementById(id).innerHTML = html; };

const tp = document.getElementById('tp');
const hover = (n, html) => {
  n.addEventListener('pointerenter', () => { tp.innerHTML = html; tp.style.opacity = '1'; });
  n.addEventListener('pointermove', e => {
    tp.style.left = `${Math.max(8, Math.min(e.clientX + 14, innerWidth - tp.offsetWidth - 8))}px`;
    tp.style.top = `${Math.max(8, e.clientY - tp.offsetHeight - 14)}px`;
  });
  n.addEventListener('pointerleave', () => { tp.style.opacity = '0'; });
};

const codes = [...new Set(draft.lines.map(l => l.engagementCode))].sort((a, b) => {
  const r = c => (c === UN ? 2 : engById.get(c).chargeable ? 0 : 1);
  return r(a) - r(b) || a.localeCompare(b);
});
const formCodes = codes.filter(c => c !== UN);
const byCell = new Map(draft.lines.map(l => [`${l.engagementCode}|${l.date}`, l]));

/* ── 四格漫画 · panel art ──────────────────────────────────────────────
 * Line art in currentColor so both themes work. Panels 1 and 4 are the same
 * grid, empty then filled — the whole pitch is that one before/after.        */
/* Panels 1 and 4 are the same grid — the real form, empty, then the real draft.
   Sharing one builder is the point: the before and the after cannot drift.   */
const GRID = (filled) => {
  const W = 44, H = 23, X0 = 118, Y0 = 26;
  let g = '';
  formCodes.forEach((code, r) => {
    meta.days.forEach((d, c) => {
      const x = X0 + c * W, y = Y0 + r * H;
      g += `<rect x="${x}" y="${y}" width="${W - 2}" height="${H - 2}" rx="3" fill="none"
        stroke="currentColor" stroke-width="1.2" opacity=".4"/>`;
      const line = byCell.get(`${code}|${d}`);
      if (filled && line) {
        g += `<rect x="${x}" y="${y}" width="${W - 2}" height="${H - 2}" rx="3"
          fill="${col(code)}" opacity=".16"/>` +
          `<text x="${x + (W - 2) / 2}" y="${y + 15}" text-anchor="middle" font-size="10.5"
            font-weight="700" fill="currentColor" font-family="var(--f)">${hrs(line.hours)}</text>`;
      } else if (!filled && (r * 5 + c) % 3 === 1) {
        g += `<text x="${x + (W - 2) / 2}" y="${y + 15.5}" text-anchor="middle" font-size="12"
          fill="currentColor" opacity=".28" font-family="var(--f)">?</text>`;
      }
    });
  });
  return g;
};

/* Head, torso, arms — drawn as one connected figure so it does not read as
   three loose strokes. `mood` only moves the arms and the mouth.             */
const PERSON = (x, y, mood) => {
  const up = mood === 'up';
  const arms = up
    ? `M${x - 16} ${y + 2} L${x - 29} ${y - 17} M${x + 16} ${y + 2} L${x + 29} ${y - 17}`
    : `M${x - 16} ${y + 4} L${x - 27} ${y + 24} M${x + 16} ${y + 4} L${x + 27} ${y + 24}`;
  const mouth = up
    ? `M${x - 5} ${y - 26} Q${x} ${y - 21} ${x + 5} ${y - 26}`
    : `M${x - 5} ${y - 22} Q${x} ${y - 27} ${x + 5} ${y - 22}`;
  return `<g fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round"
             stroke-linejoin="round">
    <circle cx="${x}" cy="${y - 32}" r="14.5"/>
    <path d="${mouth}" stroke-width="1.7"/>
    <path d="M${x - 21} ${y + 34} L${x - 16} ${y - 6} Q${x - 15} ${y - 14} ${x - 7} ${y - 14}
             L${x + 7} ${y - 14} Q${x + 15} ${y - 14} ${x + 16} ${y - 6} L${x + 21} ${y + 34}"/>
    <path d="${arms}"/></g>`;
};

const panelArt = () => [
  /* 1 · Friday 17:40, staring at the blank form */
  `<svg viewBox="0 0 400 240" role="img">
    ${GRID(false)}
    <g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
      <circle cx="54" cy="48" r="20"/><path d="M54 48 L43 55 M54 48 L54 37"/>
    </g>
    <text x="54" y="85" text-anchor="middle" font-size="13" font-weight="700" fill="currentColor"
          font-family="var(--f)">17:40</text>
    ${PERSON(54, 172, 'down')}
    <path d="M74 134 Q96 118 112 96" fill="none" stroke="currentColor" stroke-width="1.5"
          stroke-dasharray="3 4" opacity=".45"/>
  </svg>`,
  /* 2 · the week itself has faded */
  `<svg viewBox="0 0 400 240" role="img">
    <g fill="none" stroke="currentColor" stroke-width="2">
      <rect x="112" y="24" width="272" height="132" rx="18"/>
      <circle cx="97" cy="163" r="7"/><circle cx="83" cy="180" r="4.5"/>
    </g>
    ${meta.days.map((d, i) => {
      const x = 132 + i * 52, gone = i < 3;
      return `<rect x="${x}" y="44" width="40" height="88" rx="4" fill="none" stroke="currentColor"
        stroke-width="1.4" opacity="${gone ? '.2' : '.5'}" ${gone ? 'stroke-dasharray="3 4"' : ''}/>` +
        (gone ? '' : `<rect x="${x + 6}" y="${i === 3 ? 62 : 88}" width="28" height="${i === 3 ? 60 : 34}"
          rx="3" fill="currentColor" opacity=".14"/>`) +
        `<text x="${x + 20}" y="146" text-anchor="middle" font-size="9.5" fill="currentColor"
          opacity="${gone ? '.3' : '.6'}" font-family="var(--f)">${wd(d)}</text>`;
    }).join('')}
    <text x="246" y="102" text-anchor="middle" font-size="50" font-weight="700" fill="currentColor"
          opacity=".8" font-family="var(--f)">?</text>
    ${PERSON(54, 172, 'down')}
  </svg>`,
  /* 3 · the systems that recorded it anyway */
  `<svg viewBox="0 0 400 240" role="img">
    ${['meeting', 'mail', 'document', 'ticket', 'code', 'desktop'].map((src, i) => {
      const y = 22 + i * 33;
      return `<rect x="12" y="${y}" width="106" height="25" rx="7" fill="none" stroke="currentColor"
        stroke-width="1.5" opacity=".5"/>
        <text x="28" y="${y + 17}" font-size="11" fill="currentColor" opacity=".85"
          font-family="var(--f)">${SRC_LABEL[src]}</text>
        <path d="M118 ${y + 12.5} C158 ${y + 12.5} 166 118 194 118" fill="none" stroke="currentColor"
          stroke-width="1.3" opacity=".38"/>`;
    }).join('')}
    <path d="M202 118 L386 118" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
    ${Array.from({ length: 27 }, (_, i) =>
      `<circle cx="${208 + i * 6.6}" cy="${118 - (i % 3) * 9 + 9}" r="3" fill="currentColor" opacity=".8"/>`).join('')}
    <text x="294" y="172" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor"
          opacity=".55" font-family="var(--f)">{traces}</text>
  </svg>`,
  /* 4 · the same grid, drafted — one button left to press */
  `<svg viewBox="0 0 400 240" role="img">
    ${GRID(true)}
    <path d="M36 54 L50 70 L78 34" fill="none" stroke="var(--s3)" stroke-width="3.4"
          stroke-linecap="round" stroke-linejoin="round"/>
    ${PERSON(54, 172, 'up')}
    <rect x="252" y="168" width="114" height="33" rx="9" fill="var(--s3)"/>
    <text x="309" y="190" text-anchor="middle" font-size="13.5" font-weight="700" fill="#fff"
          font-family="var(--f)">{confirm}</text>
  </svg>`,
];

/* ── source icons + labels ─────────────────────────────────────────────── */
const ICON = {
  meeting: '<path d="M2 6a2 2 0 012-2h7a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2z"/><path d="M13 9l5-3v8l-5-3z"/>',
  calendar: '<rect x="2.5" y="4" width="15" height="13" rx="2"/><path d="M2.5 8h15M7 2v4M13 2v4"/>',
  mail: '<rect x="2" y="4.5" width="16" height="11" rx="2"/><path d="M2.5 6l7.5 5 7.5-5"/>',
  document: '<path d="M4.5 2.5h7l4.5 4.5v10.5h-11.5z"/><path d="M11.5 2.5V7H16"/>',
  ticket: '<path d="M3 4.5h9l5 5.5-5 5.5H3z"/><circle cx="7" cy="10" r="1.4"/>',
  chat: '<path d="M2.5 5a2 2 0 012-2h11a2 2 0 012 2v6a2 2 0 01-2 2H8l-4 4v-4H4.5a2 2 0 01-2-2z"/>',
  code: '<path d="M7 6l-4.5 4L7 14M13 6l4.5 4L13 14"/>',
  agent: '<path d="M10 2l2 5.5L17.5 10 12 12.5 10 18l-2-5.5L2.5 10 8 7.5z"/>',
  desktop: '<rect x="2.5" y="3.5" width="15" height="10.5" rx="2"/><path d="M7 17.5h6M10 14v3.5"/>',
};
const SRC_LABEL_ZH = {
  meeting: '会议 / 通话', calendar: '日历', mail: '邮件', document: '文件', ticket: '工单',
  chat: '聊天', code: '代码', agent: 'AI agent', desktop: '活动窗口',
};
const SRC_LABEL_EN = {
  meeting: 'Meetings', calendar: 'Calendar', mail: 'Mail', document: 'Files', ticket: 'Tickets',
  chat: 'Chat', code: 'Code', agent: 'AI agent', desktop: 'Focus window',
};
let SRC_LABEL = SRC_LABEL_ZH;

/* ── the row whose provenance the page walks through ──────────────────── */
const HERO_LINE = draft.lines
  .filter(l => l.engagementCode !== UN)
  .sort((a, b) => b.hours - a.hours)[0];
const heroBlocks = blocks.filter(b =>
  day(b.startedAt) === HERO_LINE.date && b.engagementCode === HERO_LINE.engagementCode);
const heroSignals = heroBlocks.flatMap(b => b.signals);

/* One provenance row per source kind behind that line, showing the concrete
   identifier the attribution actually matched on — never the contents. */
function provenance() {
  const out = [];
  /* Which field to surface depends on the source: a meeting is identified by who
     was in it, a file by where it lives. Showing the wrong one makes two
     different sources look like they proved the same thing. */
  const DOMAIN_FIRST = new Set(['meeting', 'calendar', 'mail', 'chat']);
  for (const [src, list] of Object.entries(
    heroSignals.reduce((m, s) => { (m[s.source] ||= []).push(s); return m; }, {}))) {
    const path = list.find(s => s.path)?.path;
    const domain = list.find(s => s.participantDomains?.length)?.participantDomains[0];
    const value = (DOMAIN_FIRST.has(src) ? domain ?? path : path ?? domain)
      ?? (L === 'zh' ? `${list.length} 条 · 仅标题` : `${list.length} records · titles only`);
    out.push({ src, n: list.length, value });
  }
  const order = ['meeting', 'document', 'mail', 'ticket', 'chat', 'code', 'agent', 'calendar', 'desktop'];
  return out.sort((a, b) => order.indexOf(a.src) - order.indexOf(b.src));
}

/* ── the mechanism, over one real day ─────────────────────────────────── */
const MDAY = meta.days[2];
const F = Date.parse(`${MDAY}T08:00:00Z`);
const Tt = Date.parse(`${MDAY}T18:00:00Z`);
const px = ms => ((ms - F) / (Tt - F)) * 100;
const dSig = signals.filter(s => day(s.startedAt) === MDAY);
const dTB = timeBlocks.filter(b => day(b.startedAt) === MDAY);
const dB = blocks.filter(b => day(b.startedAt) === MDAY);
const owner = s => blocks.find(b => s.startedAt >= b.startedAt && s.startedAt <= b.endedAt);

const vDots = (top, coloured) => dSig.map(s => {
  const o = coloured ? owner(s) : null;
  return `<div class="dot" style="left:${px(s.startedAt)}%;top:${top}px${o ? `;background-color:${col(o.engagementCode)}` : ''}"></div>`;
}).join('');
const vBars = (list, coloured) => list.map(b => {
  const l = Math.max(0, px(b.startedAt));
  const c = coloured && b.engagementCode === UN ? ' hatch' : '';
  const d = coloured && b.confidence !== 'high' ? ' dash' : '';
  return `<div class="bar${c}${d}" style="left:${l}%;width:${Math.max(.6, px(b.endedAt) - l)}%;` +
    `background-color:${coloured ? col(b.engagementCode) : 'var(--rule)'}"></div>`;
}).join('');
const vDrops = list => list.slice(1).map((b, i) => {
  const l = px(list[i].endedAt), w = px(b.startedAt) - l;
  const m = Math.round((b.startedAt - list[i].endedAt) / 60000);
  return m < 20 ? '' : `<div class="drop" style="left:${l}%;width:${w}%"></div>` +
    `<div class="dl" style="left:${l + w / 2}%">${m} min</div>`;
}).join('');
const vCuts = list => list.slice(1).filter((b, i) => b.startedAt === list[i].endedAt)
  .map(b => `<div class="cut" style="left:${px(b.startedAt)}%"></div>`).join('');

/* ── render ────────────────────────────────────────────────────────────── */
function render() {
  const t = T[L];
  SRC_LABEL = L === 'zh' ? SRC_LABEL_ZH : SRC_LABEL_EN;
  document.documentElement.lang = L;
  document.getElementById('lang').textContent = t.lang;
  document.getElementById('deep').textContent = t.deep;
  document.getElementById('cta1').textContent = t.cta;
  set('h1', t.h1); set('hs', t.hs);

  /* 四格漫画 */
  const cells = formCodes.length * meta.days.length;
  const confirm = L === 'zh' ? '确认' : 'Confirm';
  const tracesLbl = L === 'zh' ? `${stats.signalCount} 条痕迹` : `${stats.signalCount} traces`;
  const art = panelArt();
  set('strip', t.panels.map((p, i) => `
    <div class="cell"><div class="no">${i + 1}</div>
      ${art[i].replace('{traces}', tracesLbl).replace('{confirm}', confirm)}
      <div class="txt"><div class="q">${p.q}</div><div class="a">${fill(p.a, { cells })}</div></div>
    </div>`).join(''));

  /* provenance */
  set('k-src', t.kSrc);
  set('h-src', fill(t.hSrc, { h: hrs(HERO_LINE.hours) }));
  set('l-src', t.lSrc);
  const rows = provenance();
  set('trace', `
    <div class="srcs">${rows.map(r => `
      <div class="src">
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5"
             stroke-linecap="round" stroke-linejoin="round">${ICON[r.src]}</svg>
        <span class="n">${SRC_LABEL[r.src]} <span style="color:var(--ink3)">×${r.n}</span></span>
        <span class="v" title="${r.value}">${r.value}</span>
      </div>`).join('')}</div>
    <div class="arrow">→</div>
    <div class="outrow">
      <div class="d">${t.outHdr} · ${wd(HERO_LINE.date)} ${HERO_LINE.date}</div>
      <div class="c"><i style="background:${col(HERO_LINE.engagementCode)}"></i>${who(HERO_LINE.engagementCode)}</div>
      <div class="d">${HERO_LINE.engagementCode}</div>
      <div class="h">${hrs(HERO_LINE.hours)}<small>h</small></div>
      <div class="badge">${L === 'zh' ? '高置信度 · 可直接提交' : 'High confidence · submittable'}</div>
    </div>`);
  set('never', t.never.map(n => `<span>${n}</span>`).join(''));
  set('c-src', fill(t.cSrc, { kinds: Object.keys(stats.signalsBySource).map(s => SRC_LABEL[s]).join('、') }));

  /* top-level */
  set('k-top', t.kTop); set('h-top', t.hTop);
  const people = [40, 110, 180, 250];
  set('two', `
    <div class="pane no"><h3>${t.panePer.t}</h3><div class="sub">${t.panePer.s}</div>
      <svg viewBox="0 0 300 132">
        <text x="150" y="18" text-anchor="middle" font-size="10.5" fill="var(--ink3)" font-family="var(--f)">Microsoft 365</text>
        <g fill="none" stroke="var(--red)" stroke-width="1.5" stroke-dasharray="4 3">
          ${people.map(x => `<path d="M${x} 104 L${x} 52"/>`).join('')}</g>
        <g fill="none" stroke="var(--red)" stroke-width="2.6">
          ${people.map(x => `<path d="M${x - 13} 46 L${x + 13} 46"/>`).join('')}</g>
        <g fill="var(--ink3)">${people.map(x => `<circle cx="${x}" cy="114" r="8"/>`).join('')}</g>
        <text x="150" y="36" text-anchor="middle" font-size="11" font-weight="700" fill="var(--red)"
              font-family="var(--f)">admin consent × 4000</text>
      </svg></div>
    <div class="pane yes"><h3>${t.paneTop.t}</h3><div class="sub">${t.paneTop.s}</div>
      <svg viewBox="0 0 300 132">
        <text x="150" y="18" text-anchor="middle" font-size="10.5" fill="var(--ink3)" font-family="var(--f)">Microsoft 365</text>
        <rect x="100" y="28" width="100" height="24" rx="7" fill="var(--s1)"/>
        <text x="150" y="44" text-anchor="middle" font-size="11" font-weight="700" fill="#fff"
              font-family="var(--f)">${L === 'zh' ? '一个连接器' : 'one connector'}</text>
        <g fill="none" stroke="var(--s1)" stroke-width="1.5">
          ${people.map(x => `<path d="M150 52 C150 82 ${x} 78 ${x} 104"/>`).join('')}</g>
        <g fill="var(--ink3)">${people.map(x => `<circle cx="${x}" cy="114" r="8"/>`).join('')}</g>
      </svg></div>`);
  set('walls', t.walls.map(w =>
    `<div class="wall"><div class="i">${w.i}</div><div class="t">${w.t}</div><div class="d">${w.d}</div></div>`).join(''));

  /* mechanism */
  set('k-how', t.kHow); set('h-how', t.hHow);
  const v = { gap: meta.policy.idleBudgetSeconds / 60, tb: dTB.length, b: dB.length };
  const vizes = [
    vDots(21, false),
    vBars(dTB, false) + vDrops(dTB) + vDots(38, false),
    vBars(dB, false) + vCuts(dB) + vDots(38, false),
    vBars(dB, true) + vDots(38, true),
  ];
  set('steps', t.steps.map((s, i) => `
    <div class="srow"><div><div class="t">${s.t}</div><div class="d">${fill(s.d, v)}</div></div>
      <div class="viz">${vizes[i]}</div></div>`).join('') +
    `<div class="ax">${[8, 10, 12, 14, 16, 18].map(h => `<span>${h}:00</span>`).join('')}</div>`);
  set('c-how', fill(t.cHow, { day: `${wd(MDAY)} ${MDAY}`, s: dSig.length, ...v }));

  /* output */
  set('k-out', t.kOut); set('h-out', t.hOut); set('l-out', t.lOut);
  let sheet = `<div class="r"><div class="hd">${L === 'zh' ? '项目' : 'Engagement'}</div>` +
    meta.days.map(d => `<div class="hd">${wd(d)} ${d.slice(8)}</div>`).join('') +
    `<div class="hd">${L === 'zh' ? '合计' : 'Total'}</div></div>`;
  for (const code of codes) {
    let tot = 0;
    let cells2 = '';
    for (const d of meta.days) {
      const line = byCell.get(`${code}|${d}`);
      if (!line) { cells2 += '<div class="c e">·</div>'; continue; }
      tot += line.hours;
      cells2 += `<div class="c"><span class="pill${code === UN ? ' g' : ''}"` +
        `${code === UN ? '' : ` style="background:${col(code)}"`}>${hrs(line.hours)}</span></div>`;
    }
    sheet += `<div class="r"><div class="c l"><span class="sw${code === UN ? ' h' : ''}" ` +
      `style="background:${col(code)}"></span>${who(code)}</div>${cells2}` +
      `<div class="c t">${hrs(tot)}</div></div>`;
  }
  sheet += `<div class="r"><div class="c l t">${L === 'zh' ? '每日合计' : 'Day total'}</div>` +
    meta.days.map(d => `<div class="c t">${hrs(draft.lines.filter(l => l.date === d)
      .reduce((s, l) => s + l.hours, 0))}</div>`).join('') +
    `<div class="c t">${hrs(draft.totalHours)}</div></div>`;
  set('sheet', sheet);

  const vals = [stats.signalCount, `${hrs(draft.totalHours)}<small>h</small>`,
    `${Math.round(draft.autoAcceptRatio * 100)}<small>%</small>`,
    draft.lines.filter(l => l.confidence !== 'high').length];
  set('nums', t.nums.map((k, i) => `<div class="nm"><div class="v">${vals[i]}</div><div class="k">${k}</div></div>`).join(''));
  set('f1', t.f1); set('f2', t.f2);

  /* tooltips, re-bound after every render */
  document.querySelectorAll('.viz .dot').forEach((n, i) => {
    const s = dSig[i % dSig.length];
    hover(n, `<b>${s.subject}</b><br>${SRC_LABEL[s.source]} · ${clock(s.startedAt)}`);
  });
  document.querySelectorAll('.pill').forEach(n => {
    const line = draft.lines.find(l => hrs(l.hours) === n.textContent);
    if (line) { hover(n, `<b>${who(line.engagementCode)}</b><br>${line.narrative}`); }
  });
}
render();

document.getElementById('lang').addEventListener('click', () => { L = L === 'zh' ? 'en' : 'zh'; render(); });
const tb = document.getElementById('theme');
const theme = m => { document.documentElement.dataset.theme = m; tb.textContent = m === 'dark' ? 'Light' : 'Dark'; };
theme(matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
tb.addEventListener('click', () => theme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'));
})();
