// zh-CN catalog fragment: tutorial (keys are dotted, e.g. 'tutorial.xxx')
export const tutorial = {
  // ── hub tab ──
  'tutorial.tabDesc': '从配置到生成，一步步上手',

  // ── overview flow ──
  'tutorial.overviewTitle': '30 秒看懂',
  'tutorial.overviewHint': '点任意节点可直接跳转',
  'tutorial.flow.keys.label': '配置密钥与模型',
  'tutorial.flow.keys.caption': 'API Key + 文本模型',
  'tutorial.flow.voice.label': '准备音色',
  'tutorial.flow.voice.caption': '克隆 / 上传 / 设计',
  'tutorial.flow.tts.caption': '选音色、写文案、生成',
  'tutorial.flow.asr.caption': '录音或上传转文字',
  'tutorial.flow.history.label': '历史与导出',
  'tutorial.flow.history.caption': '回放 / 还原 / 下载',

  // ── step actions ──
  'tutorial.goSettings': '去设置',
  'tutorial.goClone': '去克隆音色',
  'tutorial.goTts': '去文生音',
  'tutorial.goAsr': '去音转文',

  // ── expand / collapse ──
  'tutorial.collapse': '收起',
  'tutorial.expandMore': '展开更多',

  // ── step 1: api key ──
  'tutorial.step1.title': '配置 API Key',
  'tutorial.step1.goal': '先让应用能调用 MiMo 接口',
  'tutorial.step1.b1': '打开「设置」（标题栏右上角齿轮，或 Ctrl+,）',
  'tutorial.step1.b2': '没有账号先 {link}；邀请码 {code} 可领 10 元体验金',
  'tutorial.step1.b2Link': '注册 MiMo 账号',
  'tutorial.step1.b3': '粘贴 Key 后点「验证」确认可用，再点输入框内的「保存」',
  'tutorial.step1.m1': 'Key 加密保存在系统钥匙串，保存后不再显示',
  'tutorial.step1.m2': '替换时输入新 Key；删除时点「清除」并在弹窗确认',
  'tutorial.step1.m3': '「验证」调用 /models 探针，不消耗 token',

  // ── step 2: ai text model ──
  'tutorial.step2.title': '配置 AI 文本模型',
  'tutorial.step2.goal': '决定「AI 生成」使用哪个文本模型',
  'tutorial.step2.b1': '同一设置页，API Key 下方是「AI 文本模型」',
  'tutorial.step2.b2': '默认 mimo-v2.6-flash；点「获取模型」列出当前 Key 可用的文本模型',
  'tutorial.step2.b3': '从下拉中选择会自动填入并保存，也可手动填写模型 ID',
  'tutorial.step2.m1': '用于「AI 生成风格描述」与「AI 生成描述与试听文本」',
  'tutorial.step2.m2': 'TTS 语音合成免费；ASR 与 2.6 系列文本模型付费，需账户余额',
  'tutorial.step2.m3': '建议使用 mimo-v2.6-flash，每次生成音色描述仅需几分钱',

  // ── step 3: voice clone ──
  'tutorial.step3.title': '音色克隆与设计',
  'tutorial.step3.goal': '先准备声音，再去文生音里使用',
  'tutorial.step3.b1': '三种入口：「开始录音」「上传文件」「设计音色」',
  'tutorial.step3.b2': '录音/上传后点「确认并保存角色」，试听并填写名称、分类',
  'tutorial.step3.b3': '设计音色可点右上角「AI 生成描述与试听文本」一次补全两段内容',
  'tutorial.step3.m1': '已手写的试听文本不会被 AI 覆盖',
  'tutorial.step3.m2': '设计音色默认归入「设计音色」分类',
  'tutorial.step3.m3': '设计音频会作为样本保存；文生音仍通过 voiceclone 复用',

  // ── step 4: tts ──
  'tutorial.step4.goal': '用选定音色把文案变成语音',
  'tutorial.step4.b1': '输入文案，在右侧音色库选择预置或克隆音色（可试听）',
  'tutorial.step4.b2': '选择风格写法：「标签方式」「自由描述」或「导演演绎」',
  'tutorial.step4.b3': '点击「生成语音」，完成后播放或下载 WAV',
  'tutorial.step4.m1': '标签方式：选风格胶囊，按需插入开头风格标签或内嵌音频标签',
  'tutorial.step4.m2': '自由描述 / 导演演绎：可点「AI 生成风格描述」补全',
  'tutorial.step4.m3': 'TTS 系列语音生成模型免费调用',

  // ── step 5: asr ──
  'tutorial.step5.goal': '把录音或音频文件转成文字',
  'tutorial.step5.b1': '进入「音转文」，点「开始录音」或上传音频文件',
  'tutorial.step5.b2': '识别完成后查看并复制文本',
  'tutorial.step5.b3': '录音来源的音频可在历史记录中回放',
  'tutorial.step5.m1': '上传来源不会复制音频到数据目录；原文件仍在原位置',
  'tutorial.step5.m2': 'ASR 语音转文字为付费模型，使用时需账户余额',

  // ── step 6: history ──
  'tutorial.step6.goal': '回看、还原或导出之前的结果',
  'tutorial.step6.b1': '左栏自动保存每次生成/识别，支持搜索与「全部 / 文生音 / 音转文」筛选',
  'tutorial.step6.b2': '悬停条目显示：播放、复制文本、还原任务、下载音频、删除',
  'tutorial.step6.b3': '「还原任务」仅文生音，会把模式、音色、风格、文本和结果音频一起装回',
  'tutorial.step6.m1': '播放中该行操作会整组保持可见',
  'tutorial.step6.m2': '右上角「…」可清理孤儿音频',
  'tutorial.step6.m3': '删除记录会同时删除对应音频',

  // ── storage section ──
  'tutorial.storageTitle': '文件与数据存储',
  'tutorial.storage1': '历史记录保存在「文档 / YiziVoice / History /」：index.json 是索引，tts/ 与 asr/ 存放对应音频',
  'tutorial.storage2': '音色、风格、音频标签等配置保存在「文档 / YiziVoice / config /」',
  'tutorial.storage3': '可在 设置 → 数据存储 中查看当前目录，并整体迁移到其它位置',
  'tutorial.storage4': 'API Key 不写入任何文件，只保存在系统钥匙串（Windows 凭据管理器 / macOS Keychain）',

  // ── mock sketches (tutorialMocks) ──
  'tutorial.mock.frame': '界面示意 · {label}',
  'tutorial.mock.settingsKey': '设置 · 接口密钥',
  'tutorial.mock.settingsModel': '设置 · AI 文本模型',
  'tutorial.mock.voiceSample': '克隆音色 · 提交音色样本',
  'tutorial.mock.keyHint': '保存后不再回显；替换时输入新 Key',
  'tutorial.mock.startRecording': '开始录音',
  'tutorial.mock.uploadFile': '上传文件',
  'tutorial.mock.designVoice': '设计音色',
  'tutorial.mock.voiceDesc': '音色描述',
  'tutorial.mock.aiGenBoth': 'AI 生成描述与试听文本',
  'tutorial.mock.voiceDescSample': '三十岁女性，声音温柔清晰…',
  'tutorial.mock.previewText': '试听文本',
  'tutorial.mock.previewPlaceholder': '留空则自动生成',
  'tutorial.mock.modeTags': '标签方式',
  'tutorial.mock.modeFree': '自由描述',
  'tutorial.mock.modeDirector': '导演演绎',
  'tutorial.mock.currentVoice': '当前音色：MiMo-默认',
  'tutorial.mock.textPlaceholder': '输入要朗读的文案…',
  'tutorial.mock.generate': '生成语音',
  'tutorial.mock.asrPlaceholder': '识别结果会显示在这里…',
  'tutorial.mock.copyHint': '可一键复制文本',
  'tutorial.mock.historyItem': '文生音 · 老独',
  'tutorial.mock.historyText': '(愤怒)你以为你断了我的代言，就能让我跪着求你？',
  'tutorial.mock.historyOpsHint': '悬停时显示操作：播放 / 复制 / 还原 / 下载 / 删除',
  'tutorial.mock.storageTree': '数据目录',
  'tutorial.mock.storageTreeText': '文档 / YiziVoice\n├─ History/\n│  ├─ index.json\n│  ├─ tts/\n│  └─ asr/\n└─ config/\n   ├─ voices/\n   ├─ styles/\n   └─ audio-tags/',
} as const
