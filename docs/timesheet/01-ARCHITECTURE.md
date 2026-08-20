# Auto-Timesheet：顶层设计

> 配套战略评估见 [`00-STRATEGY.md`](./00-STRATEGY.md)。
> 本文描述的是已经落在 `src/core/timesheet/` 里的设计，不是设想。

---

## 0. 一句话架构

```
云端活动痕迹  →  统一信号  →  时间分块  →  上下文切分  →  归因（带证据）  →  工时草稿  →  人审  →  规则沉淀
                              └──────────── 纯 TS，无 IO，无 vscode ────────────┘
```

关键取舍只有一个：**证据链是产品，算法只是实现**。
归因算法迟早会被更好的模型换掉；"每一行工时都能点开看到它的来源记录"这件事换不掉。
所以引擎从不返回一个裸的 engagement code，它返回：胜出者、被它击败的第二名、
两者的分差、以及支撑各自的具体源记录。

---

## 1. 与 DevValue 的关系：一个共享内核，两个适配层

```
                    ┌─────────────────────────────┐
                    │   Attribution Kernel (纯TS)  │
                    │  ─────────────────────────  │
                    │  信号 → 分块 → 归因 → 计量   │
                    └──────────┬──────────────────┘
              ┌────────────────┴────────────────┐
              ▼                                 ▼
   ┌────────────────────┐          ┌─────────────────────────┐
   │  DevValue 适配层    │          │  Auto-Timesheet 适配层   │
   │  信号：IDE 事件      │          │  信号：M365 / Jira / git │
   │  上下文：git branch  │          │  上下文：engagement code │
   │  产出：feature 成本  │          │  产出：可提交的工时行     │
   └────────────────────┘          └─────────────────────────┘
```

两边是同一个数学问题的两个实例：**把离散的活动痕迹归集到一个业务上下文，并算出真实耗时**。
DevValue 的上下文是 git branch，这边是 engagement code。

**迁移时唯一需要重新校准的是节奏**，这一点在 `PtaFlowEngine` 和 `BlockSegmenter` 的
差异里体现得最清楚：

| | DevValue（IDE 信号） | Auto-Timesheet（云信号） |
|---|---|---|
| 信号间隔 | 秒级 | **分钟级（6–13 分钟）** |
| 基础空闲预算 | 300 s | **600 s** |
| 密度窗口 | 60 s | **900 s** |
| flow 倍数 | ×4（→20 分钟） | **×2（→20 分钟）** |

倍数从 4 降到 2 不是调参，是有硬约束的：**任何超过 20 分钟的桥接都会跨过午休**，
把午饭算成工时。所以这些常量不能写死在 segmenter 里，必须住在 `TimesheetPolicy`。

---

## 2. 信号模型

所有 connector 只负责产出这一个形状（`src/core/timesheet/types.ts`）：

```ts
interface ActivitySignal {
  id: string;                    // 源系统稳定 id，用于重放去重
  source: SignalSource;          // calendar | meeting | document | mail | chat
                                 // | ticket | code | agent | desktop
  startedAt: number;             // Unix ms
  endedAt: number;               // 点事件时等于 startedAt
  authoritativeDuration: boolean;// 源系统给的是真实时长（如实际出席的会议）
  subject: string;               // 会议标题 / 文件名 / 工单号——原样作为证据展示
  path?: string;                 // SharePoint 路径 / repo@branch / 工单项目
  participantDomains?: string[]; // 外部对手方域名
  evidenceUrl?: string;          // 回到源记录的深链
  intensity: number;             // 投入权重：编辑 > 被动打开
}
```

**这里最重要的一条：只有元数据，没有内容。** 引擎从不需要读一个文件的正文就能归集它。
这不是为了省事，这是能不能通过 works council 和客户保密审查的分水岭。

connector 接口刻意做成和 DevValue 的 `ITokenSniffer` 同一形状 —— 换后端不动上层：

```ts
interface ISignalConnector {
  readonly source: SignalSource;
  readonly id: string;
  fetch(range: { from: number; to: number }): Promise<ActivitySignal[]>;
}
```

---

## 3. 四段流水线

### 3.1 `BlockSegmenter` —— "这个人在不在工作？"
连续信号聚成工作块，块内每一个 gap 都被显式记账，因此
`focusSeconds === endedAt - startedAt` 恒成立，不存在一个会和块自身跨度漂移的独立累加器。

### 3.2 `ContextSplitter` —— "工作对象什么时候变了？"
只做时间分块会犯这个错：一个四小时的下午里夹了 45 分钟给另一个客户的电话，
整块被归给"产出文件最多的那个 engagement"。**被误记的那 45 分钟的客户，正是会发现的那个人。**

所以第二遍按 subject 切。两条性质：
- **不创造也不销毁时间** —— 切点落在过渡的中点，子块精确铺满父块。
- 判定"这是个真的切换"用的是**时长而不是信号条数** —— 一个 45 分钟单信号的电话是全天最重要的
  切换；90 秒内打开的三个文件是噪音。

### 3.3 `AttributionEngine` —— "该记给谁？证据是什么？"

