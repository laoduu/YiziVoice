// zh-CN catalog fragment: errors (keys are dotted, e.g. 'errors.xxx')
export const errors = {
  // ── generic ──
  'errors.fileTooLarge': '文件大小不能超过 {max}MB',
  'errors.generateFailed': '生成失败，请重试',
  'errors.apiKeyMissing': '请先配置 API Key',
  'errors.rateLimited': '请求过于频繁，请慢一点',
  'errors.contentSensitive': '你让我读的内容有点敏感',
  'errors.serverOverloaded': '大模型服务器超载，请稍后重试',
  'errors.modelNoContent': '模型未返回内容',
  'errors.modelParseFailed': 'AI 生成结果解析失败,请重试',

  // ── recording ──
  'errors.recordStartFailed': '无法开始录音',
  'errors.recordUnsupported': '当前环境不支持录音，请改用上传文件',
  'errors.micPermissionDenied': '未获得麦克风权限：请在系统设置中允许 YiziVoice 使用麦克风',
  'errors.micNotFound': '没有检测到麦克风设备',
  'errors.micInUse': '麦克风被其它程序占用，请关闭后重试',
  'errors.micUnsupportedParams': '麦克风不支持所需的录音参数',
  'errors.mediaComponentsMissing': '当前系统缺少录音所需的媒体组件',

  // ── storage / history ──
  'errors.audioReadFailed': '音频读取失败',
  'errors.downloadFailed': '下载失败',
  'errors.cleanupFailed': '清理失败',
  'errors.invalidVoiceFile': '无效的音色文件格式',
} as const
