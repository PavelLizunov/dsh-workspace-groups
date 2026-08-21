# 真实组合验证记录（dsh-workspace-groups）

验证日期：2026-08-21
验证对象：`dsh-workspace-groups@0.1.0`（link 安装于 `~/.dsh/profiles/web`）
运行环境：`dsh web`（PID 90954），GUI http://127.0.0.1:3080，官方 dsh 0.1.1-rc.2

## 1. 安装与组合层验证

| 检查项 | 结果 |
|---|---|
| `dsh plugin --profile web add` 自动对账 bundles | ✅ 追加 `dsh-workspace-groups` 至 `dsh.profile.bundles` |
| `dsh --profile web --dump-config` 出现插件层 | ✅ `- id: workspace-groups / name: dsh-workspace-groups / config: {}` |
| 重启后 boot manifest 含插件 client 行 | ✅ `dsh-workspace-groups` 出现于 `__DSH_BOOT__.entries` |
| client bundle 可服务 | ✅ `/plugins/dsh-workspace-groups/client.js` 返回 ModuleLoader 包装 |
| host config 路由 | ✅ `GET /workspace-groups/config` 200，返回 sidecar JSON |

## 2. 顶替与数据链路（最小验证先行，三项全绿）

1. **顶替默认 WorkspaceBrowser**：侧边栏渲染 `.wgRoot` 树（非官方浏览器）；
   CDP 断言 `officialBrowser: false`、`wgRoot: true` ✅
2. **useWorkspaces 数据完整**：6 个工作区全部可见并按 sidecar 归类 ✅
3. **一层树渲染**：分类 → 项目 → 会话三层结构渲染成功 ✅

## 3. 分类结果（sidecar 实际生效）

```
DSH 插件 (4)          ← pathPrefix 规则命中
├── DSH-工作区分组
├── DeepSeek峰谷小组件
├── Documentation-Driven AI Coding
└── SkillsManagePlugins
个人项目 (2)
├── 闲谝
└── yeluzi
```

计数与 `~/.dsh/storages/workspace.json` 的 6 个工作区精确一致。

## 4. 交互验证（headless Chrome + CDP 实操）

| 操作 | 结果 |
|---|---|
| 点击分类「个人项目」 | ✅ 展开，显示闲谝 / yeluzi 项目 |
| 刷新页面 | ✅ 展开状态保留（store `dsh.workspace.groups.view.v1` 持久化） |
| 点击会话 `Docs AI Coding` | ✅ 选中态迁移到该会话（`.wgSelected`），打开生效 |
| 搜索「DSH」 | ✅ 返回 `Docs AI Coding · DSH-工作区分组`（workspace 归属保留） |
| 清除搜索 | ✅ 恢复三层树 |

## 5. 存储零侵入断言

| 检查项 | 结果 |
|---|---|
| `workspace.json` 结构 | ✅ 无 `category` 字段，unit.version=2 不变，workspace 计数 6 |
| 会话落盘 | ✅ 未新增/改动任何 session 文件 |
| 官方 view store | ✅ `dsh.workspace.view.v5` 未被触碰（仅新增独立 key `dsh.workspace.groups.view.v1`） |
| host 暴露面 | ✅ 仅一个只读 GET 路由 `/workspace-groups/config`（no-cache） |

## 6. 构建与质量门

| 检查项 | 结果 |
|---|---|
| `pnpm typecheck`（host + client 双 program） | ✅ 0 错误 |
| `pnpm test` | ✅ 12/12 通过（分类规则、配置解析） |
| `pnpm build` | ✅ lib/index.js（96KB，js-yaml 内联）+ lib/client.js（56KB）+ types |
| client bundle purity | ✅ 仅 require 平台 seed（react / runtime/client / primitives），跨插件值 import 被拒 |
| host bundle 自包含 | ✅ 零外部运行时 require（js-yaml 已内联） |

## 7. 已知限制（非缺陷）

- 会话拖拽排序未实现（当前行交互为打开/重命名/派生/归档；官方浏览器同样具备的
  拖拽排序在 v0.1 未移植）。项目拖拽排序同样未移植。
- 分类/项目的折叠状态自动展开当前会话所在分类与项目（与官方行为一致）。
- Add Workspace 使用原生目录选择器（`ctx.workspaces.pickDirectory`），
  无官方 WorkspacePickFlow 的菜单选择既有工作区功能 —— 已在功能上等价覆盖
  （既有工作区在树中始终可见）。

## 8. 缺陷修复记录（2026-08-21 二轮验证）

**Bug：当前分类/项目无法收缩**（用户报告）

- 现象：包含当前会话的「DSH 插件」分类与其下「DSH-工作区分组」项目无法折叠，
  其他节点正常。
- 根因：store 折叠用 `delete` 删 key + auto-expand effect 用 `!expansion[key]`
  守卫 —— 折叠后 key 缺失 → effect 重新展开。
- 修复：折叠改写入 `false`（key 保留，同官方 `setGroupExpanded` 语义）；
  auto-expand 守卫改 `Object.hasOwn`（仅从未操作过的 key 自动展开）。
- 验证（CDP 实操，全新 profile）：
  | 操作 | 结果 |
  |---|---|
  | 收缩「DSH 插件」（当前分类） | ✅ 折叠，2s 后不反弹，store `{"DSH 插件": false}` |
  | 再展开「DSH 插件」 | ✅ 恢复正常 |
  | 折叠后刷新 | ✅ 折叠状态持久保留 |
  | 收缩「DSH-工作区分组」（当前项目）后刷新 | ✅ 保持折叠（sessions 隐藏） |
- 回归：`pnpm typecheck` 0 错误；`pnpm test` 18/18（新增 6 个 store 语义测试）。
