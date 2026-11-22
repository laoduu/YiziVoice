import { useState, useRef, useEffect } from 'react'
import { AudioLines, ChevronDown, Play, Pause, Lightbulb, Plus, Search, Quote, Braces, Trash2, Tag, FileText, Drama } from 'lucide-react'
import { ttsGenerate, voiceCloneGenerate, PRESET_VOICES, getApiErrorMessage } from '../services/mimoApi'
import { saveTtsEntry, notifyHistoryUpdated, getHistoryAudioSrc, fmtEntryTime } from '../services/historyService'
import type { TtsHistoryEntry } from '../services/historyTypes'
import { useApp, PaneToggle } from '../App'
import { useToast } from '../components/Toast'
import { TagPickerPanel } from '../components/AudioTagMenu'
import { loadStyles, saveStyles, loadVoiceList, loadVoice, saveVoice, loadAppSettings } from '../services/configService'
import type { StyleItem } from '../services/configTypes'
import { Button } from '../components/ui/Button'
import { Textarea, Input } from '../components/ui/Input'
import { Chip } from '../components/ui/Chip'
import { AudioPlayer } from '../components/ui/AudioPlayer'
import { Segmented } from '../components/ui/Segmented'
import { NaturalLanguagePanel, useNaturalLanguageState } from '../components/tts/NaturalLanguagePanel'

function openExternalLink(url: string) {
  if ((window as any).desktopAPI?.openExternalLink) {
    (window as any).desktopAPI.openExternalLink(url)
  } else {
    window.open(url, '_blank')
  }
}

// v4: avatar colour used to be AVATAR_TONES[h % 4] - a hash rotation through FOUR
// semantic hues. That is decorative use of a semantic palette: green/amber imply a
// success/warning state that does not exist, and orange breaks the brand rule
// (hermes orange is reserved for clone semantics, recording, selected chips).
// A decorative identity glyph must not borrow the semantic palette.
const AVATAR_TONE = 'bg-accent-soft text-accent'

function AvatarInitial({ name }: { name: string }) {
  return (
    <span className={`w-7 h-7 shrink-0 rounded-full grid place-items-center text-xs font-semibold ${AVATAR_TONE}`}>
      {name.slice(0, 1)}
    </span>
  )
}

interface TtsResult {
  id: string
  src: string
  voiceName: string
  styleName?: string
  time: string
  // 仅"从历史还原"的结果带此项:下载必须按记录 id 走 Rust 读盘(不依赖 src 形态)。
  // 新生成的结果留空,继续用 data URL 直接下载(不依赖历史落盘是否成功)。
  historyId?: string
}

interface LegacyNaturalState {
  nlMode: 'paragraph' | 'director'
  nlParagraph?: string
  nlRole?: string
  nlScene?: string
  nlDirection?: string
}

// 导演模式的 prompt 历史上出现过两种前缀写法:「角色：」与「【角色】」,都要认
function pickDirectorField(prompt: string, label: string): string {
  for (const line of prompt.split('\n')) {
    for (const prefix of [`${label}：`, `【${label}】`]) {
      if (line.startsWith(prefix)) return line.slice(prefix.length).trim()
    }
  }
  return ''
}

// v2.0.4 及更早的记录只存了组装后的 userPrompt(style),没有界面状态字段。
// 若它不等于任何风格 chip 的值,说明当时走的是自然语言模式:
// 导演模式的 prompt 由 handleGenerate 逐行拼成,可确定性还原。
// 保守起见要求至少命中两个字段,避免把恰好以「角色：」开头的普通段落误判成导演模式。
function legacyNaturalState(style: string, styles: StyleItem[]): LegacyNaturalState | null {
  const prompt = style.trim()
  if (!prompt) return null
  if (styles.some(s => s.value === style)) return null

  const nlRole = pickDirectorField(prompt, '角色')
  const nlScene = pickDirectorField(prompt, '场景')
  const nlDirection = pickDirectorField(prompt, '指导')

  if ([nlRole, nlScene, nlDirection].filter(Boolean).length >= 2) {
    return { nlMode: 'director', nlRole, nlScene, nlDirection }
  }
  return { nlMode: 'paragraph', nlParagraph: prompt }
}

