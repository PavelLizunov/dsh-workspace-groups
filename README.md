# dsh-workspace-groups

![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)
![DSH](https://img.shields.io/badge/DSH-0.1.1--rc.2-purple.svg)

> **DeepSeek Harness（DSH）Web 客户端插件**：把 GUI 侧边栏的工作区列表从两层
> 「项目 → 会话」变成三层 **「分类文件夹 → 项目文件夹 → 会话」**。

典型场景：多个 DSH 插件项目（SkillsManagePlugins / Documentation-Driven AI Coding /
DeepSeek峰谷小组件 等）归入一个「DSH 插件」分类文件夹，点开是各项目，再点开是各自会话。

## 截图

![dsh-workspace-groups 侧边栏三层树](screenshot.png)

## 特性

- **三层侧边栏**：分类文件夹（可折叠）→ 项目文件夹（可折叠）→ 会话行
- **sidecar 配置**：分类规则写在 `~/.dsh/workspace-groups.yaml`，改配置即可增删分类 /
  调整归类，无需改代码、无需重启（刷新页面生效）
- **树形搜索**：搜索命中后仍保留三层树结构（分类 → 项目 → 命中会话），命中行高亮并
  显示内容摘要，而不是扁平的结果列表
- **零侵入**：不修改 `~/.dsh/storages/workspace.json`、不修改会话落盘结构、
  不修改官方 `@deepseek-ai/dsh-client-ui-workspace` 包
- **功能不退化**：打开/新建/搜索会话、Add Workspace、项目重命名/删除、
  会话重命名/派生/归档、展开状态持久化（独立 key，重启保留）
- **产物自包含**：`lib/` 已构建并随仓库分发，Git 安装无需执行任何依赖脚本

## 工作原理

- 本插件是 **client 插件**，注册进官方 sidebar shell 声明的 `sidebar.workspaces`
  slot（`kind: 'single'`），以 `priority: -1` 顶替官方默认 WorkspaceBrowser
  （官方以 priority 0 注册；single 槽位最低 priority 胜出）。
- 数据源全部复用运行时 API：`useWorkspaces` / `useSessions` 全局 hooks 与
  `ctx.workspaces.*` / `ctx.sessions.*`，分类只是**展示层变换**。
- host 半只做一件事：把 sidecar YAML 解析为 JSON，经
  `/workspace-groups/config` 路由（`Cache-Control: no-cache`）供 client 获取。

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

## 收录标签（topics）

本仓库面向 DSH 插件生态的自动收录（社区市场靠 GitHub topic 扫描发现），已设置：

- `dsh-plugin`（核心标签，[1024Store](https://github.com/imsai-sh/awesome-deepseek-harness-plugins)
  等市场定时按此 topic 自动发现，并校验 `package.json` + `dsh.bundle.patch` 字段）
- `deepseek-harness` / `deepseek-harness-plugin` / `dsh`
- `sidebar` / `workspace` / `workspace-groups`

`package.json` 同时提供 `keywords` 便于 npm/搜索索引。

## 开发

```sh
pnpm install
pnpm typecheck   # host + client 双 program 类型检查
pnpm test        # 核心规则与配置解析单测
pnpm build       # 构建 lib/（node 半 + client bundle）
pnpm watch       # tsdown 监听（client HMR）
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
  index.ts              # host 半：config 路由
  host-config.ts        # sidecar YAML 读取/校验
  context-types.ts      # host 侧 cordis 服务结构类型
  core/
    types.ts            # 配置类型（两半共享）
    matcher.ts          # 分类规则纯函数（两半共享）
  client/
    index.ts            # apply：注册 sidebar.workspaces（priority -1）
    contract.ts         # 注入面类型
    stores.ts           # 展开状态 store（persist: dsh.workspace.groups.view.v1）
    tree.ts             # 三层树派生 + 树形搜索派生
    GroupsBrowser.tsx   # 浏览区域组件
    rows.tsx            # 分类/项目/会话/搜索结果行
    locales.ts          # 中英文案
    styles.css          # 内联样式
tests/
  core.test.ts          # 分类规则 + 配置解析单测
```

## 验证记录

见 `docs/verification.md`（真实组合验证：headless Chrome + CDP 实操记录）。

## License

MIT
