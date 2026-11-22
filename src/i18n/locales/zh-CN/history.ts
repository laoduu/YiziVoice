// zh-CN catalog fragment: history (keys are dotted, e.g. 'history.xxx')
export const history = {
  // ── history list ──
  'history.searchPlaceholder': '搜索历史记录…',
  'history.tabAll': '全部',
  'history.emptyTitle': '暂无记录',
  'history.emptyHint': '生成的内容会自动保存在这里',
  'history.moreActions': '更多操作',
  'history.openFolder': '打开文件夹',
  'history.pruneOrphans': '清理孤儿音频',
  'history.clearAll': '清空全部记录',
  'history.copyText': '复制文本',
  'history.restoreTask': '还原任务',

  // ── toasts ──
  'history.audioMissing': '音频文件不存在',
  'history.audioLoadFailed': '音频加载失败',
  'history.noOrphanAudio': '没有发现孤儿音频',
  'history.pruneDone': '已清理 {count} 个孤儿音频',
  'history.deleted': '已删除',
  'history.clearedAll': '已清空历史记录',

  // ── dialogs ──
  'history.deleteConfirm': '确认删除',
  'history.deleteBody': '确认删除这条记录吗？将同时删除已生成的音频文件，此操作不可恢复。',
  'history.pruneBody': '发现 {count} 个音频文件已不对应任何历史记录，确认删除吗？此操作不可恢复。',
  'history.pruneAction': '确认清理',
} as const
