/**
 * Locale dictionaries for the workspace-groups browser. The namespace is
 * `workspaceGroups` (independent from ui-workspace's `workspace` namespace).
 */
import type { LocaleDictOf } from '@deepseek-ai/dsh-client-ui-slots'

/** Dictionary keys of the workspaceGroups namespace (single source of truth). */
export type WorkspaceGroupsKey =
  | 'section.workspaces'
  | 'section.sessions'
  | 'search'
  | 'search.placeholder'
  | 'search.clear'
  | 'search.noMatches'
  | 'search.unavailable'
  | 'search.pending'
  | 'search.hasMore'
  | 'search.results.aria'
  | 'workspace.add'
  | 'workspace.addBusy'
  | 'workspace.addError'
  | 'workspace.addErrorTitle'
  | 'workspace.rename'
  | 'workspace.delete'
  | 'workspace.deleteTitle'
  | 'workspace.deleteConfirm'
  | 'workspace.deleteCancel'
  | 'workspace.renaming'
  | 'workspace.deleting'
  | 'workspace.renameTitle'
  | 'workspace.renamePlaceholder'
  | 'workspace.renameConfirm'
  | 'workspace.renameCancel'
  | 'session.new'
  | 'session.rename'
  | 'session.archive'
  | 'session.fork'
  | 'session.renameTitle'
  | 'session.renamePlaceholder'
  | 'session.renameConfirm'
  | 'session.renameCancel'
  | 'session.renaming'
  | 'uncategorized'
  | 'empty.none'
  | 'empty.noWorkspaces'
  | 'close'
  | 'cancel'
  | 'confirm'
  | 'retry'
  | 'configUnavailable'
  | 'collapse'
  | 'expandMore'
  | 'newSession'

export type WorkspaceGroupsDict = LocaleDictOf<'workspaceGroups'>

/** Simplified Chinese dictionary. */
export const zh: WorkspaceGroupsDict = {
  'section.workspaces': '工作区',
  'section.sessions': '会话',
  search: '搜索',
  'search.placeholder': '搜索会话…',
  'search.clear': '清除',
  'search.noMatches': '没有匹配的会话',
  'search.unavailable': '搜索不可用',
  'search.pending': '搜索中…',
  'search.hasMore': '结果过多，请细化关键词',
  'search.results.aria': '搜索结果',
  'workspace.add': '添加工作区',
  'workspace.addBusy': '正在添加…',
  'workspace.addError': '添加失败',
  'workspace.addErrorTitle': '无法添加工作区',
  'workspace.rename': '重命名',
  'workspace.delete': '删除',
  'workspace.deleteTitle': '删除工作区',
  'workspace.deleteConfirm': '仅删除注册信息，目录与会话日志保留。确定删除？',
  'workspace.deleteCancel': '取消删除',
  'workspace.renaming': '重命名中…',
  'workspace.deleting': '删除中…',
  'workspace.renameTitle': '重命名工作区',
  'workspace.renamePlaceholder': '工作区名称',
  'workspace.renameConfirm': '重命名',
  'workspace.renameCancel': '取消',
  'session.new': '新建会话',
  'session.rename': '重命名会话',
  'session.archive': '归档',
  'session.fork': '派生',
  'session.renameTitle': '重命名会话',
  'session.renamePlaceholder': '会话名称',
  'session.renameConfirm': '重命名',
  'session.renameCancel': '取消',
  'session.renaming': '重命名中…',
  uncategorized: '未分类',
  'empty.none': '暂无内容',
  'empty.noWorkspaces': '还没有工作区',
  close: '关闭',
  cancel: '取消',
  confirm: '确定',
  retry: '重试',
  configUnavailable: '分组配置不可用',
  collapse: '折叠',
  expandMore: '展开全部',
  newSession: '新建会话',
}

/** English dictionary. */
export const en: WorkspaceGroupsDict = {
  'section.workspaces': 'Workspaces',
  'section.sessions': 'Sessions',
  search: 'Search',
  'search.placeholder': 'Search sessions…',
  'search.clear': 'Clear',
  'search.noMatches': 'No matching sessions',
  'search.unavailable': 'Search unavailable',
  'search.pending': 'Searching…',
  'search.hasMore': 'Too many results — refine the query',
  'search.results.aria': 'Search results',
  'workspace.add': 'Add workspace',
  'workspace.addBusy': 'Adding…',
  'workspace.addError': 'Add failed',
  'workspace.addErrorTitle': 'Could not add workspace',
  'workspace.rename': 'Rename',
  'workspace.delete': 'Delete',
  'workspace.deleteTitle': 'Delete workspace',
  'workspace.deleteConfirm': 'Only the registration is removed; the directory and session logs stay. Delete?',
  'workspace.deleteCancel': 'Cancel delete',
  'workspace.renaming': 'Renaming…',
  'workspace.deleting': 'Deleting…',
  'workspace.renameTitle': 'Rename workspace',
  'workspace.renamePlaceholder': 'Workspace name',
  'workspace.renameConfirm': 'Rename',
  'workspace.renameCancel': 'Cancel',
  'session.new': 'New Session',
  'session.rename': 'Rename session',
  'session.archive': 'Archive',
  'session.fork': 'Fork',
  'session.renameTitle': 'Rename session',
  'session.renamePlaceholder': 'Session name',
  'session.renameConfirm': 'Rename',
  'session.renameCancel': 'Cancel',
  'session.renaming': 'Renaming…',
  uncategorized: 'Uncategorized',
  'empty.none': 'Nothing here',
  'empty.noWorkspaces': 'No workspaces yet',
  close: 'Close',
  cancel: 'Cancel',
  confirm: 'Confirm',
  retry: 'Retry',
  configUnavailable: 'Grouping config unavailable',
  collapse: 'Collapse',
  expandMore: 'Show all',
  newSession: 'New Session',
}
