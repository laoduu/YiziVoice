import { useState, useRef, useEffect } from 'react'
import {
  Mic, Upload, ScanFace, Download, FolderOpen, Play, Square, Trash2,
  FolderInput, Plus, X, Check, Pencil, Loader2, Palette, Wand2,
} from 'lucide-react'
import { voiceCloneGenerate, voiceDesignGenerate, textGenerate, getApiErrorMessage } from '../services/mimoApi'
import { startRecording, stopRecording, RecordingResult } from '../services/audioRecorder'
import { VoiceProfile, exportVoiceProfiles, importVoiceProfiles, downloadFile } from '../services/storage'
import {
  loadVoiceList, loadVoice, saveVoice, deleteVoice, loadAppSettings,
  loadVoiceCategories, saveVoiceCategories, updateVoiceCategory, reassignVoiceCategory,
  renameVoiceCategory,
} from '../services/configService'
import { notifyHistoryUpdated } from '../services/historyService'
import { useApp, PaneToggle } from '../App'
import { ENTRY_DISC, ENTRY_DISC_IDLE, ENTRY_DISC_RECORDING } from '../components/ui/entryDisc'
import { useToast } from '../components/Toast'
import { Button } from '../components/ui/Button'
import { Input, Textarea } from '../components/ui/Input'
import { Chip } from '../components/ui/Chip'
import { DropdownMenu } from '../components/ui/DropdownMenu'
import { AudioPlayer } from '../components/ui/AudioPlayer'
import { Dialog } from '../components/ui/Dialog'
import { EmptyState } from '../components/ui/Skeleton'
import { Tooltip } from '../components/ui/Tooltip'
import { useI18n } from '../i18n/react'


// Preview text is localized at use sites via tr('clone.previewText').

// AI text prompt for the voicedesign form. It returns both the voice description and
// a short audition line, because one button filling both is the whole point of the entry.
const VOICE_DESIGN_AI_PROMPT = `你是 MiMo，小米公司开发的 AI 助手。你的任务是把用户给出的简短音色线索，扩写成一段可直接用于 MiMo 语音合成「音色设计（voicedesign）」的中文音色描述，并配一句适合这个声音试听的短文本。

严格只返回 JSON，不要任何解释、注释、Markdown 代码块。

JSON 格式：
{"description": string, "sampleText": string}

要求：
- description 为 2–4 句中文，总长度约 40–90 个汉字，覆盖性别与年龄感、音色质地、语速与节奏、咬字与气息、情绪底色、适用场景。
- sampleText 为 1 句中文，约 15–40 个汉字，自然口语，像这个声音会当场说的一句话；能体现音色与情绪，不要舞台提示、括号、引号、标签，也不要广告词或播音腔。
- description 与 sampleText 必须属于同一个声音、同一个场景，彼此不矛盾。
- 用具体、能形成画面的描述，不要堆叠空泛形容词；整体要自然，避免机械、生硬。
- 保留用户输入里的核心设定，只做补充和润色，不要换成另一种声音。
- 按下面的语体与密度参考，但不要照抄：

参考示例 1（深夜电台）：
{"description":"三十岁女性，声音温柔清晰，语速略慢但不拖沓，自然生动，适合深夜电台，尾音略微上翘。","sampleText":"晚上好，欢迎收听今晚的节目。"}

参考示例 2（江湖大侠）：
{"description":"四十岁上下的男性，嗓音低沉厚实，胸腔共鸣明显，咬字干脆有力，语速偏快，情绪豪迈中带一点疲惫，适合武侠叙事。","sampleText":"在下行走江湖多年，还没怕过谁。"}

只输出 JSON，不要生成额外解释。`

// The voicedesign response is always a `data:audio/wav;base64,...` URL. Saving a
// role stores the raw sample (this model returns no reusable voice id), and later
// TTS sends it through voiceclone.
function dataUrlToSample(url: string): { base64: string; mimeType: string } | null {
  const marker = ';base64,'
  const at = url.indexOf(marker)
  if (at < 0 || !url.startsWith('data:')) return null
  const mimeType = url.slice(5, at)
  return { base64: url.slice(at + marker.length), mimeType }
}

async function fileToRecordingResult(file: File): Promise<RecordingResult> {
  const blob = file
  const arrayBuffer = await blob.arrayBuffer()
  const audioCtx = new OfflineAudioContext(1, 1, 24000)
  const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer)
  const wavBase64 = encodeAudioBufferToWavBase64(audioBuffer)
  return {
    blob,
    base64: wavBase64,
    mimeType: file.type || 'audio/wav',
    wavBase64,
    duration: audioBuffer.duration,
  }
}

function encodeAudioBufferToWavBase64(audioBuffer: AudioBuffer): string {
  const numChannels = 1
  const sampleRate = audioBuffer.sampleRate
  const format = 1
  const bitDepth = 16
  const samples = audioBuffer.getChannelData(0)
  const bytesPerSample = bitDepth / 8
  const blockAlign = numChannels * bytesPerSample
  const dataSize = samples.length * bytesPerSample
  const bufferSize = 44 + dataSize
  const buffer = new ArrayBuffer(bufferSize)
  const view = new DataView(buffer)
  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i))
  }
  writeString(0, 'RIFF')
  view.setUint32(4, bufferSize - 8, true)
  writeString(8, 'WAVE')
  writeString(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, format, true)
  view.setUint16(22, numChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint16(28, sampleRate * blockAlign, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, bitDepth, true)
  writeString(36, 'data')
  view.setUint32(40, dataSize, true)
  let offset = 44
  for (let i = 0; i < samples.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]))
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true)
  }
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary)
}

