# dsh-workspace-groups

![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)
![DSH](https://img.shields.io/badge/DSH-0.1.1--rc.2-purple.svg)

> **DeepSeek Harness（DSH）Web 客户端插件：完整的工作区分组管理工具。**
> 把 GUI 侧边栏的工作区列表从两层「项目 → 会话」升级为三层
> **「分类文件夹 → 项目文件夹 → 会话」**，并围绕它提供完整的分组管理能力——
> 手动建组、重命名/删除分组、拖拽归类、项目与分组的自由排序、规则自动归类、
> 树形搜索。所有操作**即时生效并持久化**，对官方数据**零侵入**。


## 截图

<img src="screenshot.png" alt="dsh-workspace-groups 工作区分组管理" width="280" />

## 特性

### 三层树浏览
- **分类文件夹 → 项目文件夹 → 会话行**，分类/项目均可折叠；展开状态独立持久化
  （`dsh.workspace.groups.view.v1`，刷新/重启保留）
- **「未分类」兜底桶**：不匹配任何分组、被移出分组的项目自动归入，**恒在列表最底部**

### 分组管理（完整生命周期）
- **手动新建分组**：区头「新建分组」按钮即建即显，空分组也渲染
- **重命名 / 删除任意分组**：每个分组行（**含规则分类**）悬停 `⋯` 菜单；
  删除分组后组内所有项目回到「未分类」；规则分类的改名/删除经 overlay 生效
  （`renamed` / `hidden`），**规则 YAML 原样保留**
- **规则自动归类**：sidecar YAML 声明分类规则（`pathPrefix` / `pathExact` /
  `nameContains` / `basenameContains`），改配置即可调整归类，无需改代码

### 拖拽归类 + 排序
- **拖项目进分组**：拖到任意分组行 / 分组内项目行即移入（跨组移动 = 覆盖规则归类）；
  拖到「未分类」或菜单「移到未分类」= **强制归入未分类**（规则匹配也无效）
- **项目组内排序**：拖到项目行上半 = 插到它前面、下半 = 插到它后面
- **分组排序**：分组行可拖动，拖到另一分组行上半 = 移到它前面、下半 = 移到它后面
- **插入位置指示线**：拖动中实时显示 2px 指示线（行上/下方），松手落点所见即所得
- **智能收起**：拖项目时其他分组的项目自动收起（源分组保留便于排序）；拖分组时所有
  分组收起（分组行仍可见作排序目标）

### 搜索与操作
- **树形搜索**：命中后仍保留三层树结构（分类 → 项目 → 命中会话），命中行高亮 +
  内容摘要，防抖 250ms
- **工作区/会话操作不退化**：Add Workspace、项目重命名/删除、新建/打开/重命名/
  派生/归档会话

### 持久化与零侵入
- 所有手动操作（分组、归类、排序、改名、隐藏）写入插件自有 overlay
  （`~/.dsh/workspace-groups.manual.json`），host 校验后**原子写入**（写坏返回 400 并
  保留原文件）
- **零侵入**：不修改 `~/.dsh/storages/workspace.json`、不修改会话落盘结构、不修改官方
  `@deepseek-ai/dsh-client-ui-workspace` 包；规则 YAML 永不改写
- **产物自包含**：`lib/` 已构建并随仓库分发，Git 安装无需执行任何依赖脚本

## 工作原理

- 本插件是 **client 插件**，注册进官方 sidebar shell 声明的 `sidebar.workspaces`
  slot（`kind: 'single'`），以 `priority: -1` 顶替官方默认 WorkspaceBrowser
  （官方以 priority 0 注册；single 槽位最低 priority 胜出）。
- 数据源全部复用运行时 API：`useWorkspaces` / `useSessions` 全局 hooks 与
  `ctx.workspaces.*` / `ctx.sessions.*`，分类只是**展示层变换**。
- host 半做两件事：把 sidecar YAML 解析为 JSON 与运行时 overlay 合并，经
  `GET /workspace-groups/config` 路由（`Cache-Control: no-cache`）供 client 获取；
  `PUT /workspace-groups/manual` 接收整份 overlay（手动分组、每工作区归类覆盖、
  分组/项目排序、规则分类改名与隐藏），校验后原子写入
  `$DSH_HOME/workspace-groups.manual.json`。
- **归类优先级**：手动覆盖（拖拽/菜单写入；`null` = 强制未分类）→ YAML 规则
  自动归类（被隐藏的规则分类失效）→ 「未分类」桶（恒在最底部）。
  YAML 永不改写。

## 安装（GitHub 分发）

> 前置：已安装 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)
> （`dsh` 命令可用），并已初始化好目标 profile（如内置 `web`）。

```sh
dsh plugin --profile web add github:z-col/dsh-workspace-groups
```

