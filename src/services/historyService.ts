import { getBridge } from './configService'
import type { HistoryEntry, TtsHistoryEntry, AsrHistoryEntry, HistoryIndex } from './historyTypes'

export type { HistoryEntry, TtsHistoryEntry, AsrHistoryEntry, HistoryIndex }

function generateId(): string {
  return crypto.randomUUID()
}

// ─── Public API ────────────────────────────────────────────────

export async function loadHistory(): Promise<HistoryEntry[]> {
  const api = getBridge()
  const index = await api.history.loadIndex()
  return index.entries
}

export async function saveTtsEntry(params: {
  text: string
  voice: string
  voiceName: string
  style: string
  styleName: string
  audioDataUrl: string
  duration?: number
  // 生成时的界面状态(可选,便于日后完整还原编辑器)
  ttsMode?: TtsHistoryEntry['ttsMode']
  nlMode?: TtsHistoryEntry['nlMode']
  nlParagraph?: string
  nlRole?: string
  nlScene?: string
  nlDirection?: string
  openPanel?: TtsHistoryEntry['openPanel']
}): Promise<HistoryEntry> {
  const id = generateId()
  const entry: TtsHistoryEntry = {
    id,
    type: 'tts',
    createdAt: new Date().toISOString(),
    preview: params.text.slice(0, 80),
    text: params.text,
    voice: params.voice,
    voiceName: params.voiceName,
    style: params.style,
    styleName: params.styleName,
    audioFileName: `tts/${id}.wav`,
    duration: params.duration,
    ttsMode: params.ttsMode,
    nlMode: params.nlMode,
    nlParagraph: params.nlParagraph,
    nlRole: params.nlRole,
    nlScene: params.nlScene,
    nlDirection: params.nlDirection,
    openPanel: params.openPanel,
  }

  const api = getBridge()
  const base64 = params.audioDataUrl.split(',')[1] || ''
  await api.history.saveEntry(entry, base64)
  return entry
}

export async function saveAsrEntry(params: {
  sourceType: 'record' | 'upload'
  language: string
  text: string
  duration?: number
  fileName?: string
  // 录音音频(可选)。上传来源没有本地音频,不传。
  audioBase64?: string
}): Promise<HistoryEntry> {
  const id = generateId()
  const entry: AsrHistoryEntry = {
    id,
    type: 'asr',
    createdAt: new Date().toISOString(),
    preview: params.text.slice(0, 80),
    sourceType: params.sourceType,
    language: params.language,
    text: params.text,
    duration: params.duration,
    fileName: params.fileName,
    audioFileName: params.audioBase64 ? `asr/${id}.wav` : undefined,
  }

  const api = getBridge()
  await api.history.saveEntry(entry, params.audioBase64)
  return entry
}

export async function deleteHistoryEntry(id: string): Promise<void> {
  const api = getBridge()
  await api.history.deleteEntry(id)
}

// 历史音频的播放源。
//
// Windows/macOS 走 asset protocol(convertFileSrc);禁止回退 file://(打包态不可用,且违反约定)。
//
// Linux 必须另走一条路:WebKitGTK 把媒体加载交给 GStreamer,不经过 WebKit 网络层,
// 所以自定义协议 asset:// 喂不进 <audio> —— 症状是「新生成的结果能播(它是 data URL),
// 历史记录点了没声音,还原任务后的底部播放器也一样」。这里改成由 Rust 读出字节。
//
// 历史回放用 data: URL,不再 createObjectURL。blob URL 在 React StrictMode 下会被
// AudioPlayer 挂载期 cleanup 提前 revoke(还原后点播放直接失败);data: 与新生成结果同路径,
// media-src 已放行,且无需释放生命周期。
export async function getHistoryAudioSrc(entry: { id: string }): Promise<string> {
  const api = getBridge()
  if (api.platform === 'linux') {
    const res = await api.history.readAudio(entry.id)
    if (!res?.success || !res.dataBase64) {
      throw new Error(res?.message || '音频读取失败')
    }
    return `data:audio/wav;base64,${res.dataBase64}`
  }
  const absPath = await api.history.getAudioPath(entry.id)
  const { tauriAssetSrc } = await import('./tauriShim')
  return tauriAssetSrc(absPath)
}

// 只释放 blob: URL;data:/asset: 不能碰。保留给仍可能产生 blob 的调用方。
export function releaseAudioSrc(src: string | null | undefined): void {
  if (src && src.startsWith('blob:')) URL.revokeObjectURL(src)
}

// 历史音频下载:只传记录 id,路径由 Rust 侧解析并做边界校验(前端不持有任意文件读取能力)
export async function downloadHistoryAudio(
  id: string,
  fileName: string,
): Promise<{ ok: boolean; error?: string }> {
  const api = getBridge()
  const res = await api.history.exportAudio(id, fileName)
  if (res?.success) return { ok: true }
  if (res?.canceled) return { ok: false } // 用户取消,不当作错误提示
  return { ok: false, error: res?.message || '下载失败' }
}

// tts / asr 共用的下载入口
export function downloadEntryAudio(entry: HistoryEntry): Promise<{ ok: boolean; error?: string }> {
  const name = entry.type === 'tts' ? buildTtsFileName(entry) : buildAsrFileName(entry)
  return downloadHistoryAudio(entry.id, name)
}

// 清理索引里已不存在的音频(dryRun=true 只统计不删,便于先让用户确认)
export async function pruneOrphanAudio(
  dryRun: boolean,
): Promise<{ ok: boolean; removed: number; error?: string }> {
  const api = getBridge()
  const res = await api.history.pruneOrphanAudio(dryRun)
  if (res?.success) return { ok: true, removed: res.removed ?? 0 }
  return { ok: false, removed: 0, error: res?.message || '清理失败' }
}

// 历史时间显示:当天只显示时分,跨天带日期(左栏列表与工作台结果共用同一格式)
export function fmtEntryTime(iso: string): string {
  const d = new Date(iso)
  const hm = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
  if (d.toDateString() === new Date().toDateString()) return `今天 ${hm}`
  return `${d.getMonth() + 1}/${d.getDate()} ${hm}`
}

function stampOf(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`
}

function buildTtsFileName(entry: TtsHistoryEntry): string {
  const voice = (entry.voiceName || 'voice').replace(/[\\/:*?"<>|]/g, '')
  return `YiziVoice_${voice}_${stampOf(entry.createdAt)}.wav`
}

function buildAsrFileName(entry: AsrHistoryEntry): string {
  return `YiziVoice_转写_${stampOf(entry.createdAt)}.wav`
}

export async function clearAllHistory(): Promise<void> {
  const api = getBridge()
  await api.history.clearAll()
}

export async function openHistoryFolder(): Promise<void> {
  const api = getBridge()
  await api.history.openFolder()
}

// 左侧历史列表监听此事件以自动刷新
export function notifyHistoryUpdated(): void {
  window.dispatchEvent(new CustomEvent('yizivoice:history-updated'))
}
