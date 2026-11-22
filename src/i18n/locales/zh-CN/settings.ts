// zh-CN catalog fragment: settings (keys are dotted, e.g. 'settings.xxx')
export const settings = {
  'settings.language': '界面语言',
  'settings.languageHint': '切换后立即生效，并保存到本机设置',

  // ── hub tab ──
  'settings.tabDesc': '接口密钥、AI 文本模型与数据存储位置',

  // ── api key ──
  'settings.apiKey': '接口密钥',
  'settings.keyStorageHint': '加密存放于系统钥匙串（Windows 凭据管理器 / macOS 钥匙串），保存后不可回看',
  'settings.keyStorageAria': '密钥存储说明',
  'settings.clear': '清除',
  'settings.verify': '验证',
  'settings.verifying': '验证中',
  'settings.verifyOk': '验证通过',
  'settings.verifyFailed': '验证失败',
  'settings.keyConfigured': '已配置',
  'settings.keyNotConfigured': '未配置',
  'settings.keyPlaceholderSaved': '已加密保存，输入新 Key 可替换',
  'settings.noApiKeyYet': '还没有 API Key？',
  'settings.openRegisterTitle': '在浏览器中打开 MiMo 平台注册页',
  'settings.inviteCode': '邀请码',
  'settings.keySaved': 'API Key 已加密保存',
  'settings.keySaveFailed': 'API Key 未能写入系统凭据库',
  'settings.keyCleared': 'API Key 已清除',
  'settings.keyClearFailed': '清除 API Key 失败',
  'settings.clearKeyTitle': '清除 API Key',
  'settings.clearKeySubtitle': '清除后需要重新输入 Key 才能继续使用语音功能。',
  'settings.clearKeyConfirm': '确认清除',

  // ── ai text model ──
  'settings.textModel': 'AI 文本模型',
  'settings.textModelHint': '用于本应用内 AI 生成风格描述',
  'settings.textModelAria': '文本模型用途',
  'settings.fetchModels': '获取模型',
  'settings.fetchModelsFailed': '获取模型失败',
  'settings.noModels': '没有可用的文本模型',
  'settings.modelSaved': 'AI 文本模型已更新',
  'settings.modelSavedKeyringFailed': '模型已保存，但凭据库操作失败',
  'settings.pricingHint': '友情提示：MiMo-TTS系列语音生成模型免费调用，而MiMo-ASR语音转文字模型和MiMo-2.6系列文本生成模型，为付费模型，使用时需账户有余额，注册后填写右侧邀请码可额外获得10元体验金。',
  'settings.modelSuggestion': '建议使用mimo-v2.6-flash，性能足够，每次生成音色描述仅需几分钱。',

  // ── data storage ──
  'settings.dataStorage': '数据存储',
  'settings.currentDataDir': '当前数据目录',
  'settings.customDir': '自定义',
  'settings.dirLoading': '读取中…',
  'settings.selectDir': '选择目录',
  'settings.migrateToDir': '迁移到所选目录',
  'settings.resetDir': '恢复默认',
  'settings.willMigrateTo': '将迁移到：{dir}',
  'settings.defaultDirHint': '默认位于「文档 / YiziVoice /」，支持整体迁移',
  'settings.migrateDone': '数据迁移完成，新目录已生效',
  'settings.migrateFailed': '迁移失败',
  'settings.migrateFailedWith': '迁移失败：{message}',
  'settings.unknownError': '未知错误',
  'settings.dirResetDone': '已恢复默认目录',
} as const