export default function VoiceClone() {
  const { resetSignal, rightOpen, toggleRight } = useApp()
  const libraryScrollRef = useRef<HTMLDivElement>(null)
  const [recording, setRecording] = useState(false)
  const [recordingResult, setRecordingResult] = useState<RecordingResult | null>(null)
  // 音色设计（voicedesign）：文字描述 → 生成一段样本，后续仍按“样本 → voiceclone”复用
  const [designOpen, setDesignOpen] = useState(false)
  const [designDescription, setDesignDescription] = useState('')
  const [designText, setDesignText] = useState('')
  const [designGenerating, setDesignGenerating] = useState(false)
  const [designAiLoading, setDesignAiLoading] = useState(false)
  const [designAudio, setDesignAudio] = useState('')
  const [designPreviewText, setDesignPreviewText] = useState('')
  const designResultRef = useRef<HTMLDivElement>(null)
  // Read the audition field from the DOM at click time: React state can lag behind an
  // in-progress IME composition, which would make a non-empty field look empty.
  const designTextInputRef = useRef<HTMLInputElement>(null)
  const { t: tr } = useI18n()
  const [voiceList, setVoiceList] = useState<any>({ voices: [], categories: [] })
  const [timer, setTimer] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval>>()
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const importFileRef = useRef<HTMLInputElement>(null)

  const [showModal, setShowModal] = useState(false)
  const [cloning, setCloning] = useState(false)
  const [previewAudio, setPreviewAudio] = useState('')
  const [previewText, setPreviewText] = useState(tr('clone.previewText'))
  const [profileName, setProfileName] = useState('')
  const [profileCategory, setProfileCategory] = useState('')

  // 正在播放试听的角色 id：播放期间整排操作保持可见（§5.9-4），播完 onEnded 清空即自动收起
  const [previewingProfileId, setPreviewingProfileId] = useState('')
  // 正在生成试听样本的角色 id（首次试听要合成一次）。「生成中」与「播放中」是两件事：
  // 前者是转圈，后者是停止键 —— 早先两者共用一个 id，合成结束就把它清了，于是播放期间
  // 卡片根本不知道自己在播，整排操作会跟着鼠标一起消失
  const [previewLoadingId, setPreviewLoadingId] = useState('')
  const profilePreviewRef = useRef<HTMLAudioElement>(null)
  const previewAudioRef = useRef<HTMLAudioElement>(null)
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null)
  const [deleteCategoryName, setDeleteCategoryName] = useState<string | null>(null)
  const [renameTargetId, setRenameTargetId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const { showToast } = useToast()

  const [newCategory, setNewCategory] = useState('')
  const [addingCategoryInModal, setAddingCategoryInModal] = useState(false)
  const [modalNewCategory, setModalNewCategory] = useState('')

  const [renamingCategory, setRenamingCategory] = useState<string | null>(null)
  const [renameDraft, setRenameDraft] = useState('')

  // 只在 resetSignal 真正变化时清理:effect 挂载时也会跑一遍,清空会覆盖同一轮挂载中
  // 的还原逻辑(见 AGENTS.md 踩坑)。不能用布尔量,StrictMode 下挂载期 effect 会跑两次。
  const handledReset = useRef(resetSignal)

  useEffect(() => {
    if (handledReset.current === resetSignal) return
    handledReset.current = resetSignal
    // 新建:清空采集模块
    setRecordingResult(null)
    setDesignOpen(false)
    setDesignDescription('')
    setDesignText('')
    setDesignAudio('')
    setDesignPreviewText('')
    setDesignAiLoading(false)
  }, [resetSignal])

  useEffect(() => {
    async function loadData() {
      const list = await loadVoiceList()
      const categories = await loadVoiceCategories()
      setVoiceList({ ...list, categories })
    }
    loadData()
  }, [])

  // Make the generated sample reachable without hunting for it: the form sits
  // above the result inside the same scroll container.
  useEffect(() => {
    if (!designAudio) return
    designResultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [designAudio])

  const handleRecord = async () => {
    if (recording) {
      const result = await stopRecording()
      clearInterval(timerRef.current)
      setRecording(false)
      setRecordingResult(result)
      setTimer(0)
    } else {
      setRecordingResult(null)
      setDesignAudio('')
      setDesignPreviewText('')
      setDesignOpen(false)
      try {
        await startRecording()
      } catch (e) {
        showToast(e instanceof Error ? e.message : tr('errors.recordStartFailed'), 'error')
        return
      }
      setRecording(true)
      setTimer(0)
      timerRef.current = setInterval(() => setTimer(t => t + 1), 1000)
    }
  }

  const handleFileSelect = async (file: File) => {
    if (!file) return
    const validTypes = ['audio/wav', 'audio/mpeg', 'audio/mp3', 'audio/webm', 'audio/ogg', 'audio/flac']
    if (!validTypes.some(t => file.type.includes(t.split('/')[1]))) {
      showToast(tr('clone.unsupportedFormat'))
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      showToast(tr('errors.fileTooLarge', { max: 10 }))
      return
    }
    setRecordingResult(null)
    setDesignAudio('')
    setDesignPreviewText('')
    setDesignOpen(false)
    try {
      const result = await fileToRecordingResult(file)
      setRecordingResult(result)
    } catch {
      showToast(tr('clone.parseFailed'))
    }
  }

  const handleAiDesignText = async () => {
    const keyword = designDescription.trim()
    if (!keyword) return
    // Capture before any await: a non-empty audition field must survive the AI call.
    const hadSampleText = (designTextInputRef.current?.value ?? designText).trim().length > 0
    const settings = await loadAppSettings()
    if (!settings.api.apiKeyConfigured) {
      showToast(tr('errors.apiKeyMissing'))
      return
    }
    setDesignAiLoading(true)
    try {
      const data = await textGenerate<{ description?: string; sampleText?: string }>({
        system: VOICE_DESIGN_AI_PROMPT,
        user: `当前音色线索：${keyword}`,
        maxTokens: 700,
      })
      const description = data?.description?.trim() || ''
      if (!description) {
        showToast(tr('clone.aiEmpty'))
        return
      }
      setDesignDescription(description)
      setDesignAudio('')
      setDesignPreviewText('')
      const sampleText = data?.sampleText?.trim() || ''
      if (sampleText) {
        if (!hadSampleText) {
          setDesignText(sampleText)
          showToast(tr('clone.designGenerated'), 'success')
        } else {
          showToast(tr('clone.descUpdatedTextKept'), 'info')
        }
      } else {
        showToast(tr('clone.descUpdatedNoText'), 'info')
      }
    } catch (e) {
      showToast(getApiErrorMessage(e))
    } finally {
      setDesignAiLoading(false)
    }
  }

  const handleDesignGenerate = async () => {
    const description = designDescription.trim()
    if (!description) return
    const settings = await loadAppSettings()
    if (!settings.api.apiKeyConfigured) {
      showToast(tr('errors.apiKeyMissing'))
      return
    }
    setDesignGenerating(true)
    setRecordingResult(null)
    setDesignAudio('')
    setDesignPreviewText('')
    try {
      const result = await voiceDesignGenerate({
        description,
        text: designText.trim() || undefined,
        optimizePreview: !designText.trim(),
      })
      if (!result) {
        showToast(tr('clone.designFailed'))
        return
      }
      setDesignAudio(result.audioUrl)
      setDesignPreviewText(result.finalText || designText.trim() || tr('clone.autoPreviewText'))
    } catch (e) {
      showToast(getApiErrorMessage(e))
    } finally {
      setDesignGenerating(false)
    }
  }

  const handleOpenDesignedSaveModal = () => {
    if (!designAudio) return
    setPreviewText(designPreviewText || tr('clone.designSample'))
    setPreviewAudio(designAudio)
    // Designed voices start in their own category; the user can still pick another one.
    setProfileCategory(tr('clone.designLabel'))
    setShowModal(true)
  }

  const handleExport = async () => {
    if (voiceList.voices.length === 0) return
    const profiles: VoiceProfile[] = []
    for (const meta of voiceList.voices) {
      const full = await loadVoice(meta.id)
      if (full) profiles.push(full)
    }
    if (profiles.length === 0) return
    const json = exportVoiceProfiles(profiles)
    const date = new Date().toISOString().slice(0, 10)
    const ok = await downloadFile(json, `YiziVoice_${tr('clone.myLibrary')}_${date}.json`, 'application/json')
    if (ok) showToast(tr('clone.exported', { n: profiles.length }), 'success')
    else showToast(tr('clone.exportCanceled'))
  }

  const handleImport = async (file: File) => {
    try {
      const text = await file.text()
      const newProfiles = importVoiceProfiles(text)
      if (newProfiles.length === 0) {
        showToast(tr('clone.noVoiceData'))
        return
      }
      const existingList = await loadVoiceList()
      const existingIds = new Set(existingList.voices.map(v => v.id))
      const actualNew = newProfiles.filter(p => !existingIds.has(p.id))
      if (actualNew.length === 0) {
        showToast(tr('clone.alreadyExist'))
        return
      }
      for (const p of actualNew) {
        await saveVoice(p)
      }
      const newList = await loadVoiceList()
      setVoiceList({ ...newList, categories: voiceList.categories })
      showToast(tr('clone.imported', { n: actualNew.length }))
    } catch (e: any) {
      showToast(tr('clone.importFailed', { message: e.message || tr('errors.invalidVoiceFile') }))
    }
  }

  const handleOpenSaveModal = async () => {
    if (!recordingResult) return
    const settings = await loadAppSettings()
    if (!settings.api.apiKeyConfigured) {
      showToast(tr('errors.apiKeyMissing'))
      return
    }
    setCloning(true)
    try {
      const result = await voiceCloneGenerate({
        audioBase64: recordingResult.wavBase64,
        mimeType: 'audio/wav',
        text: tr('clone.previewText'),
      })
      if (result) {
        setPreviewText(tr('clone.previewText'))
        setPreviewAudio(result)
        setProfileCategory('')
        setShowModal(true)
      } else {
        showToast(tr('clone.cloneFailed'))
      }
    } catch (e) {
      showToast(getApiErrorMessage(e))
    } finally {
      setCloning(false)
    }
  }

  const handleSaveProfile = async () => {
    const sample = recordingResult
      ? { base64: recordingResult.wavBase64, mimeType: 'audio/wav' }
      : dataUrlToSample(designAudio)
    if (!sample || !profileName.trim()) return
    const profile: VoiceProfile = {
      id: Date.now().toString(),
      name: profileName.trim(),
      category: profileCategory || tr('common.uncategorized'),
      audioBase64: sample.base64,
      mimeType: sample.mimeType,
      previewAudioBase64: previewAudio,
      createdAt: Date.now(),
    }
    const result = await saveVoice(profile)
    setVoiceList({ ...result.list, categories: voiceList.categories })
    setProfileName('')
    setProfileCategory('')
    setRecordingResult(null)
    setPreviewAudio('')
    setPreviewText(tr('clone.previewText'))
    setDesignOpen(false)
    setDesignDescription('')
    setDesignText('')
    setDesignAudio('')
    setDesignPreviewText('')
    setDesignAiLoading(false)
    setAddingCategoryInModal(false)
    setModalNewCategory('')
    setShowModal(false)
    notifyHistoryUpdated()
  }

  const handleDeleteProfile = async () => {
    if (!deleteTargetId) return
    const newList = await deleteVoice(deleteTargetId)
    setVoiceList({ ...newList, categories: voiceList.categories })
    setDeleteTargetId(null)
  }

  const handleAddCategory = async () => {
    const name = newCategory.trim()
    if (!name) return
    if (voiceList.categories.includes(name)) {
      showToast(tr('clone.categoryExists'))
      return
    }
    const categories = await saveVoiceCategories([...voiceList.categories, name])
    setVoiceList((prev: any) => ({ ...prev, categories }))
    setNewCategory('')
  }

  // 弹窗内新增分类:保存后自动选为新角色分类
  const handleAddCategoryInModal = async () => {
    const name = modalNewCategory.trim()
    if (!name) return
    if ((voiceList.categories as string[]).includes(name)) {
      showToast(tr('clone.categoryExists'))
      return
    }
    const categories = await saveVoiceCategories([...voiceList.categories, name])
    setVoiceList((prev: any) => ({ ...prev, categories }))
    setProfileCategory(name)
    setModalNewCategory('')
    setAddingCategoryInModal(false)
  }

  const handleDeleteCategory = async () => {
    if (!deleteCategoryName) return
    const categories = await saveVoiceCategories(voiceList.categories.filter((c: string) => c !== deleteCategoryName))
    const list = await reassignVoiceCategory(deleteCategoryName, tr('common.uncategorized'))
    setVoiceList({ ...list, categories })
    setDeleteCategoryName(null)
  }

  const startRenameCategory = (name: string) => {
    setRenamingCategory(name)
    setRenameDraft(name)
  }

  const cancelRenameCategory = () => {
    setRenamingCategory(null)
    setRenameDraft('')
  }

  const submitRenameCategory = async () => {
    const from = renamingCategory
    if (!from) return
    const to = renameDraft.trim()
    if (!to) { cancelRenameCategory(); return }
    if (to === from) { cancelRenameCategory(); return }
    const { list, error } = await renameVoiceCategory(from, to)
    if (error) {
      showToast(error)
      return
    }
    setVoiceList((prev: any) => ({ ...prev, categories: list.categories, voices: list.voices }))
    cancelRenameCategory()
  }

  const handleMoveProfile = async (id: string, category: string) => {
    const list = await updateVoiceCategory(id, category)
    setVoiceList({ ...list, categories: voiceList.categories })
  }

  // Rename keeps everything else: sample, cached preview and category are read back
  // from disk and written unchanged, so this is the only field that moves.
  const handleOpenRename = async (id: string) => {
    const full = await loadVoice(id)
    if (!full) return
    setRenameValue(full.name)
    setRenameTargetId(id)
  }

  const handleRenameProfile = async () => {
    if (!renameTargetId) return
    const name = renameValue.trim()
    if (!name) return
    const full = await loadVoice(renameTargetId)
    if (!full) return
    const result = await saveVoice({ ...full, name })
    setVoiceList({ ...result.list, categories: voiceList.categories })
    setRenameTargetId(null)
    showToast(tr('clone.renamed'))
  }

  // 试听：与历史记录同一条逻辑 ——「正在播放」是一个真实状态：播放期间整排操作保持可见
  // （§5.9-4），播完 onEnded 清空即自动收起，再点一次同一个按钮＝停止。
  const stopProfilePreview = () => {
    profilePreviewRef.current?.pause()
    setPreviewingProfileId('')
    setPreviewLoadingId('')
  }

  const handleProfilePreview = async (profile: VoiceProfile) => {
    const el = profilePreviewRef.current
    if (!el) return
    if (previewingProfileId === profile.id) {
      stopProfilePreview()
      return
    }
    el.pause()
    // 已有缓存样本的直接播；没有的先合成一次再播（合成期间走 loading 态）
    if (profile.previewAudioBase64) {
      el.src = profile.previewAudioBase64
      setPreviewingProfileId(profile.id)
      void el.play().catch(() => setPreviewingProfileId(''))
      return
    }
    setPreviewLoadingId(profile.id)
    try {
      const settings = await loadAppSettings()
      if (!settings.api.apiKeyConfigured) {
        showToast(tr('errors.apiKeyMissing'))
        return
      }
      const result = await voiceCloneGenerate({
        audioBase64: profile.audioBase64,
        mimeType: profile.mimeType,
        text: tr('clone.previewText'),
      })
      if (result) {
        el.src = result
        setPreviewingProfileId(profile.id)
        void el.play().catch(() => setPreviewingProfileId(''))
        if (!profile.previewAudioBase64) {
          await saveVoice({ ...profile, previewAudioBase64: result })
        }
      }
    } catch {
      showToast(tr('clone.previewFailed'))
    } finally {
      setPreviewLoadingId('')
    }
  }

  const clonedGroups: Record<string, any[]> = {}
  voiceList.voices.forEach((p: any) => {
    const cat = p.category || tr('common.uncategorized')
    if (!clonedGroups[cat]) clonedGroups[cat] = []
    clonedGroups[cat].push(p)
  })

  // 分组渲染顺序跟随分类表,分类外的组(如历史遗留)追加在末尾
  const groupOrder: string[] = [
    ...(voiceList.categories as string[]),
    ...Object.keys(clonedGroups).filter(c => !(voiceList.categories as string[]).includes(c)),
  ]

  const moveCategories = voiceList.categories.includes(tr('common.uncategorized'))
    ? voiceList.categories
    : [...voiceList.categories, tr('common.uncategorized')]

  const fmtClock = (sec: number) =>
    `${Math.floor(sec / 60).toString().padStart(2, '0')}:${(sec % 60).toString().padStart(2, '0')}`

  const scrollToCategory = (cat: string) => {
    const el = libraryScrollRef.current?.querySelector(`[data-category="${CSS.escape(cat)}"]`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="h-full flex gap-2 min-h-0">
      {/* 中央操作区 */}
      <section className="mat-panel flex-1 min-w-0 flex flex-col">
        <div className="px-5 pt-4 pb-3 border-b border-line shrink-0 flex items-start justify-between">
          {/* v4: the tool icon is the "feature icon" role (30px). It must balance the
              two-line title+subtitle block beside it, so it is sized against the block
              height (~50px), not against the 20px title alone. */}
          <div className="flex items-center gap-3 min-w-0">
            <ScanFace size={30} className="text-accent shrink-0" />
            <div className="min-w-0">
              <h2 className="text-xl font-semibold text-ink tracking-[-0.01em]">{tr('clone.title')}</h2>
              <p className="text-sm text-ink-2 mt-0.5">{tr('clone.subtitle')}</p>
            </div>
          </div>
          {!rightOpen && (
            <PaneToggle side="right" open={rightOpen} onToggle={toggleRight} />
          )}
        </div>

        <div ref={libraryScrollRef} className="flex-1 overflow-y-auto p-5 space-y-5 min-h-0">
          {/* 采集模块 */}
          {/* v2.1: 原先「录音 / 上传文件」是一组分段控件 + 两个互斥分支 —— 选哪边要多点一次、
              两边的说明各写一份，而拖放区只在 upload 分支里才存在。现在两种方式并排放在同一个
              投递面上：拖文件进这块就是上传、点圆钮就是录音，各自付什么代价写在各自下面
              （12px caption）。分段控件省下的不是一次点击，是「我到底该选哪个」的犹豫时间。
              v2.1 新增第三个同级入口「设计音色」：它不接收音频，点开后在自己的表单里填文字描述，
              生成结果同样落成样本，之后仍走 voiceclone 复用。三个圆钮必须保持同尺寸/同底色/同图标色。 */}
          <div className="mat-card p-4 space-y-4">
            <span className="text-sm font-medium text-ink-2">{tr('clone.submitSample')}</span>

            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFileSelect(f) }}
              className={`rounded-md border border-dashed px-6 py-5 transition-all ${
                dragOver ? 'border-accent bg-accent-softer' : 'border-line-strong'
              }`}
            >
              <div className="flex flex-wrap items-start justify-center gap-6">
                {/* 录音 */}
                <div className="flex-1 min-w-0 max-w-40 flex flex-col items-center gap-2">
                  <Tooltip label={recording ? tr('clone.recordStop') : tr('clone.recordStart')}>
                    <button
                      type="button"
                      onClick={handleRecord}
                      disabled={designGenerating || designAiLoading}
                      aria-label={recording ? tr('clone.recordStop') : tr('clone.recordStart')}
                      className={`${ENTRY_DISC} ${recording ? ENTRY_DISC_RECORDING : ENTRY_DISC_IDLE}`}
                    >
                      {/* 录音中换「停止」字形：此时按下去的语义已经变成「停止录音」，
                          字形必须和它说同一件事（与音色卡片试听的停止键同一个字形，
                          DESIGN.md §5.9-2 一图标一功能）。 */}
                      {recording ? <Square size={24} /> : <Mic size={24} />}
                    </button>
                  </Tooltip>
                  <p className="text-sm font-medium text-ink tabular-nums">
                    {recording ? tr('clone.recording', { time: fmtClock(timer) }) : recordingResult ? tr('clone.recorded', { time: fmtClock(Math.round(recordingResult.duration)) }) : tr('clone.recordStart')}
                  </p>
                  {/* 波形位常驻 24px：录音时它出现，但下面那句说明不跟着跳 */}
                  <div className="h-6 flex items-center gap-1">
                    {recording && Array.from({ length: 20 }).map((_, i) => (
                      <div key={i} className="waveform-bar" style={{ animationDelay: `${i * 0.05}s` }} />
                    ))}
                  </div>
                  <p className="text-xs text-ink-3 text-center">{tr('clone.noiseHint')}</p>
                </div>

                {/* 上传文件 */}
                <div className="flex-1 min-w-0 max-w-40 flex flex-col items-center gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="audio/*"
                    className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); e.target.value = '' }}
                  />
                  <Tooltip label={tr('clone.uploadLabel')}>
                    <button
                      type="button"
                      aria-label={tr('clone.uploadLabel')}
                      disabled={recording || designGenerating || designAiLoading}
                      onClick={() => fileInputRef.current?.click()}
                      className={`${ENTRY_DISC} ${ENTRY_DISC_IDLE}`}
                    >
                      <Upload size={24} />
                    </button>
                  </Tooltip>
                  <p className="text-sm font-medium text-ink">{tr('clone.uploadTitle')}</p>
                  {/* 与左列等深，让两句说明落在同一基线 */}
                  <div className="h-6" />
                  <p className="text-xs text-ink-3 text-center">{tr('clone.uploadHint')}</p>
                </div>

                {/* 设计音色（voicedesign）：描述 → 生成样本，不用录音 */}
                <div className="flex-1 min-w-0 max-w-40 flex flex-col items-center gap-2">
                  <Tooltip label={tr('clone.designLabel')}>
                    <button
                      type="button"
                      aria-label={tr('clone.designLabel')}
                      aria-expanded={designOpen}
                      disabled={recording || designGenerating || designAiLoading}
                      onClick={() => setDesignOpen(v => !v)}
                      aria-controls="voice-design-form"
                      className={`${ENTRY_DISC} ${ENTRY_DISC_IDLE}`}
                    >
                      <Palette size={24} />
                    </button>
                  </Tooltip>
                  <p className="text-sm font-medium text-ink">
                    {designGenerating ? tr('clone.designing') : tr('clone.designBtn')}
                  </p>
                  <div className="h-6" />
                  <p className="text-xs text-ink-3 text-center">{tr('clone.designHint')}</p>
                </div>
              </div>

              <p className="text-xs text-ink-3 text-center mt-4">
                {tr('clone.dropHint', { max: 10 })}
              </p>
            </div>

            {designOpen && (
              <div id="voice-design-form" className="rounded-md border border-line p-3.5 space-y-3">
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <label htmlFor="voice-design-description" className="text-sm font-medium text-ink-2">
                      {tr('clone.designDescLabel')}
                    </label>
                    <button
                      type="button"
                      onClick={handleAiDesignText}
                      disabled={!designDescription.trim() || designAiLoading || designGenerating}
                      title={tr('clone.designAiTitle')}
                      className={`inline-flex items-center gap-1 h-[26px] px-2.5 rounded-sm text-sm font-medium border cursor-pointer transition-all whitespace-nowrap ${
                        designDescription.trim() && !designAiLoading && !designGenerating
                          ? 'border-accent text-accent hover:bg-accent-soft'
                          : 'border-line text-ink-3 opacity-60 cursor-not-allowed'
                      }`}
                    >
                      {designAiLoading ? (
                        <>
                          <Loader2 size={14} className="animate-spin" />
                          {tr('clone.generating')}
                        </>
                      ) : (
                        <>
                          <Wand2 size={14} />
                          {tr('clone.aiGenerate')}
                        </>
                      )}
                    </button>
                  </div>
                  <Textarea
                    id="voice-design-description"
                    rows={3}
                    disabled={designGenerating || designAiLoading}
                    placeholder={tr('clone.designDescPlaceholder')}
                    value={designDescription}
                    onChange={e => {
                      setDesignDescription(e.target.value)
                      setDesignAudio('')
                      setDesignPreviewText('')
                    }}
                  />
                </div>
                <div>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <label htmlFor="voice-design-text" className="text-sm font-medium text-ink-2">{tr('clone.designTextLabel')}</label>
                    <span className="text-xs text-ink-3">{tr('clone.designTextHint')}</span>
                  </div>
                  <Input
                    id="voice-design-text"
                    ref={designTextInputRef}
                    disabled={designGenerating || designAiLoading}
                    placeholder={tr('clone.designTextPlaceholder')}
                    value={designText}
                    onChange={e => {
                      setDesignText(e.target.value)
                      setDesignAudio('')
                      setDesignPreviewText('')
                    }}
                  />
                </div>
                <div className="flex items-end justify-between gap-3">
                  <p className="text-xs text-ink-3">{tr('clone.designTip')}</p>
                  <Button
                    variant="soft"
                    loading={designGenerating}
                    disabled={!designDescription.trim() || designAiLoading}
                    onClick={handleDesignGenerate}
                  >
                    {designAudio ? tr('clone.regeneratePreview') : tr('clone.generatePreview')}
                  </Button>
                </div>
              </div>
            )}

            {designAudio && (
              <div ref={designResultRef} className="space-y-3 pt-1">
                {designPreviewText && (
                  <p className="text-xs text-ink-3">
                    {tr('clone.previewLabel')}<span className="text-ink-2">{designPreviewText}</span>
                  </p>
                )}
                <AudioPlayer src={designAudio} downloadName="yizivoice_designed_sample.wav" />
                <div className="flex justify-end">
                  <Button variant="primary" onClick={handleOpenDesignedSaveModal}>
                    {tr('clone.confirmSaveRole')}
                  </Button>
                </div>
              </div>
            )}

            {recordingResult && (
              <div className="space-y-3 pt-1">
                <AudioPlayer src={`data:audio/wav;base64,${recordingResult.wavBase64}`} downloadName="yizivoice_sample.wav" />
                <div className="flex justify-end">
                  <Button variant="primary" loading={cloning} onClick={handleOpenSaveModal}>
                    {cloning ? tr('clone.cloning') : tr('clone.confirmSaveRole')}
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* 我的音色库 */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-semibold text-ink">{tr('clone.myLibrary')}</h3>
              <div className="flex items-center gap-2">
                <Button variant="secondary" size="sm" icon={<Download size={14} />} disabled={voiceList.voices.length === 0} onClick={handleExport}>
                  {tr('clone.exportAll')}
                </Button>
                <Button variant="secondary" size="sm" icon={<FolderOpen size={14} />} onClick={() => importFileRef.current?.click()}>
                  {tr('clone.import')}
                </Button>
                <input
                  ref={importFileRef}
                  type="file"
                  accept=".json"
                  className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleImport(f); e.target.value = '' }}
                />
              </div>
            </div>

            {voiceList.voices.length === 0 ? (
              <EmptyState icon={ScanFace} title={tr('clone.emptyTitle')} hint={tr('clone.emptyHint')} />
            ) : (
              <div className="space-y-4">
                {/* 按分类表顺序渲染,空分组占位,移动角色时分组结构保持稳定 */}
                {groupOrder.map(cat => {
                  const items = clonedGroups[cat] || []
                  return (
                  <div key={cat} data-category={cat} className="scroll-mt-5">
                    <p className="text-sm font-medium text-ink-2 mb-2 px-0.5">
                      {cat} <span className="opacity-60">({items.length})</span>
                    </p>
                    {items.length === 0 ? (
                      <p className="text-xs text-ink-3 px-0.5 py-1.5">{tr('clone.groupEmpty')}</p>
                    ) : (
                    <div className="grid gap-2.5 [grid-template-columns:repeat(auto-fill,minmax(240px,1fr))]">
                      {items.map(p => {
                        const isPreviewing = previewingProfileId === p.id
                        const isLoadingPreview = previewLoadingId === p.id
                        // v2.1: the four controls share the date's slot - a crossfade inside
                        // one fixed-height band - instead of sitting in a corner. With the name
                        // centred, a 102px cluster on a 240-270px card would land on top of it.
                        // 试听「正在进行」时整排保持可见（§5.9-4）：播放中是停止键 + 品牌色底，
                        // 生成中是转圈。两种状态都让日期退场；播完 previewingProfileId 清空，
                        // 整排就跟鼠标一起收起 —— 与历史记录条目同一条逻辑。
                        const previewBusy = isPreviewing || isLoadingPreview
                        // ⚠️ 用 `:focus-visible` 而不是 `:focus-within`：鼠标点过的按钮会长期持有
                        // 焦点，`focus-within` 于是把整排永久点亮 —— 试听播完也不收起（v2.1 实测：
                        // 指针已移出卡片、hover=0，整排 opacity 仍是 1）。键盘 Tab 过来时
                        // `:focus-visible` 成立，整排照样出现，可达性一点没少。
                        const actionsCls = previewBusy
                          ? 'opacity-100'
                          : 'opacity-0 group-hover:opacity-100 group-has-[:focus-visible]:opacity-100'
                        const dateCls = previewBusy
                          ? 'opacity-0'
                          : 'group-hover:opacity-0 group-has-[:focus-visible]:opacity-0'
                        return (
                        <div key={p.id} className="mat-card group relative h-20 p-0 min-w-0">
                          {/* Decoration: the sample's own envelope, centred behind the title, so a
                              row of cards reads as "each card carries its own voice" rather than
                              "each card carries the same mark in the same corner". The peaks come
                              from the list entry - Rust computed them when the voice was saved -
                              so nothing here decodes audio; voices saved before the waveform
                              existed get one from the backfill in `voices_load_list`.
                              Strength is `--wave-mark-opacity`, a per-theme token rather than a
                              Tailwind step: the ceiling is the 12px date's contrast, and the two
                              themes pay different prices for the same number (light 5%, dark 10%).
                              See DESIGN.md §5.13. */}
                          {Array.isArray(p.waveform) && p.waveform.length > 0 && (
                            <span aria-hidden className="voice-card-wave absolute inset-x-4 top-1/2 -translate-y-1/2 flex h-12 items-center justify-between pointer-events-none">
                              {p.waveform.map((v: number, i: number) => (
                                <span
                                  key={i}
                                  className="w-0.5 rounded-full bg-accent"
                                  style={{ height: `${Math.round(Math.max(0, Math.min(1, v)) * 100)}%` }}
                                />
                              ))}
                            </span>
                          )}
                          {/* The name is the card's core: centred in the whole card, and its line
                              sits 14px above the midline by construction. */}
                          <div className="relative h-full flex flex-col items-center justify-center px-4">
                            <p className="w-full text-center text-base font-semibold text-ink truncate">{p.name}</p>
                            <div className="w-full h-6 mt-1 grid place-items-center">
                              <p className={`col-start-1 row-start-1 text-xs text-ink-3 transition-opacity duration-100 ${dateCls}`}>
                                {new Date(p.createdAt).toLocaleDateString()}
                              </p>
                              <div className={`col-start-1 row-start-1 flex items-center gap-0.5 transition-opacity duration-100 ${actionsCls}`}>
                                <Tooltip label={isPreviewing ? tr('clone.previewStop') : tr('clone.previewPlay')}>
                                  <button
                                    type="button"
                                    aria-label={isPreviewing ? tr('clone.previewStop') : tr('clone.previewPlay')}
                                    disabled={isLoadingPreview}
                                    onClick={async () => {
                                      // 与文生音右栏同源:读取完整角色数据后再预览
                                      const full = await loadVoice(p.id)
                                      if (full) handleProfilePreview(full)
                                    }}
                                    className={`w-6 h-6 shrink-0 rounded-sm grid place-items-center cursor-pointer transition-colors disabled:cursor-default hover:bg-surface-active ${
                                      isPreviewing ? 'text-accent' : 'text-ink-3 hover:text-accent'
                                    }`}
                                  >
                                    {/* 播放态用「停止」（Square）而不是「暂停」：再点一下是停掉、不会
                                        续播，文案（aria-label / hover）也一直是「停止试听」。状态只由
                                        强调色 + 停止字形 + 整排保持可见表达，不再叠一个底色块。 */}
                                    {isLoadingPreview ? (
                                      <Loader2 size={12} className="animate-spin" />
                                    ) : isPreviewing ? (
                                      <Square size={12} />
                                    ) : (
                                      <Play size={12} />
                                    )}
                                  </button>
                                </Tooltip>
                                <Tooltip label={tr('clone.renameVoice')}>
                                  <button
                                    type="button"
                                    aria-label={tr('clone.renameVoice')}
                                    onClick={() => handleOpenRename(p.id)}
                                    className="w-6 h-6 shrink-0 rounded-sm grid place-items-center text-ink-3 hover:bg-surface-active hover:text-ink cursor-pointer transition-colors"
                                  >
                                    <Pencil size={12} />
                                  </button>
                                </Tooltip>
                                <DropdownMenu
                                  variant="ghost"
                                  align="end"
                                  tooltip={tr('clone.moveTo')}
                                  heading={tr('clone.moveHeading')}
                                  icon={FolderInput}
                                  menuWidth={168}
                                  items={moveCategories.map((c: string) => ({
                                    key: c,
                                    label: c === p.category ? `${c} ✓` : c,
                                  }))}
                                  onSelect={key => handleMoveProfile(p.id, key)}
                                />
                                <Tooltip label={tr('clone.deleteVoice')}>
                                  <button
                                    type="button"
                                    aria-label={tr('common.delete')}
                                    onClick={() => setDeleteTargetId(p.id)}
                                    className="w-6 h-6 shrink-0 rounded-sm grid place-items-center text-ink-3 hover:text-danger-text hover:bg-danger-soft cursor-pointer transition-colors"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                </Tooltip>
                              </div>
                            </div>
                          </div>
                        </div>
                        )
                      })}
                    </div>
                    )}
                  </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        <audio ref={profilePreviewRef} onEnded={() => setPreviewingProfileId('')} />
      </section>

      {/* 右侧分类管理 */}
      {rightOpen && (
        <aside className="mat-panel w-[300px] shrink-0 flex flex-col mat-clip">
          <div className="flex-1 min-h-0 overflow-y-auto p-4">
            <section>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-base font-semibold text-ink">{tr('clone.categoryMgmt')}</h3>
                <PaneToggle side="right" open={rightOpen} onToggle={toggleRight} />
              </div>
              <div className="flex gap-2 mb-3">
                <Input
                  className="flex-1 min-w-0"
                  placeholder={tr('clone.newCategoryPlaceholder')}
                  value={newCategory}
                  onChange={e => setNewCategory(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleAddCategory() }}
                />
                <Button variant="primary" size="md" className="shrink-0" icon={<Plus size={14} />} disabled={!newCategory.trim()} onClick={handleAddCategory}>
                  {tr('clone.add')}
                </Button>
              </div>
              <div className="space-y-1">
                {(voiceList.categories as string[]).map(cat => {
                  const count = (clonedGroups[cat] || []).length
                  const isRenaming = renamingCategory === cat
                  return (
                    <div
                      key={cat}
                      role="button"
                      tabIndex={isRenaming ? -1 : 0}
                      onClick={() => { if (renamingCategory === cat) return; scrollToCategory(cat) }}
                      onKeyDown={e => {
                        if (isRenaming) return
                        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); scrollToCategory(cat) }
                      }}
                      title={tr('clone.jumpToTitle')}
                      className="group flex items-center gap-2 px-2.5 py-2 rounded-sm hover:bg-surface-hover cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                    >
                      {isRenaming ? (
                        <>
                          <input
                            autoFocus
                            className="flex-1 min-w-0 h-7 px-2 rounded-sm border border-accent bg-surface-2 text-sm text-ink outline-none"
                            value={renameDraft}
                            onChange={e => setRenameDraft(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') submitRenameCategory()
                              if (e.key === 'Escape') cancelRenameCategory()
                            }}
                            onBlur={submitRenameCategory}
                          />
                          <button
                            type="button"
                            aria-label={tr('clone.renameConfirm')}
                            title={tr('common.confirm')}
                          onMouseDown={e => e.preventDefault()}
                          onClick={e => { e.stopPropagation(); submitRenameCategory() }}
                          className="w-6 h-6 rounded-full grid place-items-center bg-accent-strong text-accent-on hover:bg-accent-hover cursor-pointer"
                        >
                          <Check size={12} strokeWidth={3} />
                        </button>
                        <button
                          type="button"
                          aria-label={tr('common.cancel')}
                          title={tr('common.cancel')}
                          onMouseDown={e => e.preventDefault()}
                          onClick={e => { e.stopPropagation(); cancelRenameCategory() }}
                          className="w-6 h-6 rounded-full grid place-items-center text-ink-3 hover:text-danger-text cursor-pointer"
                        >
                          <X size={12} />
                        </button>
                      </>
                    ) : (
                      <>
                        <span className="flex-1 text-sm text-ink truncate">{cat}</span>
                        <span className="text-xs text-ink-3">{count}</span>
                        {cat !== tr('common.uncategorized') && (
                          <button
                            type="button"
                            aria-label={tr('clone.renameCategory', { name: cat })}
                            title={tr('clone.renameConfirm')}
                            onClick={e => { e.stopPropagation(); startRenameCategory(cat) }}
                            className="w-6 h-6 rounded-sm grid place-items-center text-ink-3 hover:text-accent hover:bg-accent-soft cursor-pointer transition-all opacity-0 group-hover:opacity-100"
                          >
                            <Pencil size={12} />
                          </button>
                        )}
                        {cat !== tr('common.uncategorized') && (
                          <button
                            type="button"
                            aria-label={tr('clone.deleteCategory', { name: cat })}
                            title={tr('clone.deleteCategoryHint')}
                            onClick={e => { e.stopPropagation(); setDeleteCategoryName(cat) }}
                            className="w-6 h-6 rounded-sm grid place-items-center text-ink-3 hover:text-danger-text hover:bg-danger-soft cursor-pointer transition-all opacity-0 group-hover:opacity-100"
                          >
                            <X size={12} />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                )
              })}
            </div>
            <p className="text-xs text-ink-3 mt-3 leading-relaxed">
              {tr('clone.categoryHelp', { uncat: tr('common.uncategorized') })}
            </p>
            </section>
          </div>
        </aside>
      )}

      {/* 保存弹窗 */}
      <Dialog
        open={showModal}
        onClose={() => setShowModal(false)}
        title={tr('clone.saveDialogTitle')}
        subtitle={tr('clone.saveDialogSubtitle')}
        width={480}
        footer={
          <>
            <Button variant="secondary" onClick={() => { setAddingCategoryInModal(false); setModalNewCategory(''); setShowModal(false) }}>{tr('common.cancel')}</Button>
            <Button variant="primary" disabled={!profileName.trim()} onClick={handleSaveProfile}>{tr('common.save')}</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="mat-card p-3.5 space-y-2">
            <p className="text-sm font-medium text-ink-2">{tr('clone.previewCard')}</p>
            {previewText && <p className="text-xs text-ink-3 break-words">“{previewText}”</p>}
            {previewAudio && <audio ref={previewAudioRef} src={previewAudio} controls autoPlay className="w-full h-9 mt-1" />}
          </div>
          <div>
            <label className="block text-sm font-medium text-ink-2 mb-1.5">{tr('clone.roleName')}</label>
            <Input placeholder={tr('clone.roleNamePlaceholder')} value={profileName} onChange={e => setProfileName(e.target.value)} autoFocus />
          </div>
          <div>
            <label className="block text-sm font-medium text-ink-2 mb-2">{tr('clone.category')}</label>
            <div className="flex flex-wrap gap-1.5">
              {(voiceList.categories as string[]).map(cat => (
                <Chip key={cat} selected={profileCategory === cat} onClick={() => setProfileCategory(cat)}>
                  {cat}
                </Chip>
              ))}
              {addingCategoryInModal ? (
                <span className="inline-flex items-center gap-1">
                  <input
                    autoFocus
                    className="h-7 px-2.5 rounded-full border border-line bg-surface-2 text-sm text-ink outline-none focus:border-accent w-[110px]"
                    placeholder={tr('clone.categoryName')}
                    value={modalNewCategory}
                    onChange={e => setModalNewCategory(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleAddCategoryInModal()
                      if (e.key === 'Escape') { setAddingCategoryInModal(false); setModalNewCategory('') }
                    }}
                  />
                  <Tooltip label={tr('clone.confirmAdd')}>
                    <button
                      type="button"
                      aria-label={tr('clone.confirmAdd')}
                      onClick={handleAddCategoryInModal}
                      className="w-6 h-6 rounded-full grid place-items-center bg-accent-strong text-accent-on hover:bg-accent-hover cursor-pointer"
                    >
                      <Check size={12} strokeWidth={3} />
                    </button>
                  </Tooltip>
                  <Tooltip label={tr('common.cancel')}>
                    <button
                      type="button"
                      aria-label={tr('common.cancel')}
                      onClick={() => { setAddingCategoryInModal(false); setModalNewCategory('') }}
                      className="w-6 h-6 rounded-full grid place-items-center text-ink-3 hover:text-danger-text cursor-pointer"
                    >
                      <X size={12} />
                    </button>
                  </Tooltip>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => setAddingCategoryInModal(true)}
                  className="h-7 px-3 rounded-full text-sm font-medium border border-dashed border-line-strong text-ink-3 hover:text-accent hover:border-accent cursor-pointer inline-flex items-center gap-1 transition-colors"
                >
                  <Plus size={14} />
                  {tr('clone.addCategory')}
                </button>
              )}
            </div>
          </div>
        </div>
      </Dialog>

      {/* 删除角色确认 */}
      <Dialog
        open={!!deleteTargetId}
        onClose={() => setDeleteTargetId(null)}
        title={tr('clone.deleteDialogTitle')}
        subtitle={tr('clone.deleteDialogSubtitle')}
        width={360}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteTargetId(null)}>{tr('common.cancel')}</Button>
            <Button variant="danger" onClick={handleDeleteProfile}>{tr('clone.deleteDialogTitle')}</Button>
          </>
        }
      />

      {/* 修改名称 */}
      <Dialog
        open={!!renameTargetId}
        onClose={() => setRenameTargetId(null)}
        title={tr('clone.renameDialogTitle')}
        subtitle={tr('clone.renameDialogSubtitle')}
        width={380}
        footer={
          <>
            <Button variant="secondary" onClick={() => setRenameTargetId(null)}>{tr('common.cancel')}</Button>
            <Button variant="primary" disabled={!renameValue.trim()} onClick={handleRenameProfile}>{tr('common.save')}</Button>
          </>
        }
      >
        <label className="block text-sm font-medium text-ink-2 mb-1.5">{tr('clone.roleName')}</label>
        <Input
          value={renameValue}
          onChange={e => setRenameValue(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleRenameProfile() }}
          autoFocus
        />
      </Dialog>

      {/* 删除分类确认 */}
      <Dialog
        open={!!deleteCategoryName}
        onClose={() => setDeleteCategoryName(null)}
        title={tr('clone.deleteCategoryTitle')}
        subtitle={tr('clone.deleteCategorySubtitle', { name: deleteCategoryName ?? '', uncat: tr('common.uncategorized') })}
        width={380}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteCategoryName(null)}>{tr('common.cancel')}</Button>
            <Button variant="danger" onClick={handleDeleteCategory}>{tr('clone.deleteCategoryTitle')}</Button>
          </>
        }
      />
    </div>
  )
}

