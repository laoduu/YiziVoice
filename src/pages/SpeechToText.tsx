import { useState, useRef, useEffect } from 'react'
import { Mic, Upload, FolderOpen, Copy, FileText, Square } from 'lucide-react'
import { asrTranscribe, getApiErrorMessage } from '../services/mimoApi'
import { startRecording, stopRecording, RecordingResult } from '../services/audioRecorder'
import { loadAppSettings } from '../services/configService'
import { saveAsrEntry, openHistoryFolder, notifyHistoryUpdated } from '../services/historyService'
import { useApp, PaneToggle } from '../App'
import { useI18n } from '../i18n/react'
import { useToast } from '../components/Toast'
import { Button } from '../components/ui/Button'
import { Segmented } from '../components/ui/Segmented'
import { AudioPlayer } from '../components/ui/AudioPlayer'
import { Tooltip } from '../components/ui/Tooltip'
import { ENTRY_DISC, ENTRY_DISC_IDLE, ENTRY_DISC_RECORDING } from '../components/ui/entryDisc'

async function fileToRecordingResult(file: File): Promise<RecordingResult> {
  const arrayBuffer = await file.arrayBuffer()
  const audioCtx = new OfflineAudioContext(1, 1, 24000)
  const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer)
  const wavBase64 = encodeAudioBufferToWavBase64(audioBuffer)
  return {
    blob: file,
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

function fmtClock(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

export default function SpeechToText() {
  const { resetSignal, rightOpen, toggleRight } = useApp()
  const [recording, setRecording] = useState(false)
  const [recordingResult, setRecordingResult] = useState<RecordingResult | null>(null)
  const [language, setLanguage] = useState<'auto' | 'zh' | 'en'>('auto')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState('')
  const [timer, setTimer] = useState(0)
  // 这段音频是从哪来的:历史记录据此决定 sourceType、以及要不要落盘音频
  // (上传来源不落盘 —— 原文件在用户手里)。它记的是**来源**,不是界面模式。
  const [source, setSource] = useState<'record' | 'upload'>('record')
  const [dragOver, setDragOver] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval>>()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { showToast } = useToast()
  const { t: tr } = useI18n()

  // 只在 resetSignal 真正变化时清理:effect 挂载时也会跑一遍,清空会覆盖同一轮挂载中
  // 的还原逻辑(见 AGENTS.md 踩坑)。不能用布尔量,StrictMode 下挂载期 effect 会跑两次。
  const handledReset = useRef(resetSignal)

  useEffect(() => {
    if (handledReset.current === resetSignal) return
    handledReset.current = resetSignal
    // 新建:清空结果与录音
    setResult('')
    setRecordingResult(null)
  }, [resetSignal])

  const handleRecord = async () => {
    if (recording) {
      const res = await stopRecording()
      clearInterval(timerRef.current)
      setRecording(false)
      setRecordingResult(res)
      setTimer(0)
    } else {
      setResult('')
      setRecordingResult(null)
      setSource('record')
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
      showToast(tr('asr.unsupportedFormat'))
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      showToast(tr('errors.fileTooLarge', { max: 10 }))
      return
    }
    setResult('')
    setRecordingResult(null)
    setSource('upload')
    try {
      const res = await fileToRecordingResult(file)
      setRecordingResult(res)
    } catch {
      showToast(tr('asr.audioDecodeFailed'))
    }
  }

  const handleTranscribe = async () => {
    if (!recordingResult) return
    // 与其他页面一致,从文件设置读取密钥(避免历史遗留的存储源错位)
    const settings = await loadAppSettings()
    if (!settings.api.apiKeyConfigured) {
      showToast(tr('asr.apiKeyRequired'))
      return
    }

    setLoading(true)
    try {
      const text = await asrTranscribe({
        audioBase64: recordingResult.wavBase64,
        mimeType: 'audio/wav',
        language,
      })
      setResult(text)
      try {
        await saveAsrEntry({
          sourceType: source,
          language,
          text,
          duration: recordingResult.duration,
          // 只有录音落盘:录音没有别的副本;上传来源的原文件在用户手里,
          // 且这里存的是转码后的 WAV,再存一份会让数据目录无谓膨胀。
          audioBase64: source === 'record' ? recordingResult.wavBase64 : undefined,
        })
        notifyHistoryUpdated()
      } catch (e) {
        console.error('[ASR] Failed to save history:', e)
      }
    } catch (e) {
      showToast(getApiErrorMessage(e))
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = async () => {
    await navigator.clipboard.writeText(result)
    showToast(tr('common.copied'), 'success')
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
            <Mic size={30} className="text-accent shrink-0" />
            <div className="min-w-0">
              <h2 className="text-xl font-semibold text-ink tracking-[-0.01em]">{tr('asr.title')}</h2>
              <p className="text-sm text-ink-2 mt-0.5">{tr('asr.subtitle')}</p>
            </div>
          </div>
          {!rightOpen && (
            <PaneToggle side="right" open={rightOpen} onToggle={toggleRight} />
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4 min-h-0">
          {/* 获取音频 */}
          {/* v2.1: 原先「录音 / 上传文件」是一组分段控件 + 两个互斥分支 —— 选哪边要多点一次，
              拖放区也只在 upload 分支里才存在。现在两种方式并排放在同一个投递面上：拖文件进这块
              就是上传、点圆钮就是录音，各自付什么代价写在各自下面（12px caption）。
              与音色克隆「提交音色样本」同一套做法、同一份取值（components/ui/entryDisc.ts）。 */}
          <div className="mat-card p-4 space-y-4">
            <span className="text-sm font-medium text-ink-2">{tr('asr.getAudio')}</span>

            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFileSelect(f) }}
              className={`rounded-md border border-dashed px-6 py-5 transition-all ${
                dragOver ? 'border-accent bg-accent-softer' : 'border-line-strong'
              }`}
            >
              <div className="flex items-start justify-center gap-16">
                {/* 录音 */}
                <div className="w-40 flex flex-col items-center gap-2">
                  <Tooltip label={recording ? tr('asr.stopRecording') : tr('asr.startRecording')}>
                    <button
                      type="button"
                      onClick={handleRecord}
                      aria-label={recording ? tr('asr.stopRecording') : tr('asr.startRecording')}
                      className={`${ENTRY_DISC} ${recording ? ENTRY_DISC_RECORDING : ENTRY_DISC_IDLE}`}
                    >
                      {/* 录音中换「停止」字形：此时按下去的语义已经变成「停止录音」，
                          字形必须和它说同一件事（一图标一功能，与音色克隆同一处做法）。 */}
                      {recording ? <Square size={24} /> : <Mic size={24} />}
                    </button>
                  </Tooltip>
                  <p className="text-sm font-medium text-ink tabular-nums">
                    {recording ? tr('asr.recordingWithTime', { time: fmtClock(timer) }) : recordingResult ? tr('asr.recordedWithTime', { time: fmtClock(Math.round(recordingResult.duration)) }) : tr('asr.startRecording')}
                  </p>
                  {/* 波形位常驻 24px：录音时它出现，但下面那句说明不跟着跳 */}
                  <div className="h-6 flex items-center gap-1">
                    {recording && Array.from({ length: 20 }).map((_, i) => (
                      <div key={i} className="waveform-bar" style={{ animationDelay: `${i * 0.05}s` }} />
                    ))}
                  </div>
                  <p className="text-xs text-ink-3 text-center">{tr('asr.micHint')}</p>
                </div>

                {/* 上传文件 */}
                <div className="w-40 flex flex-col items-center gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="audio/*"
                    className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); e.target.value = '' }}
                  />
                  <Tooltip label={tr('asr.uploadAudioFile')}>
                    <button
                      type="button"
                      aria-label={tr('asr.uploadAudioFile')}
                      disabled={recording}
                      onClick={() => fileInputRef.current?.click()}
                      className={`${ENTRY_DISC} ${ENTRY_DISC_IDLE}`}
                    >
                      <Upload size={24} />
                    </button>
                  </Tooltip>
                  <p className="text-sm font-medium text-ink">{tr('asr.uploadFile')}</p>
                  {/* 与左列等深，让两句说明落在同一基线 */}
                  <div className="h-6" />
                  <p className="text-xs text-ink-3 text-center">{tr('asr.uploadHint')}</p>
                </div>
              </div>

              <p className="text-xs text-ink-3 text-center mt-4">
                {tr('asr.dropHint', { max: 10 })}
              </p>
            </div>

            {recordingResult && (
              <div className="space-y-3 pt-1">
                <AudioPlayer src={`data:audio/wav;base64,${recordingResult.wavBase64}`} downloadName="yizivoice_record.wav" />
                <div className="flex justify-end">
                  <Button variant="primary" loading={loading} onClick={handleTranscribe}>
                    {loading ? tr('asr.transcribing') : tr('asr.transcribe')}
                  </Button>
                </div>
              </div>
            )}
          </div>

          {result && (
            <div className="mat-card mat-clip">
              <div className="px-4 py-2.5 border-b border-line flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-2">
                  <FileText size={14} />{tr('asr.resultTitle')}
                </span>
                <Button variant="ghost" size="sm" icon={<Copy size={14} />} onClick={handleCopy}>
                  {tr('common.copy')}
                </Button>
              </div>
              <div className="p-4">
                <p className="text-sm leading-relaxed whitespace-pre-wrap text-ink">{result}</p>
              </div>
              <div className="px-4 py-2.5 border-t border-line">
                <Button variant="ghost" size="sm" icon={<FolderOpen size={14} />} onClick={() => openHistoryFolder()}>
                  {tr('asr.openFolder')}
                </Button>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* 右侧配置 */}
      {rightOpen && (
        <aside className="mat-panel w-[300px] shrink-0 flex flex-col mat-clip">
          <div className="flex-1 min-h-0 overflow-y-auto p-4">
            <section>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-base font-semibold text-ink">{tr('asr.settingsTitle')}</h3>
                <PaneToggle side="right" open={rightOpen} onToggle={toggleRight} />
              </div>
              <label className="block text-sm font-medium text-ink-2 mb-2">{tr('asr.langLabel')}</label>
              <Segmented
                full
                value={language}
                onChange={setLanguage}
                options={[
                  { value: 'auto', label: tr('asr.langAuto') },
                  { value: 'zh', label: tr('asr.langZh') },
                  { value: 'en', label: tr('asr.langEn') },
                ]}
              />
              <p className="text-xs text-ink-3 mt-3 leading-relaxed">
                {tr('asr.settingsHint')}
              </p>
            </section>
          </div>
        </aside>
      )}
    </div>
  )
}
