# Auto-Timesheet：立项评估与计划

> 2026-08-20。评估对象：把 DevValue 的核心理念（用活动痕迹反推真实工时，并按业务上下文归集）
> 从软件开发行业迁移到专业服务行业（审计 / 咨询 / 法务）的自动工时记录。

---

## TL;DR

想法方向是对的，痛点是真的，但**"细分行业还没人做"这个前提是错的**，而且错得比较关键。

这个赛道已经有一家 **Laurel**（前身 Time by Ping）：2025 年 6 月 C 轮 $100M（IVP 领投、GV 跟投），
估值 $510M，客户含 EY、Grant Thornton，官网直接挂着"为某 Big Four 带来 +$59M 年利润"的案例，
**会计板块已占其业务一半**。技术路径和你想的几乎一样：接 Outlook / Zoom / Slack，用 LLM 分类归因，
人审后一键提交。

这件事有两个方向的含义，都重要：

- **坏消息**：不能用"这个痛点没人做"开场。懂行的人 5 分钟内会击穿，之后你说什么都要打折。
- **好消息**：一个 $510M 的公司已经替你验证了「痛点真实、可货币化、Big 4 会买」。你不用再论证市场
  存在，只需要论证**你站在哪个 Laurel 站不到的位置上**。

下面是我认为唯一值得你去讲的位置，以及为什么。

---

## 一、Laurel 留下的空隙（按可攻击性排序）

Laurel 的定位是 **revenue recovery**：帮每个人每天多捞回约 28 分钟计费工时，
买家是 CFO / managing partner，销售周期以季度计，只打头部所。这个定位本身
框定了它够不到的地方。

### 1. AI 时代计量单位的断裂 —— 你独有，也是我建议你下午讲的

Laurel 建在 Outlook / Zoom / Slack 上。它理解"人在开会、人在写邮件"，
**它不理解 git、IDE、CI、AI agent**。

而现在的技术咨询交付，一半的活是 agent 干的。这带来一个 Laurel 结构上答不了的问题：

> 当一个 engagement 有 40% 的工作由 AI agent 完成，"billable hour" 还是不是有效的计价单位？
> 如果不是，替代它的那个数字怎么算？

DevValue 已经在算这个数：`cost = human focus time × rate + AI token cost`。
这不是巧合 —— 这正是同一个问题在软件行业先爆发了一次。

**所以正确的叙事不是"我做一个更便宜的 Laurel"，而是：**
> Laurel 在优化一个正在消亡的指标（可计费小时）。我在定义替代它的那个指标
> （交付成本 = 人的认知时间 + AI 算力），而且我已经在软件工程这个先行行业里
> 把它跑通并上架了。

这个位置短期抄不了，因为它要求同时懂 IDE 遥测和专业服务计费 —— 这个交集里的人极少，
你正好在里面（KPMG IT audit + 已发布的 VS Code 扩展）。这也是**为什么这件事应该从
DevValue 延伸出来，而不是另起一个项目**：DevValue 是这个论点的证据，不只是前作。

### 2. Tenant-resident 部署（数据不出客户自己的云）

Laurel 是美国 SaaS。活动元数据离开客户 tenant 这件事，在三类客户面前是硬墙：

- 欧洲的 Betriebsrat / works council（德国尤其）
- 中国 PIPL 出境要求
- 审计所自身的 independence / client confidentiality 规程

**把整套东西做成"跑在客户自己 Azure tenant 里的应用"是架构差异，不是功能差异。**
这类差异抄起来很贵 —— 一个已经卖 SaaS 的公司要重做交付形态和合同形态。

### 3. Evidence-first，而不是 revenue-first

Laurel 说"帮你多计费"。你说"**每一行工时都能被审计**"。
对 IT audit 出身的人，这是母语，而且它打开三个被监管的真实场景：

