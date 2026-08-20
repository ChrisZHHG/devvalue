# Attest — prototype

| 文件 | 给谁看 |
|---|---|
| `index.html` | **第一次听这件事的人**。四格漫画 → 溯源图 → 为什么必须顶层 → 原理四步 → 结果 |
| `dashboard.html` | 已经信了、要查细节的人。完整草稿、每行的证据链、纠正学习闭环 |

中英双语（右上角切换），亮/暗双主题。

页面上每一个小时、颜色、置信度标签都是构建时由 `src/core/timesheet/` **真实算出来的**。
四格漫画里第 1 格的空表和第 4 格的填好的表是同一个 grid builder 画的 —— 前后不可能对不上。

## 放到个人网站上

`standalone/` 是自包含版本（数据和脚本全部内联，无外部依赖），整个目录拷走即可：

```bash
cp -r prototype/timesheet/standalone /path/to/your-site/attest
# → /attest/            四格漫画入口页
# → /attest/dashboard.html   完整草稿
```

只放一页也行 —— `standalone/index.html` 单文件双击就能开（"完整草稿" 链接会失效）。

## 重新生成

```bash
pnpm run demo:timesheet
```

刷新 `demo-data.js`、`standalone/` 下两个页面，以及未纳入版本控制的 `demo-data.json`。

## 数据说明

全部合成。**Northgate Advisory** 是虚构事务所，Northwind Energy / Halcyon Payments /
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
