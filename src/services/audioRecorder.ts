import { t } from '../i18n/core'

export interface RecordingResult {
  blob: Blob
  base64: string
  mimeType: string
  wavBase64: string
  duration: number
}

let mediaRecorder: MediaRecorder | null = null
let audioChunks: Blob[] = []
let startTime = 0

// 把平台差异翻译成用户能照做的提示。
// 之前这里直接 await,失败时异常被调用方吞掉 —— Linux 上表现为「点录音毫无反应」,
// 既没有授权弹窗也没有报错,无法判断是没权限、没设备还是被占用。
function describeRecorderError(e: unknown): string {
  const name = (e as { name?: string } | null)?.name ?? ''
  switch (name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return t('errors.micPermissionDenied')
    case 'NotFoundError':
    case 'DevicesNotFoundError':
      return t('errors.micNotFound')
    case 'NotReadableError':
    case 'TrackStartError':
      return t('errors.micInUse')
    case 'OverconstrainedError':
      return t('errors.micUnsupportedParams')
    case 'NotSupportedError':
      return t('errors.mediaComponentsMissing')
    default:
      break
  }
  if (e instanceof TypeError) return t('errors.recordUnsupported')
  return e instanceof Error && e.message ? e.message : t('errors.recordStartFailed')
}

// MediaRecorder 支持的容器各平台不同(WebKitGTK 未必支持 webm/opus),
// 按优先级挑一个能用的;一个都不支持时交给浏览器用默认值。
function pickRecorderMime(): string | undefined {
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/ogg']
  return candidates.find(t => MediaRecorder.isTypeSupported(t))
}

export async function startRecording(): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error(t('errors.recordUnsupported'))
  }

  let stream: MediaStream
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        sampleRate: 24000,
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
      },
    })
  } catch (e) {
    throw new Error(describeRecorderError(e))
  }

  audioChunks = []
  startTime = Date.now()
  try {
    const mimeType = pickRecorderMime()
    mediaRecorder = mimeType
      ? new MediaRecorder(stream, { mimeType })
      : new MediaRecorder(stream)
  } catch (e) {
    // 拿到流却建不了录制器:把流关掉,否则麦克风会一直被占用
    stream.getTracks().forEach(t => t.stop())
    throw new Error(describeRecorderError(e))
  }
  mediaRecorder.ondataavailable = (e) => {
    if (e.data.size > 0) audioChunks.push(e.data)
  }
  mediaRecorder.start(100)
  return stream
}

export async function stopRecording(): Promise<RecordingResult> {
  return new Promise((resolve, reject) => {
    if (!mediaRecorder || mediaRecorder.state === 'inactive') {
      reject(new Error('No active recording'))
      return
    }
    mediaRecorder.onstop = async () => {
      const blob = new Blob(audioChunks, { type: mediaRecorder!.mimeType })
      const base64 = await blobToBase64(blob)
      const duration = (Date.now() - startTime) / 1000

      // 录制容器因平台而异(webm / ogg …)。除 wav 外都要转码后再交给 ASR,
      // 之前只认 'webm' 与 'wav' 两种,其它容器会被当成 wav 直接发出。
      const rawMime = mediaRecorder!.mimeType || blob.type || ''
      const mimeType = rawMime.includes('wav')
        ? 'audio/wav'
        : rawMime.split(';')[0] || 'audio/webm'

      let wavBase64 = base64
      if (mimeType !== 'audio/wav') {
        try {
          wavBase64 = await audioBlobToWavBase64(blob)
        } catch (e) {
          console.warn(`${mimeType} to WAV conversion failed, using original:`, e)
        }
      }

      resolve({ blob, base64, mimeType, wavBase64, duration })
    }
    mediaRecorder.stop()
    mediaRecorder.stream.getTracks().forEach(t => t.stop())
  })
}

export function getRecordingDuration(): number {
  return (Date.now() - startTime) / 1000
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      const base64 = (reader.result as string).split(',')[1]
      resolve(base64)
    }
    reader.readAsDataURL(blob)
  })
}

// 容器无关:decodeAudioData 交给平台的媒体后端解码(GStreamer / AVFoundation / Media Foundation)
async function audioBlobToWavBase64(blob: Blob): Promise<string> {
  const arrayBuffer = await blob.arrayBuffer()
  const audioCtx = new OfflineAudioContext(1, 1, 24000)
  const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer)
  return encodeAudioBufferToWavBase64(audioBuffer)
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
  view.setUint32(28, sampleRate * blockAlign, true)
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
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}