这会自动：

1. 在 `~/.dsh/profiles/web/package.json` 的 `dependencies` 加入
   `"dsh-workspace-groups": "github:z-col/dsh-workspace-groups"`（含版本/commit）
2. 在 `dsh.profile.bundles` 末尾追加 `"dsh-workspace-groups"`
3. 运行 pnpm 安装并校验 bundle 层

**安装后重启 web profile**（bundle 与 host 半只有在重启后才会被加载）：

```sh
# 停止现有 dsh web 进程后重新启动，例如：
dsh web
```

验证安装：

```sh
dsh --profile web --dump-config | grep -A3 workspace-groups
# 应出现 - id: workspace-groups / name: dsh-workspace-groups / config: {}
curl http://127.0.0.1:3080/workspace-groups/config
# 应返回 sidecar YAML 解析后的 JSON
```

## 卸载

```sh
dsh plugin --profile web remove dsh-workspace-groups
```

这会自动从 `dependencies` 删除该依赖并从 `dsh.profile.bundles` 移除对应行。
同样需要**重启 web profile** 后生效。

> 手动等价做法（任选其一，不要重复）：编辑 `~/.dsh/profiles/web/package.json`，
> 从 `dependencies` 删除 `dsh-workspace-groups` 行、从 `dsh.profile.bundles`
> 删除 `"dsh-workspace-groups"`，然后在该目录 `pnpm install`。

## 分类配置（sidecar）

默认位置 `~/.dsh/workspace-groups.yaml`（也可用 `$DSH_HOME` 环境变量覆盖家目录）。
模板见仓库根目录 `workspace-groups.example.yaml`。

```yaml
categories:
  - name: DSH 插件
    rules:
      - pathPrefix: /Users/zcol/Project/SkillsManagePlugins
      - nameContains: 插件
      - basenameContains: plugin
  - name: 个人项目
    rules:
      - pathPrefix: /Users/zcol/Project/yeluzi
```

规则字段（每个 rule 是 OR 关系，任一命中即归类；分类按序匹配，先到先得）：

| 字段 | 含义 |
|---|---|
| `pathPrefix` | 项目绝对路径前缀 |
| `pathExact` | 项目绝对路径精确匹配 |
| `nameContains` | 项目显示标题包含（忽略大小写） |
| `basenameContains` | 项目目录名包含（忽略大小写） |

未命中任何分类的项目进入「未分类」桶，不会被隐藏。

## 手动分组与拖拽归类（runtime overlay）

规则 YAML 之外，还有一份插件自有的运行时 overlay，**只记录 UI 里的手动操作**，
默认位置 `$DSH_HOME/workspace-groups.manual.json`（例如 `~/.dsh/workspace-groups.manual.json`）：

```json
{
  "categories": ["临时", "归档"],
  "assignments": {
    "a1b2c3d4-e5f6-7890-abcd-ef1234567890": "临时",
    "a1b2c3d4-e5f6-7890-abcd-ef1234567891": null
  },
  "categoryOrder": ["临时", "DSH 插件"],
  "workspaceOrder": { "临时": ["a1b2c3d4-e5f6-7890-abcd-ef1234567890"] },
  "renamed": { "DSH 插件": "插件集" },
  "hidden": ["文档"]
}
```

- `categories` —— 手动新建的分组名（无规则，空分组也渲染）；名称不可与规则分类
  或「未分类」重复。
- `assignments` —— 工作区 → 分组的归类覆盖，键是稳定的工作区 id（重命名不影响）。
  **优先级高于 YAML 规则**；值为 `null` 表示**强制归入未分类**（即使规则能匹配）。
- `categoryOrder` —— 分组显示顺序（「未分类」恒在最底部，不在此列）。
- `workspaceOrder` —— 每个分组内项目的手动排序（拖拽排序写入）。
- `renamed` / `hidden` —— 规则分类的 UI 改名/删除（隐藏后其规则失效，匹配项目
  落入未分类）；规则 YAML 原样保留。
- 文件由浏览器 UI 全量写入（`PUT /workspace-groups/manual`，原子替换），手工编辑
  同样生效（下次加载时读取）；写坏会返回 400 并保留原文件，不会破坏规则 YAML。

| 操作 | 入口 |
|---|---|
| 新建分组 | 区头「新建分组」按钮（文件夹图标），弹窗输入名称 |
| 重命名/删除分组 | **任意分组**（含规则分类）悬停 `⋯` 菜单；删除后组内项目回「未分类」 |
| 拖项目进分组 | 拖动项目行到目标分组行 / 分组内任意项目行，松手即移入 |
| 项目排序 | 拖动项目行到同组另一项目行：**上半 = 插到它前、下半 = 插到它后**（指示线显示落点）；拖动时其他分组项目自动收起 |
| 移出分组 | 拖到「未分类」，或项目行菜单「移到未分类」（强制归入未分类） |
| 分组排序 | 拖动分组行到另一分组行：**上半 = 移到它前、下半 = 移到它后**（指示线显示落点；拖动时所有分组收起）；未分类恒在底部 |