export default function TextToSpeech() {
  const { resetSignal, ttsLoadSignal, takeTtsEntry, rightOpen, toggleRight } = useApp()
  const [text, setText] = useState('')
  const [voice, setVoice] = useState('mimo_default')
  const [style, setStyle] = useState('')
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<TtsResult[]>([])

  const scrollRef = useRef<HTMLDivElement>(null)
  const voicePreviewRef = useRef<HTMLAudioElement>(null)
  const [previewingId, setPreviewingId] = useState('')
  const { showToast } = useToast()

  const [styles, setStyles] = useState<StyleItem[]>([])
  const [showAddStyle, setShowAddStyle] = useState(false)
  const [editingStyleId, setEditingStyleId] = useState<string | null>(null)
  const [newStyleLabel, setNewStyleLabel] = useState('')
  const [newStyleValue, setNewStyleValue] = useState('')

  const [voiceList, setVoiceList] = useState<any>({ voices: [], categories: [] })
  const [voiceQuery, setVoiceQuery] = useState('')
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())
  // 开场/内嵌标签面板（只在「标签方式」下出现）。展开状态只有这两个成员：风格 chips 不再需要
  // 「打开」这个动作 —— 选了标签方式它就在那儿。
  const [tagPanel, setTagPanel] = useState<'opening' | 'inline' | null>(null)
  const [ttsMode, setTtsMode] = useState<'tags' | 'natural'>('tags')
  const nl: ReturnType<typeof useNaturalLanguageState> = useNaturalLanguageState()
  nl.setText = setText
  nl.text = text   // 示例 chip 要知道正文是否已有内容:有内容就不覆盖

  // 三种「怎么写风格」互斥：都写同一条 user-content（见 handleGenerate 的注释）。底层仍是已有的
  // 两个状态（ttsMode + nl.nlMode），所以历史记录的读写格式一个字节都不改。
  const styleMethod: 'tags' | 'paragraph' | 'director' = ttsMode === 'tags' ? 'tags' : nl.nlMode
  const STYLE_METHOD_HINTS: Record<'tags' | 'paragraph' | 'director', string> = {
    tags: '用现成标签，最快、结果最稳',
    paragraph: '写一段话，最自由；可套示例或让 AI 帮写',
    director: '按角色 / 场景 / 指导三要素描述，表演意图最明确',
  }
  const setStyleMethod = (m: 'tags' | 'paragraph' | 'director') => {
    if (m === 'tags') {
      setTtsMode('tags')
    } else {
      setTtsMode('natural')
      nl.setNlMode(m)
    }
    setTagPanel(null)   // 两个标签插入面板只在标签方式下出现，切走时收起
  }

  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    async function loadData() {
      const stylesConfig = await loadStyles()
      setStyles(stylesConfig.styles)
      const voices = await loadVoiceList()
      setVoiceList(voices)
    }
    loadData()
  }, [])

  // 点击历史记录:完整还原生成时的编辑器状态(模式 → 子模式 → 参数 → 文本 → 展开面板 → 当时音频)
  const restoreFromEntry = async (entry: TtsHistoryEntry) => {
    setText(entry.text)
    setVoice(entry.voice)

    const legacy = entry.ttsMode ? null : legacyNaturalState(entry.style, styles)
    const mode = entry.ttsMode ?? (legacy ? 'natural' : 'tags')
    setTtsMode(mode)

    if (mode === 'natural') {
      nl.setNlMode(entry.nlMode ?? legacy?.nlMode ?? 'paragraph')
      nl.setNlParagraph(entry.nlParagraph ?? legacy?.nlParagraph ?? '')
      nl.setNlRole(entry.nlRole ?? legacy?.nlRole ?? '')
      nl.setNlScene(entry.nlScene ?? legacy?.nlScene ?? '')
      nl.setNlDirection(entry.nlDirection ?? legacy?.nlDirection ?? '')
      setTagPanel(null)
    } else {
      // tags 模式下 style 状态就是 chip 的值;自然语言模式下它是组装后的 prompt,不能塞进 style
      setStyle(entry.style)
      // 历史里的 openPanel 还可能是老值 'style'（那时风格 chips 要手动展开）；现在 chips 常显，
      // 只有 opening / inline 两个成员需要还原。
      setTagPanel(entry.openPanel === 'opening' || entry.openPanel === 'inline' ? entry.openPanel : null)
    }

    // 把当时的音频放回工作台并**替换**现有结果:否则文本/模式已换成历史的、结果还留着旧的,内容与结果不符
    try {
      const src = await getHistoryAudioSrc(entry)
      setResults([
        {
          id: entry.id,
          src,
          voiceName: entry.voiceName,
          styleName: entry.styleName,
          time: fmtEntryTime(entry.createdAt),
          historyId: entry.id,
        },
      ])
      showToast('已还原生成时的状态', 'info')
    } catch {
      setResults([])
      showToast('历史音频加载失败，仅还原了参数', 'error')
    }
  }

  useEffect(() => {
    if (ttsLoadSignal === 0) return
    // 取走即清:StrictMode 挂载期 effect 会跑两次,第二次拿到 null → 只还原一次、只弹一条提示
    const entry = takeTtsEntry()
    if (entry) void restoreFromEntry(entry)
  }, [ttsLoadSignal, takeTtsEntry])

  // resetSignal 只在"新建"时递增,但 effect 在挂载时也会跑一遍——会清掉同一轮挂载中
  // 刚还原好的历史状态(实际 bug:从别的页面第一次点历史记录看似无效,toast 却说已还原)。
  // 用"上次处理过的信号值"做门,只在真正变化时清理。
  // 不能用布尔量:StrictMode 下挂载期 effect 会执行两次,布尔量第二次就失效了。
  const handledReset = useRef(resetSignal)

  useEffect(() => {
    if (handledReset.current === resetSignal) return
    handledReset.current = resetSignal
    // 新建:清空文案、结果与自然语言草稿,保留音色/风格选择与模式
    setText('')
    setResults([])
    nl.setNlParagraph('')
    nl.setNlRole('')
    nl.setNlScene('')
    nl.setNlDirection('')
  }, [resetSignal])

  const handleStyleToggle = (value: string) => {
    setStyle(prev => (prev === value ? '' : value))
  }

  const PREVIEW_TEXT = '你好，我是你的语音助手'

  const handleVoicePreview = async (voiceId: string, profile?: { audioBase64: string; mimeType: string; previewAudioBase64?: string }) => {
    voicePreviewRef.current?.pause()
    if (previewingId === voiceId) {
      setPreviewingId('')
      return
    }
    const settings = await loadAppSettings()
    if (!settings.api.apiKeyConfigured) {
      showToast('请先在设置中配置 API Key')
      return
    }
    setPreviewingId(voiceId)
    try {
      let result: string | null = null
      if (profile) {
        if (profile.previewAudioBase64) {
          result = profile.previewAudioBase64
        } else {
          result = await voiceCloneGenerate({
            audioBase64: profile.audioBase64,
            mimeType: profile.mimeType,
            text: PREVIEW_TEXT,
          })
          if (result) {
            const targetId = voiceId.replace('clone_', '')
            const fullProfile = await loadVoice(targetId)
            if (fullProfile) {
              await saveVoice({ ...fullProfile, previewAudioBase64: result })
            }
          }
        }
      } else {
        result = await ttsGenerate({ text: PREVIEW_TEXT, voice: voiceId })
      }
      if (result && voicePreviewRef.current) {
        voicePreviewRef.current.src = result
        voicePreviewRef.current.play()
      } else {
        setPreviewingId('')
      }
    } catch (e) {
      showToast(getApiErrorMessage(e))
      setPreviewingId('')
    }
  }

  const handleSaveCustomStyle = async () => {
    if (!newStyleLabel.trim() || !newStyleValue.trim()) return
    const label = newStyleLabel.trim()
    const value = newStyleValue.trim()
    let newStyles: StyleItem[]
    if (editingStyleId) {
      newStyles = styles.map(s => (s.id === editingStyleId ? { ...s, label, value } : s))
    } else {
      const newStyle: StyleItem = {
        id: `custom_${Date.now()}`,
        label,
        value,
        builtin: false,
      }
      newStyles = [...styles, newStyle]
    }
    setStyles(newStyles)
    await saveStyles(newStyles)
    setNewStyleLabel('')
    setNewStyleValue('')
    setEditingStyleId(null)
    setShowAddStyle(false)
  }

  const handleStartEditStyle = (s: StyleItem) => {
    setNewStyleLabel(s.label)
    setNewStyleValue(s.value)
    setEditingStyleId(s.id)
    setShowAddStyle(true)
  }

  const handleCancelStyleForm = () => {
    setNewStyleLabel('')
    setNewStyleValue('')
    setEditingStyleId(null)
    setShowAddStyle(false)
  }

  const handleRemoveCustomStyle = async (id: string) => {
    const newStyles = styles.filter(s => s.id !== id)
    setStyles(newStyles)
    await saveStyles(newStyles)
  }

  const handleGenerate = async () => {
    if (!text.trim()) return
    const settings = await loadAppSettings()
    if (!settings.api.apiKeyConfigured) {
      showToast('请先在设置中配置 API Key')
      return
    }

    // 一次只发一条 user-content:natural 模式用 NL 草稿,tags 模式用 chip style
    let userPrompt: string | undefined
    let displayStyleName: string | undefined
    if (ttsMode === 'natural') {
      if (nl.nlMode === 'paragraph') {
        userPrompt = nl.nlParagraph.trim() || undefined
      } else {
        const parts: string[] = []
        if (nl.nlRole.trim()) parts.push(`角色：${nl.nlRole.trim()}`)
        if (nl.nlScene.trim()) parts.push(`场景：${nl.nlScene.trim()}`)
        if (nl.nlDirection.trim()) parts.push(`指导：${nl.nlDirection.trim()}`)
        userPrompt = parts.length > 0 ? parts.join('\n') : undefined
      }
    } else {
      userPrompt = style.trim() || undefined
      if (userPrompt) displayStyleName = styles.find(s => s.value === style)?.label
    }
    if (displayStyleName === undefined && userPrompt) {
      if (ttsMode === 'natural' && nl.nlMode === 'director') {
        displayStyleName = '导演模式'
      } else if (ttsMode === 'natural') {
        displayStyleName = userPrompt.slice(0, 16).replace(/\s+/g, ' ').trim() || '自然语言描述'
      } else if (ttsMode === 'tags') {
        displayStyleName = style.slice(0, 16)
      }
    }

    setLoading(true)
    try {
      let result: string | null = null
      if (voice.startsWith('clone_')) {
        const profileId = voice.replace('clone_', '')
        const profile = await loadVoice(profileId)
        if (!profile) {
          showToast('克隆音色角色不存在，请重新选择')
          setLoading(false)
          return
        }
        result = await voiceCloneGenerate({
          audioBase64: profile.audioBase64,
          mimeType: profile.mimeType,
          text: text.trim(),
          style: userPrompt,
        })
      } else {
        result = await ttsGenerate({
          text: text.trim(),
          voice,
          style: userPrompt,
        })
      }
      if (result) {
        const profileId = voice.startsWith('clone_') ? voice.slice('clone_'.length) : null
        const voiceName = profileId
          ? voiceList.voices.find((v: any) => v.id === profileId)?.name ?? profileId
          : PRESET_VOICES.find(v => v.id === voice)?.name ?? voice
        const item: TtsResult = {
          id: `${Date.now()}`,
          src: result,
          voiceName,
          styleName: displayStyleName,
          time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
        }
        setResults(prev => [...prev, item])
        try {
          await saveTtsEntry({
            text: text.trim(),
            voice,
            voiceName,
            style: userPrompt ?? '',
            styleName: displayStyleName ?? userPrompt?.slice(0, 16) ?? '',
            audioDataUrl: result,
            // 生成时的界面状态:供点击历史记录时完整还原
            ttsMode,
            nlMode: ttsMode === 'natural' ? nl.nlMode : undefined,
            nlParagraph: ttsMode === 'natural' ? nl.nlParagraph : undefined,
            nlRole: ttsMode === 'natural' ? nl.nlRole : undefined,
            nlScene: ttsMode === 'natural' ? nl.nlScene : undefined,
            nlDirection: ttsMode === 'natural' ? nl.nlDirection : undefined,
            // 字段名沿用 openPanel：历史 schema 不改，但值域已收窄为 opening | inline
            openPanel: ttsMode === 'tags' ? tagPanel ?? undefined : undefined,
          })
          notifyHistoryUpdated()
        } catch (e) {
          console.error('[TTS] Failed to save history:', e)
        }
      } else {
        showToast('生成失败，请重试')
      }
    } catch (e) {
      showToast(getApiErrorMessage(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (results.length > 0 && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [results])

  // —— 音色数据整理 ——
  const q = voiceQuery.trim().toLowerCase()
  const presetGroups = [
    { key: 'zh', label: '中文音色', voices: PRESET_VOICES.filter(v => v.lang === '中文' && (!q || v.name.toLowerCase().includes(q))) },
    { key: 'en', label: '英文音色', voices: PRESET_VOICES.filter(v => v.lang === '英文' && (!q || v.name.toLowerCase().includes(q))) },
  ].filter(g => g.voices.length > 0)

  const clonedGroups: Record<string, any[]> = {}
  voiceList.voices.forEach((p: any) => {
    const cat = p.category || '未分类'
    if (!clonedGroups[cat]) clonedGroups[cat] = []
    clonedGroups[cat].push(p)
  })

  const toggleGroup = (key: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const renderGroupHeader = (key: string, label: string, count: number) => (
    <button
      type="button"
      onClick={() => toggleGroup(key)}
      className="w-full flex items-center gap-1 px-1 mb-1 text-sm font-medium text-ink-2 cursor-pointer select-none hover:text-ink-2"
    >
      <ChevronDown size={14} className={`transition-transform duration-100 ${collapsedGroups.has(key) ? '-rotate-90' : ''}`} />
      {label}
      <span className="opacity-60">{count}</span>
    </button>
  )

  // 当前选中音色名(工具条徽章用)
  const currentVoiceName = (() => {
    if (voice.startsWith('clone_')) {
      const id = voice.slice(6)
      return voiceList.voices.find((v: any) => v.id === id)?.name ?? '克隆音色'
    }
    return PRESET_VOICES.find(v => v.id === voice)?.name ?? ''
  })()

  // 选中态统一:左侧 accent 描边 + 激活底色;克隆音色仅徽章色不同
  const voiceRowCls = (selected: boolean) =>
    `w-full flex items-center gap-2.5 px-2 py-1.5 rounded-sm border-l-2 cursor-pointer transition-colors duration-100 ease-out text-left ${
      selected ? 'bg-surface-active border-accent' : 'border-transparent hover:bg-surface-hover'
    }`

  return (
    <div className="h-full flex gap-2 min-h-0">
      {/* 中央编辑台 */}
      <section className="mat-panel flex-1 min-w-0 flex flex-col">
        <div className="px-5 pt-4 pb-3 border-b border-line flex items-start justify-between shrink-0">
          {/* v4: the tool icon is the "feature icon" role (30px). It must balance the
              two-line title+subtitle block beside it, so it is sized against the block
              height (~50px), not against the 20px title alone. */}
          <div className="flex items-center gap-3 min-w-0">
            <AudioLines size={30} className="text-accent shrink-0" />
            <div className="min-w-0">
              <h2 className="text-xl font-semibold text-ink tracking-[-0.01em]">文生音</h2>
              <p className="text-sm text-ink-2 mt-0.5">输入文案，选择右侧音色与风格，一键生成语音</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="flex items-center gap-1.5 text-sm px-2 py-1 rounded-full bg-accent-softer text-ink-2">
              <Lightbulb size={14} className="text-accent" />
              推荐用
              <button
                onClick={() => openExternalLink('https://md.yizigpt.com')}
                className="font-medium text-accent hover:underline cursor-pointer"
              >
                YiziMarkdown
              </button>
            </div>
            {!rightOpen && (
              <PaneToggle side="right" open={rightOpen} onToggle={toggleRight} />
            )}
          </div>
        </div>

        <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-3">
          {/* 语音设置卡 */}
          <div className="mat-card p-3.5 space-y-2.5">
            <div className="flex items-center gap-2 flex-wrap">
              {/* 一级 + 二级合并成一排三选一：三者互斥（都写同一条 user-content）。
                  图标随伴读文字取 14px（§5.8 规则一），三个选项同规格。 */}
              <Segmented
                size="sm"
                value={styleMethod}
                onChange={setStyleMethod}
                options={[
                  { value: 'tags', label: <span className="inline-flex items-center gap-1"><Tag size={14} />标签方式</span> },
                  { value: 'paragraph', label: <span className="inline-flex items-center gap-1"><FileText size={14} />自由描述</span> },
                  { value: 'director', label: <span className="inline-flex items-center gap-1"><Drama size={14} />导演演绎</span> },
                ]}
              />
              {currentVoiceName && (
                /* 这是**状态**不是选择器:只说明现在用的是哪个音色。换音色/展开音色库走侧栏开关
                   （PaneToggle，同一个动作只留一个入口），所以这里不给 cursor/hover 这些可点暗示。 */
                <span
                  title="当前使用的音色"
                  className="ml-auto inline-flex items-center gap-1.5 h-[30px] px-2.5 rounded-full bg-accent-soft text-accent text-sm font-medium max-w-[180px]"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" />
                  <span className="truncate">当前音色：{currentVoiceName}</span>
                </span>
              )}
            </div>
            {/* 只显示当前方式那一条：说明贴在它所属的选项下面，不写成让人自己映射的对比句 */}
            <p className="text-xs text-ink-3">{STYLE_METHOD_HINTS[styleMethod]}</p>

            {/* 风格 chips 常显：选了「标签方式」它就在这儿，不必再点一次展开。
                它写的是 userPrompt（风格）；开场/内嵌标签写正文，故在「朗读文本」卡里。 */}
            {ttsMode === 'tags' ? (
              <div className="animate-pop-in">
                <div className="flex flex-wrap gap-1.5 items-center">
                  {styles.map(s => (
                    <Chip
                      key={s.id}
                      selected={style === s.value}
                      onDelete={!s.builtin ? () => handleRemoveCustomStyle(s.id) : undefined}
                      onEdit={!s.builtin ? () => handleStartEditStyle(s) : undefined}
                      onClick={() => handleStyleToggle(s.value)}
                    >
                      {s.label}
                    </Chip>
                  ))}
                  <button
                    type="button"
                    aria-label="添加自定义风格"
                    title="添加自定义风格"
                    onClick={() => {
                      setNewStyleLabel('')
                      setNewStyleValue('')
                      setEditingStyleId(null)
                      setShowAddStyle(true)
                    }}
                    className="inline-flex items-center justify-center w-6 h-6 rounded-full text-sm cursor-pointer transition-all bg-surface-hover text-accent hover:bg-accent-soft"
                  >
                    <Plus size={12} />
                  </button>
                </div>

                {showAddStyle && (
                  <div className="mt-3 mat-card p-3 space-y-2.5">
                    <p className="text-xs font-semibold text-ink-2">
                      {editingStyleId ? '修改自定义风格' : '新增自定义风格'}
                    </p>
                    <Input placeholder="标签名" value={newStyleLabel} onChange={e => setNewStyleLabel(e.target.value)} />
                    <Input
                      placeholder="风格描述，如：用慵懒低沉的语调，语速缓慢"
                      value={newStyleValue}
                      onChange={e => setNewStyleValue(e.target.value)}
                    />
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="sm" onClick={handleCancelStyleForm}>取消</Button>
                      <Button
                        variant="primary"
                        size="sm"
                        disabled={!newStyleLabel.trim() || !newStyleValue.trim()}
                        onClick={handleSaveCustomStyle}
                      >
                        保存
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <NaturalLanguagePanel {...nl} />
            )}
          </div>

          {/* 朗读文本卡 */}
          <div className="mat-card p-3.5 space-y-2">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-ink-2">朗读文本</p>
                <p className="text-xs text-ink-3 mt-0.5">输入要转换为语音的文案，可使用右侧音色库</p>
              </div>
              {text && (
                <button
                  type="button"
                  aria-label="清空朗读文本"
                  title="清空"
                  onClick={() => { setText(''); textareaRef.current?.focus() }}
                  className="w-6 h-6 rounded-sm grid place-items-center text-ink-3 hover:text-danger-text hover:bg-danger-soft cursor-pointer transition-colors"
                >
                  <Trash2 size={12} />
                </button>
              )}
            </div>
            {ttsMode === 'tags' && (
              <>
                {/* 开场 / 内嵌标签是「往正文里插标签」的工具（开场前置/并进开头括号，内嵌插在光标处）。
                    它们只在「标签方式」下出现：那是唯一会用到「标签」这个词的地方。 */}
                <div className="flex items-center gap-2 flex-wrap">
                  {([
                    { key: 'opening', label: '开场标签', Icon: Quote },
                    { key: 'inline', label: '内嵌标签', Icon: Braces },
                  ] as const).map(({ key, label, Icon }) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setTagPanel(p => (p === key ? null : key))}
                      className={`inline-flex items-center gap-1.5 h-[34px] px-3.5 rounded-sm text-sm font-medium border cursor-pointer transition-all duration-100 ease-out whitespace-nowrap shrink-0 ${
                        tagPanel === key
                          ? 'trigger-active'
                          : 'bg-surface-2 border-line text-ink hover:bg-surface-hover'
                      }`}
                    >
                      <Icon size={14} />
                      {label}
                      <ChevronDown size={14} className={`transition-transform duration-100 ${tagPanel === key ? 'rotate-180' : ''}`} />
                    </button>
                  ))}
                  <span className="hidden min-[1280px]:inline text-xs text-ink-3">点击展开，选择后插入文案</span>
                </div>

                {tagPanel === 'opening' && (
                  <div className="animate-pop-in">
                    <TagPickerPanel type="opening" onInsert={(tag) => {
                      setText(prev => {
                        const match = prev.match(/^\(([^)]*)\)/)
                        if (match) {
                          const existing = match[1].trim()
                          if (existing.includes(tag)) return prev
                          return `(${existing} ${tag})` + prev.slice(match[0].length)
                        }
                        return `(${tag})${prev}`
                      })
                    }} />
                  </div>
                )}

                {tagPanel === 'inline' && (
                  <div className="animate-pop-in">
                    <TagPickerPanel type="inline" onInsert={(tag) => {
                      const ta = textareaRef.current
                      const start = ta ? ta.selectionStart : text.length
                      const end = ta ? ta.selectionEnd : text.length
                      const before = text.slice(0, start)
                      const after = text.slice(end)
                      setText(`${before}（${tag}）${after}`)
                      requestAnimationFrame(() => {
                        if (ta) {
                          ta.focus()
                          const pos = start + tag.length + 2
                          ta.setSelectionRange(pos, pos)
                        }
                      })
                    }} />
                  </div>
                )}
              </>
            )}

            {/* 字数统一放在多行文本域的右下角(与自然语言面板一致),不再单独占一行 */}
            <div className="relative">
              <Textarea
                ref={textareaRef}
                className="h-[170px] resize-none pr-14 placeholder:text-xs"
                placeholder="在此输入或粘贴要转换为语音的文案…"
                value={text}
                onChange={e => setText(e.target.value)}
              />
              <span className="absolute bottom-2 right-2 h-6 flex items-center text-xs text-ink-3 tabular-nums pointer-events-none">
                {text.length} 字
              </span>
            </div>
          </div>

          {/* 结果列表 */}
          {results.length > 0 ? (
            <div className="space-y-2">
              {results.map(r => (
                <div key={r.id}>
                  <p className="text-xs text-ink-3 mb-1 px-0.5">
                    {r.voiceName}
                    {r.styleName ? ` · ${r.styleName}` : ''} · {r.time}
                  </p>
                  <AudioPlayer src={r.src} historyId={r.historyId} />
                </div>
              ))}
            </div>
          ) : (
            <div className="py-6 text-center">
              <p className="text-xs text-ink-3">生成的语音会显示在这里</p>
            </div>
          )}
        </div>

        <div className="px-4 py-3 border-t border-line flex items-center justify-end shrink-0">
          <Button variant="primary" size="lg" loading={loading} disabled={!text.trim()} onClick={handleGenerate}>
            {loading ? '生成中…' : '生成语音'}
          </Button>
        </div>
      </section>

      {/* 右侧配置面板 */}
      {rightOpen && (
        <aside className="mat-panel w-[300px] shrink-0 flex flex-col mat-clip">
          <div className="flex-1 min-h-0 overflow-y-auto p-4">
            <audio ref={voicePreviewRef} onEnded={() => setPreviewingId('')} />

            {/* 音色库 */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-base font-semibold text-ink">音色库</h3>
                <div className="flex items-center gap-2">
                  <div className="relative w-[120px]">
                    <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-ink-3 pointer-events-none" />
                    <input
                      value={voiceQuery}
                      onChange={e => setVoiceQuery(e.target.value)}
                      placeholder="搜索音色"
                      className="w-full h-[26px] pl-7 pr-2 rounded-sm bg-surface-2 border border-line text-xs text-ink placeholder:text-ink-3 outline-none focus:border-accent transition-colors"
                    />
                  </div>
                  <PaneToggle side="right" open={rightOpen} onToggle={toggleRight} />
                </div>
              </div>

            <div className="space-y-3">
              {presetGroups.map(group => (
                <div key={group.key}>
                  {renderGroupHeader(`preset-${group.key}`, group.label, group.voices.length)}
                  {!collapsedGroups.has(`preset-${group.key}`) && (
                    <div className="space-y-0.5">
                      {group.voices.map(v => {
                        const selected = voice === v.id
                        return (
                          <div key={v.id} className="relative group">
                            <button
                              type="button"
                              className={voiceRowCls(selected)}
                              onClick={() => setVoice(v.id)}
                            >
                              <AvatarInitial name={v.name} />
                              <span className="flex-1 min-w-0 truncate text-sm font-medium text-ink">
                                {v.name}
                              </span>
                              {/* v4: text-3 then measured 4.28:1 on the selected row's accent
                                  tint, so this was pushed up to text-2.
                                  v4.1: --text-3 was raised to 64% and now clears the worst
                                  backdrop (accent-soft) at 4.5:1+, so the exception is gone and
                                  this rejoins its real role: caption = text-ink-3. */}
                              <span className="text-xs text-ink-3">{v.gender}</span>
                            </button>
                            <button
                              type="button"
                              aria-label="试听"
                              title="试听"
                              onClick={e => { e.stopPropagation(); handleVoicePreview(v.id) }}
                              className={`absolute right-9 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full grid place-items-center cursor-pointer transition-all ${
                                previewingId === v.id
                                  ? 'bg-accent-strong text-accent-on opacity-100'
                                  : 'opacity-0 group-hover:opacity-100 bg-surface-hover text-ink-2 hover:text-accent'
                              }`}
                            >
                              {previewingId === v.id ? <Pause size={12} /> : <Play size={12} />}
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              ))}

              {Object.keys(clonedGroups).length > 0 && (
                <div>
                  {renderGroupHeader('clone', '克隆音色', Object.values(clonedGroups).flat().length)}
                  {!collapsedGroups.has('clone') &&
                    Object.entries(clonedGroups).map(([cat, items]) => (
                      <div key={cat} className="mb-2">
                        <p className="text-xs text-ink-3 ml-1 mb-0.5">{cat}</p>
                        <div className="space-y-0.5">
                          {items.map((p: any) => {
                            const vid = `clone_${p.id}`
                            const selected = voice === vid
                            return (
                              <div key={p.id} className="relative group">
                                <button
                                  type="button"
                                  className={voiceRowCls(selected)}
                                  onClick={() => setVoice(vid)}
                                >
                                  <AvatarInitial name={p.name} />
                                  <span className="flex-1 min-w-0 truncate text-sm font-medium text-ink">
                                    {p.name}
                                  </span>
                                  <span className="text-xs px-1.5 py-px rounded-full bg-accent-2-soft text-accent-2-text">克隆</span>
                                </button>
                                <button
                                  type="button"
                                  aria-label="试听"
                                  title="试听"
                                  onClick={async e => {
                                    e.stopPropagation()
                                    const full = await loadVoice(p.id)
                                    if (full) handleVoicePreview(vid, full)
                                  }}
                                  className={`absolute right-9 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full grid place-items-center cursor-pointer transition-all ${
                                    previewingId === vid
                                      ? 'bg-accent-strong text-accent-on opacity-100'
                                      : 'opacity-0 group-hover:opacity-100 bg-surface-hover text-ink-2 hover:text-accent'
                                  }`}
                                >
                                  {previewingId === vid ? <Pause size={12} /> : <Play size={12} />}
                                </button>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </section>
          </div>
        </aside>
      )}
    </div>
  )
}
