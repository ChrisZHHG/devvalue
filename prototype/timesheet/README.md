# Attest — prototype

两个页面，两种读者：

| 文件 | 给谁看 | 内容 |
|---|---|---|
| `index.html` | **第一次听这件事的人** | 看图就懂的叙事页：痛点 → 痕迹已存在 → 为什么必须是顶层设计 → 原理四步 → 敢说"不知道" → AI agent 让"小时"失效 → 结果 |
| `dashboard.html` | 已经信了、想查细节的人 | 完整草稿、每一行的证据链、纠正学习闭环 |

**页面上每一个小时、每一条颜色、每一个置信度标签都是构建时由 `src/core/timesheet/`
真实算出来的**，不是手写的 JSON，也不是画的示意图。第 4 节那四步展示的是同一个真实的
星期三被逐步切开的过程。

## 放到个人网站上

`standalone/` 目录是自包含版本（数据和脚本都已内联），整个目录拷走即可，
两个页面之间的链接依然有效：

```bash
cp -r prototype/timesheet/standalone /path/to/your-site/attest
```

只想放一页的话，`standalone/index.html` 单文件就能独立打开（"Full draft" 链接会失效）。

本地开发直接用浏览器打开 `index.html`。

## 重新生成

改了引擎或合成数据之后：

```bash
pnpm run demo:timesheet
```

会刷新 `demo-data.js`、`standalone/` 下的两个页面，以及未纳入版本控制的
`demo-data.json`（和 `demo-data.js` 内容相同，仅方便直接查看引擎输出）。

## 数据说明

全部合成。**Northgate Advisory** 是虚构的事务所，Northwind Energy / Halcyon Payments /
Meridian Health / Cascade Utilities 是虚构客户。仓库里没有任何真实机构或客户数据。

合成的这一周刻意覆盖了会决定这类工具能不能活下来的几种情况：

| 情况 | 在哪天 |
|---|---|
| 干净、一眼可归因的现场工作日 | 周二 |
| 一天三个项目，其中一个块真的有歧义 | 周三 |
| AI agent 与 git 活动计入某个 engagement | 周四 |
| 非计费工作，且绝不能并进客户账单 | 周一、周五 |
| 完全没有可归因痕迹的真实工作 | 周一、周三 |
| 全新 engagement，还没有任何规则（冷启动） | 周五 |

## 关键数字

```
236 signals → 15 time blocks → 20 attributed blocks → 12 timesheet lines
33.5h 重建 · 26h 可计费 · 77% 高置信度可直接提交 · 4 行需要人看
```
