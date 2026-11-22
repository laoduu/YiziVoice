// zh-CN catalog fragment: clone (keys are dotted, e.g. 'clone.xxx')
export const clone = {
  // ── toasts / messages ──
  'clone.previewSampleText': '你好，这是一段用于试听的示例文本。',
  'clone.recordStartFailed': '无法开始录音',
  'clone.unsupportedFormat': '仅支持 WAV、MP3、WebM、OGG、FLAC 格式的音频文件',
  'clone.fileTooLarge': '文件大小不能超过 {n}MB',
  'clone.audioDecodeFailed': '音频文件解析失败，请确认文件格式正确',
  'clone.needApiKey': '请先在设置中配置 API Key',
  'clone.aiNoDescription': 'AI 未返回音色描述，请换个线索重试',
  'clone.aiBothGenerated': '音色描述与试听文本已生成',
  'clone.aiDescriptionKept': '音色描述已更新；试听文本已有内容，已保留',
  'clone.aiNoSampleText': '音色描述已更新，AI 未返回试听文本',
  'clone.designFailed': '音色设计失败，请重试',
  'clone.exportedCount': '已导出 {n} 个音色角色',
  'clone.exportCancelled': '导出已取消',
  'clone.exportFilename': 'YiziVoice_音色库_{date}.json',
  'clone.importNoData': '文件中没有找到音色数据',
  'clone.importDuplicates': '这些音色已经存在，无需重复导入',
  'clone.importedCount': '成功导入 {n} 个音色角色',
  'clone.importFailed': '导入失败：{msg}',
  'clone.invalidFile': '文件格式无效',
  'clone.cloneFailed': '音色复刻失败，请重试',
  'clone.categoryExists': '该分类已存在',
  'clone.roleRenamed': '已修改音色名称',
  'clone.previewFailed': '预览生成失败',

  // ── page header ──
  'clone.pageSubtitle': '录制或上传语音样本，也可以用文字设计音色',

  // ── capture panel ──
  'clone.submitSample': '提交音色样本',
  'clone.startRecording': '开始录音',
  'clone.stopRecording': '停止录音',
  'clone.recordingTime': '正在录音 {time}',
  'clone.recordedTime': '已录制 {time}',
  'clone.recordHint': '环境噪声会被一起刻进音色',
  'clone.uploadAudioFile': '上传音频文件',
  'clone.uploadFile': '上传文件',
  'clone.uploadHint': '已有干净录音时更稳',
  'clone.designVoice': '设计音色',
  'clone.designing': '正在设计…',
  'clone.designHint': '用描述生成，不用录音',
  'clone.uploadFormatsHint': '上传支持 WAV、MP3、WebM、OGG、FLAC，最大 {n}MB；文件也可以直接拖到这里',

  // ── design form ──
  'clone.designDescriptionLabel': '音色描述',
  'clone.aiGenerateTitle': '根据当前线索生成音色描述；试听文本仅在为空时填入',
  'clone.generating': '生成中…',
  'clone.aiGenerateButton': 'AI 生成描述与试听文本',
  'clone.designDescriptionPlaceholder': '三十岁女性，声音温柔清晰，语速略快慢但不生硬，自然生动，适合深夜电台，尾音略微上翘',
  'clone.sampleTextLabel': '试听文本',
  'clone.sampleTextHint': '留空则自动生成',
  'clone.sampleTextPlaceholder': '要朗读的内容；留空则由模型自动生成一段试听文案',
  'clone.designTip': '描述越具体，生成的声音越接近预期',
  'clone.generatePreview': '生成试听',
  'clone.regeneratePreview': '重新生成试听',

  // ── design result ──
  'clone.readTextLabel': '朗读文本：',
  'clone.confirmSaveRole': '确认并保存角色',
  'clone.cloning': '正在复刻音色…',
  'clone.autoSampleText': '自动生成的试听文本',
  'clone.designSampleName': '设计音色样本',

  // ── voice library ──
  'clone.myLibrary': '我的音色库',
  'clone.exportAll': '导出全部',
  'clone.import': '导入',
  'clone.emptyTitle': '暂无音色角色',
  'clone.emptyHint': '录制一段语音样本，创建第一个克隆角色',
  'clone.emptyGroup': '该分组暂无角色',

  // ── voice card actions ──
  'clone.playPreview': '试听播放',
  'clone.stopPreview': '停止试听',
  'clone.renameRole': '修改名称',
  'clone.moveTooltip': '移动分类',
  'clone.moveHeading': '移动该音色到分类：',
  'clone.deleteVoice': '删除音色',

  // ── category management ──
  'clone.categoryManage': '分类管理',
  'clone.newCategoryPlaceholder': '输入新分类名称',
  'clone.add': '添加',
  'clone.jumpToCategory': '点击跳转到音色库对应位置',
  'clone.confirmRename': '确认重命名',
  'clone.cancelRename': '取消重命名',
  'clone.renameCategory': '重命名分类',
  'clone.renameCategoryNamed': '重命名分类 {name}',
  'clone.deleteCategoryNamed': '删除分类 {name}',
  'clone.deleteCategoryTitle': '删除分类（角色将移至{cat}）',
  'clone.deleteCategoryHint': '删除分类时，分类下的角色会自动移至「{cat}」。角色的分类归属也可在卡片菜单中快速调整。',
  'clone.addCategory': '新增分类',
  'clone.confirmAdd': '确认添加',

  // ── save role dialog ──
  'clone.saveRoleTitle': '保存音色角色',
  'clone.saveRoleSubtitle': '试听预览效果，填写角色信息后保存',
  'clone.previewLabel': '音色预览',
  'clone.roleNameLabel': '角色名称',
  'clone.roleNamePlaceholder': '例如：小明的声音',
  'clone.categoryLabel': '分类',
  'clone.categoryNamePlaceholder': '分类名',

  // ── dialogs ──
  'clone.confirmDelete': '确认删除',
  'clone.deleteRoleConfirm': '确认删除这个音色角色吗？此操作不可恢复。',
  'clone.renameDialogSubtitle': '只改名字，音频样本、预览与分类都保持不变。',
  'clone.confirmDeleteCategory': '确认删除分类',
  'clone.deleteCategoryConfirm': '确定删除分类「{name}」吗？该分类下的角色将移至「{cat}」。',
} as const