## 收录标签（topics）

本仓库面向 DSH 插件生态的自动收录（社区市场靠 GitHub topic 扫描发现），已设置：

- `dsh-plugin`（核心标签，[1024Store](https://github.com/imsai-sh/awesome-deepseek-harness-plugins)
  等市场定时按此 topic 自动发现，并校验 `package.json` + 插件 bundle 清单
  （`cordis.patch.yml`））
- `deepseek-harness` / `deepseek-harness-plugin` / `dsh`
- `sidebar` / `workspace` / `workspace-groups`

`package.json` 同时提供 `keywords` 便于 npm/搜索索引。

## 开发

```sh
pnpm install
pnpm typecheck   # host + client 双 program 类型检查
pnpm test        # 核心规则、overlay、树派生单测
pnpm build       # 构建 lib/（node 半 + client bundle）
pnpm watch       # tsdown 监听（client HMR）
node scripts/verify-groups.mjs   # 真机 CDP 验证（host 已重启时；自启独立 headless Chrome，自动恢复现场）
```

产物契约（与官方 client 包一致）：

- `lib/index.js` —— host 半（ESM；读取 sidecar + `/workspace-groups/config` 路由，
  js-yaml 已内联，无运行时依赖）
- `lib/client.js` —— browser 半（`window.__ModuleLoader__.load({id, factory})`；
  仅 require 平台 seed：react / react/jsx-runtime / @deepseek-ai/dsh-client-runtime/client /
  @deepseek-ai/dsh-client-ui-primitives；跨插件值 import 在构建期被 purity 门拒绝）
- `lib/types/**` —— 声明文件

> 发布策略说明：`lib/` 构建产物随仓库提交（无 `prepare` 脚本），因此
> `dsh plugin add github:...` 全程无需执行第三方构建脚本，安装即用。

## 目录结构

```
src/
  index.ts              # host 半：config 快照路由 + manual 写路由
  host-config.ts        # sidecar YAML 读取/校验
  host-manual.ts        # runtime overlay 读写/校验（原子发布）
  context-types.ts      # host 侧 cordis 服务结构类型
  core/
    types.ts            # 配置类型（两半共享）
    matcher.ts          # 分类规则 + 手动覆盖优先级 + 排序纯函数（两半共享）
  client/
    index.ts            # apply：注册 sidebar.workspaces（priority -1）
    contract.ts         # 注入面类型
    stores.ts           # 展开状态 store（persist: dsh.workspace.groups.view.v1）
    tree.ts             # 三层树派生 + 树形搜索派生
    GroupsBrowser.tsx   # 浏览区域组件（分组弹窗 + 拖拽归类/排序 + 插入指示线）
    rows.tsx            # 分类/项目/会话/搜索结果行（拖拽源/目标）
    locales.ts          # 中英文案
    styles.css          # 内联样式
tests/
  core.test.ts          # 分类规则 + 手动覆盖优先级 + moveBefore/moveAfter + 配置解析
  manual.test.ts        # overlay 校验 + 文件原子往返
  tree.test.ts          # 树派生渲染契约（手动分组空渲染/覆盖优先）
  store.test.ts         # 展开状态语义（折叠写 false 不删 key）
scripts/
  verify-groups.mjs     # 真机 CDP 验证（自启 headless Chrome，自动恢复现场）
```

> 开发文档（`docs/` 五级框架与 `AGENTS.md`）是开发用工程文件，**不随仓库分发**
> （已在 `.gitignore` 排除）。

## 验证记录

- v0.1/v0.2 真实组合验证（headless Chrome + CDP 实操）：三层树顶替生效、分类正确、
  展开持久化、搜索保留归属；`workspace.json` / 会话落盘 / 官方 store 零侵入。
- v0.3 真机验证 24/24（`scripts/verify-groups.mjs`：建组/拖拽/排序/收起/规则分类
  菜单/重命名/删除回未分类/置底/现场恢复，零侵入断言）。
- v0.4 真机验证 30/30（新增：插入指示线、项目/分组**向下拖**（行下半 → 插到目标
  之后）、分组向上拖（行上半 → 移到目标之前）；现场恢复通过）。
- 单测 65 用例全绿（vitest：`core` / `manual` / `tree` / `store`）。
- 可复跑的自动化真机验证：`node scripts/verify-groups.mjs`（需 host 已重启）。

## License

MIT
