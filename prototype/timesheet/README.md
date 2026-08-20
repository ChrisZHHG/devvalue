# Attest — prototype

自动工时草稿的可交互演示。**页面上每一个小时、每一个置信度标签、每一条证据
都是构建时由 `src/core/timesheet/` 真实算出来的**，不是手写的 JSON。

## 部署

`standalone.html` 是单文件版本（数据 + 脚本已内联），直接丢到任何静态托管上即可：

```bash
cp prototype/timesheet/standalone.html /path/to/your-site/attest.html
```

多文件版本（`index.html` + `app.js` + `demo-data.js`）适合本地开发，
直接用浏览器打开 `index.html` 就能看。

## 重新生成

改了引擎或合成数据之后：

```bash
pnpm run demo:timesheet
```

会同时刷新 `demo-data.js`、`standalone.html`，以及未纳入版本控制的
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