| 场景 | 为什么工时必须可追溯 | 现有工具做得怎样 |
|---|---|---|
| 客户 billing dispute / WIP write-off | 需要证明某笔工时真实发生过 | 基本靠人回忆 |
| 软件资本化（ASC 350-40 / IAS 38） | 内部项目工时须按项目归集且可审计，直接影响财报 | 极差，多数靠 Excel |
| 政府合同 DCAA timekeeping | 有成文规则：当日录入、contemporaneous record、审计轨迹、主管审批 | 差，且是强制的 |

第三个尤其值得看：**DCAA 是被监管、被强制、且现有工具做得很烂的细分市场**，
规则明确（这对做产品是好事），而且客户没有"不买"的选项。

### 4. 中型 / 精品咨询所（10–500 人）

IT 审计、网络安全、ERP 实施、MSP。Laurel 不会为他们做企业级销售。
这是最大的长尾，也是唯一一个 solo / 小团队真的能触达的客户群。

---

## 二、必须诚实面对的五个障碍

这些不是"风险提示"，是会直接决定计划长什么样的约束。

### 1. 你在 KPMG 内部装不了。别把这条当路径。

tenant 级的 Graph scope（`Calendars.Read`、`Files.Read.All`、`AuditLog.Read.All`、
`CallRecords.Read.All`）需要 **Global Administrator / Privileged Role Administrator 授权**。
而 Big 4 的 tenant 基本都关掉了 user consent —— 意味着连只读自己 `/me` 数据的
delegated 版本你也自助装不上。

**推论**：prototype 必须跑在合成数据或你的个人 M365 上（本仓库的 prototype 就是这么做的）。
"我在 KPMG 试一下"不是一条可执行的路径，任何以它为前提的计划都会卡死。

### 2. 数据源的现实比想象的紧

| 信号 | API | 保留期 | 许可 / 授权 |
|---|---|---|---|
| 日历 | Graph `/me/events` | 长期 | delegated 可行（若 tenant 允许） |
| 会议**实际出席** | Graph `/communications/callRecords` | **仅 30 天** | application 权限，须 admin consent |
| 文件**编辑** | Graph `driveItem` / `delta` | 长期 | `Files.Read.All` |
| 文件**查看** | Purview Audit / Management Activity API | 180 天（Standard），1 年（Premium/E5） | 须 admin，且吃许可等级 |
| 最近用过的文档 | Graph `itemInsights` (`/me/insights/used`) | 滚动窗口 | 可被 tenant 关闭 |
| Teams 消息 | Export API | — | protected API，须微软单独审批 |

两个直接后果：
- **会议出席记录只能回看 30 天** → 冷启动没法靠历史补齐，必须一上线就开始攒。
- **文件"查看"事件是最贵的信号**（要 admin + 高许可），但"编辑"事件便宜。
  所以引擎必须在只有编辑信号时也能工作 —— 这就是为什么 core 里点事件有
  `pointSignalCreditSeconds` 这个策略项。

### 3. 监视感是第一杀手，不是技术

桌面前台窗口采集是这类产品最容易死的地方。设计上的答案必须是：
默认关闭、纯本地、可被员工自己审计、且**不出现在首页**。
prototype 里 `desktop` 信号只贡献了一条"Untitled note window"，就是这个意思。

### 4. 归因天花板由客户的项目分类学决定，不由模型决定

好消息，而且是选审计作为切入点的核心理由：**审计业务异常规整**。
每个 engagement 天然有独立的 SharePoint site、独立文件夹、独立客户域名。
这就是为什么引擎里 `path` matcher 权重最高（1.0），而 `keyword` 只有 0.6 且
**单独出现时不足以计费**。法务行业的文件组织比审计乱得多 —— 这是你比 Laurel 更容易
切入审计的结构性原因。

### 5. engagement code 的真源在别人手里

真实的 code 体系住在 practice-management 系统里（SAP、Deltek Maconomy、Replicon、
Retain，以及各家自研）。要做的是 connector，不是自己发明一套编码。
这部分商务难度远大于技术难度。

---

## 三、难度评估