打分刻意做得简单且可解释：`matcher 权重 × 信号 intensity × 该信号在块内的时长占比`，
按 engagement 汇总后归一化。

真正做事的是两条硬规则：

**（a）关键词单独出现永远不足以计费。**
`path` / `domain` / `repo` / `ticketProject` / `attendee` 是**定位符**——它们把工作放进一个
engagement。标题里的一个词只是提示，而提示会撞车：同一个 practice 下两个 engagement 都会
产出标题里带 "ITGC" 的文件，而刚开的第三个 engagement 根本还没配 matcher。
让关键词单独胜出，就是自动工时把账记到错误客户头上的方式 —— **这是这个系统唯一不能犯的错。**

> prototype 里能直接看到这条规则在工作：周五那 1.75 小时的 Cascade Utilities 新项目
> 启动会，引擎的首选是 `90412-ITGC-FY26`（标题里有 ITGC），**它拒绝了自己的首选**，
> 标成 unassigned，并把被拒的候选和拒绝理由一起交给审阅人。

**（b）平票返回"无标签"，而不是随便挑一个。**
两个客户在同一个电话上，就是那个绝不能被悄悄并进旁边高置信度块的信号。
一个"确定但任意"的赢家恰好会干这件事。

### 3.4 `TimesheetSynthesizer` —— "他要提交哪几行？"

三条规则来自工时是怎么被稽核的，而不是数据是怎么来的：

- **取整不能创造或销毁小时。** 每行独立四舍五入到 0.25，会让 7.9 小时的一天提交成 8.25。
  所以按天用最大余额法分配：行会动，天的总数不动。
- **碎片横向归并，绝不跨越计费线。** 6 分钟的碎片只并入**同一 chargeability** 的最大行。
  把非计费分钟并进客户账单，正是 engagement economics 审阅人专门在找的缺陷。
- **无法归因的时间是一等公民。** 它绝不会被吸进某个高置信度行来让这周看起来干净。
  一小时说不清的时间，是审阅人需要知道的信息。

行级置信度也因此不是分数阈值：**`high` 要求这一行背后的每一个块都是 high**。
按占比判定会让三个可信小时替第四个被引擎自己标了红的小时背书 —— 而那正是唯一需要人看的小时。

---

## 4. 三种部署形态

差异化在这一层，不在功能层。

| 形态 | 数据落在哪 | 授权 | 适用 |
|---|---|---|---|
| **A. Personal** | 本机 | delegated `/me` 只读 | 个人验证、Phase 1、演示 |
| **B. Tenant-resident** | **客户自己的 Azure**（Function + Table Storage） | 客户自己的 app registration | 有出境/工会/保密约束的客户 —— **主打** |
| **C. Vendor SaaS** | 我们的云 | multi-tenant app | 中小所，愿意换便利 |

形态 B 是和 Laurel 的结构性差异：**元数据一步都不离开客户 tenant**。
一家已经在卖 SaaS 的公司要补这个形态，得同时重做交付形态和合同形态。

---

## 5. 隐私姿态（可以直接拿给 works council 看）

这一节是产品的一部分，不是附录。

- **不采集击键，不截屏。** 默认信号集就是 tenant 为合规目的本来就在记的东西。
- **不读文档内容。** 信号只带标题、路径、对手方域名。
- **桌面前台窗口采集：可选、纯本地、默认关闭。**
- **不静默提交。** 没有人点过确认，什么都不会被提交。草稿是起点，不是断言。
- **员工可读自己的全部数据**，包括系统从纠正中学到的每一条规则（`learned: true` 标记就是为此）。
- **不从歧义中学习。** 一个牵涉两个外部对手方的块，纠正它什么也教不了 ——
  一条错的域名规则会误记此后所有跟这个对手方相关的往来。

---

## 6. 已知未解问题

按重要性排：

1. **真实信号密度未知。** prototype 假设 6–13 分钟一个信号。这个数字对不对只有
   真数据能答，而它决定整个方案成不成立。→ Phase 1 的全部目的。
2. **会议出席记录只有 30 天保留期**（`callRecords`），冷启动无法靠历史补齐。
3. **跨午夜的块**目前按开始时间归日，夜班场景会不准。
4. **叙述文案**现在是模板拼的，每个词都可追溯到一条被计数的记录。生产版会换成 LLM，
   但契约不变：**只给它 evidence 数组，禁止它添加事实**。
5. **engagement code 的真源**在 practice-management 系统里，connector 还没写。
6. **多人聚合**（manager 视角、utilization 报表）完全没做，也不该在 pilot 前做。

---

## 7. 跑起来

```bash
pnpm install
pnpm run test:core          # 18 个核心引擎测试，无需 VS Code
pnpm run demo:timesheet     # 跑真引擎，重新生成 prototype 数据
open prototype/timesheet/index.html      # 看图就懂的叙事页
open prototype/timesheet/dashboard.html  # 完整草稿 + 证据链
```

`prototype/timesheet/standalone/` 是把数据和脚本内联后的自包含版本，
整个目录可以直接丢到任何静态托管或个人网站上。