| 阶段 | 工程 | 商务 / 合规 | 现实周期 |
|---|---|---|---|
| 合成数据 prototype | 低 | 无 | **已完成** |
| 个人 M365 单人版（delegated 只读） | 低 | 低 | 1–2 周 |
| 归因引擎 + 学习闭环 | 中 | 无 | 骨架已在仓库里 |
| Tenant-resident 部署（客户自己的 Azure） | 中高 | 中 | 2–3 月 |
| Practice-management 双向写入 | 中 | **高** | 每家一个 connector |
| 进 Big 4 采购 | 中 | **极高** | 12–18 月，不是 solo 能推的 |

**结论：不要以"卖给 KPMG"来做产品设计。**
以「中型咨询所 + tenant-resident + evidence-first」为设计目标，Big 4 是后话。

---

## 四、90 天计划

### Phase 0 — 本周（已基本完成）
合成数据 prototype + 定位文档，挂到个人网站。
目的是**拿它去谈**，不是卖。

### Phase 1 — 2 到 4 周：真数据单人版
用 delegated 只读接自己的个人 M365：日历 + OneDrive recent + （可选）call records，
跑通端到端，产出自己真实的一周。

这一步的全部价值是消掉最大的技术未知量：**Graph 到底能不能提供足够密度的信号**。
prototype 里假设了每 6–13 分钟一个信号 —— 这个数字对不对，只有真数据能回答，
而它决定了整个方案成不成立。**先做这一步，其他都可以等。**

### Phase 2 — 1 到 2 月：5 人 pilot
找一个中型咨询所或朋友的 boutique（**不要在 KPMG**）。只测三个数字：

| 指标 | 及格线 | 为什么是这个数 |
|---|---|---|
| Coverage（归因小时 / 实际工时） | > 80% | 低于此人还是得手填，价值消失 |
| Precision @ high confidence | > 97% | 低于此没人敢一键提交 |
| Review time | < 5 分钟/周 | 这是取代现状的唯一理由 |
| Rules learned per correction | > 1.5 | 决定第 2 周是否比第 1 周省力 |

这三个数字就是全部的 pitch。有了它们，你不需要任何 slide。

### Phase 3 — 决策点
根据 pilot 数字决定：做产品、做开源、还是就作为 portfolio 收尾。
**现在不要预设答案。**

---

## 五、下午聊天用的三句话

1. **不要说**"这个痛点没人做"。**要说**"这个痛点已经被验证到 $510M 估值，
   Laurel 已经进了 EY 和 Grant Thornton"。这一句会立刻建立你的可信度。

2. **要说**"Laurel 建在邮件和会议上，它看不见 git 和 AI agent。当一半交付由 agent 完成，
   可计费小时这个单位本身在崩塌 —— 我做的是替代它的那个计量，而且我在软件工程这个
   先行行业里已经上架跑通了（DevValue，VS Code Marketplace）"。

3. **要说**"我有一个跑得起来的东西可以现在给你看"，然后打开 prototype。
   里面每个数字都是引擎算出来的，不是画的。**特别指给对方看那三行 unassigned** ——
   一个敢承认"这 1.75 小时我不知道该记给谁"的工具，比一个把一周补齐到 40 小时的工具
   可信一百倍。这一点在审计人面前尤其管用。

---

## 六、命名

prototype 里用的 **Attest** 是占位名：审计语境里 attestation 是母语词，
"我们能证明"这层意思也正好是差异化本身。备选：**Provenance**、**Contemporanea**
（直指 DCAA 的 contemporaneous record 要求）、**Ledgerline**。
真要往前走的话先查商标 —— attest 太通用，未必能注册。

---

## 相关文档

- [`01-ARCHITECTURE.md`](./01-ARCHITECTURE.md) — 顶层设计、信号模型、部署形态、隐私姿态
- [`../../prototype/timesheet/`](../../prototype/timesheet/) — 可直接部署的 prototype
- [`../../src/core/timesheet/`](../../src/core/timesheet/) — 纯 TS 引擎（无 vscode 依赖）
