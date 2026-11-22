import OpenAI from 'openai'
import { loadAppSettings } from './configService'
import { t, type MessageKey } from '../i18n/core'

// Message keys (not resolved strings) so language switches apply at call time.
const ERROR_MESSAGE_KEYS: Record<number, MessageKey> = {
  429: 'errors.rateLimited',
  421: 'errors.contentSensitive',
  503: 'errors.serverOverloaded',
}

export function getApiErrorMessage(error: unknown): string {
  if (error instanceof OpenAI.APIError) {
    const status = error.status
    if (status && ERROR_MESSAGE_KEYS[status]) {
      return t(ERROR_MESSAGE_KEYS[status])
    }
  }
  return (error as Error).message || t('errors.generateFailed')
}

// 只对接小米 MiMo 一家服务,接口地址固定不可配置;CSP connect-src 亦按此收紧为静态白名单。
// 若将来要支持其它服务商,必须同步放行其域名(见 scripts/csp-check.mjs)。
export const MIMO_BASE_URL = 'https://api.xiaomimimo.com/v1'

export const MODELS = {
  TTS: 'mimo-v2.5-tts',
  VOICE_DESIGN: 'mimo-v2.5-tts-voicedesign',
  VOICE_CLONE: 'mimo-v2.5-tts-voiceclone',
  ASR: 'mimo-v2.5-asr',
} as const

// Text generation is configurable in Settings. The old `mimo-v2.5` id was retired on
// 2026-10-21; this default is the current low-latency V2.6 text model.
export const DEFAULT_TEXT_MODEL = 'mimo-v2.6-flash'

export const PRESET_VOICES = [
  { id: 'mimo_default', name: 'MiMo-默认', lang: '中文', gender: '女' },
  { id: '冰糖', name: '冰糖', lang: '中文', gender: '女' },
  { id: '茉莉', name: '茉莉', lang: '中文', gender: '女' },
  { id: '苏打', name: '苏打', lang: '中文', gender: '男' },
  { id: '白桦', name: '白桦', lang: '中文', gender: '男' },
  { id: 'Mia', name: 'Mia', lang: '英文', gender: '女' },
  { id: 'Chloe', name: 'Chloe', lang: '英文', gender: '女' },
  { id: 'Milo', name: 'Milo', lang: '英文', gender: '男' },
  { id: 'Dean', name: 'Dean', lang: '英文', gender: '男' },
] as const

export interface MiMoConfig {
  apiKey: string
}

let client: OpenAI | null = null

export function initClient(config: MiMoConfig) {
  client = new OpenAI({
    apiKey: config.apiKey,
    baseURL: MIMO_BASE_URL,
    dangerouslyAllowBrowser: true,
  })
}

// Used after the key is removed from the credential store, so in-flight calls
// fail with "not configured" instead of sending the old key.
export function clearClient() {
  client = null
}

// Cheap authenticated probe. The OpenAI-compatible surface exposes GET /models,
// which costs no tokens: an invalid key gets 401, a valid one gets 200. We avoid
// chat/TTS here so "verify" never bills the account.
export async function verifyApiKey(apiKey: string): Promise<boolean> {
  try {
    const probe = new OpenAI({
      apiKey,
      baseURL: MIMO_BASE_URL,
      dangerouslyAllowBrowser: true,
    })
    await probe.models.list()
    return true
  } catch {
    return false
  }
}

export interface AiModelInfo {
  id: string
  ownedBy: string
}

// GET /v1/models is the documented way to discover what this key can call. TTS and
// ASR ids are filtered out: this list feeds the "AI 文本模型" setting only.
export async function listAiModels(apiKey: string): Promise<AiModelInfo[]> {
  const key = apiKey.trim()
  if (!key) throw new Error(t('errors.apiKeyMissing'))
  const probe = new OpenAI({
    apiKey: key,
    baseURL: MIMO_BASE_URL,
    dangerouslyAllowBrowser: true,
  })
  const res = await probe.models.list()
  return res.data
    .filter(m => !/tts|asr/i.test(m.id))
    .map(m => ({ id: m.id, ownedBy: (m as any).owned_by ?? '' }))
}

export function getClient(): OpenAI {
  if (!client) throw new Error('MiMo client not initialized. Please set API key in Settings.')
  return client
}

export async function ttsGenerate(params: {
  text: string
  voice?: string
  style?: string
  format?: 'wav' | 'pcm16'
  stream?: boolean
  onChunk?: (pcmData: Float32Array) => void
}): Promise<string | null> {
  const { text, voice = 'mimo_default', style, format = 'wav', stream = false, onChunk } = params
  const api = getClient()

  const messages: any[] = []
  if (style) {
    messages.push({ role: 'user', content: style })
  }
  messages.push({ role: 'assistant', content: text })

  console.log('[YiziVoice] ttsGenerate messages:', JSON.stringify(messages, null, 2))

  if (stream && format === 'pcm16') {
    const completion = await api.chat.completions.create({
      model: MODELS.TTS,
      messages,
      audio: { format: 'pcm16', voice },
      stream: true,
    })

    const chunks: Float32Array[] = []
    for await (const chunk of completion) {
      const delta = chunk.choices?.[0]?.delta as any
      const audio = delta?.audio
      if (audio?.data) {
        const pcmBytes = Uint8Array.from(atob(audio.data), c => c.charCodeAt(0))
        const npPcm = new Float32Array(pcmBytes.buffer).map(v => v / 32768.0)
        chunks.push(npPcm)
        onChunk?.(npPcm)
      }
    }
    const merged = new Float32Array(chunks.reduce((s, c) => s + c.length, 0))
    let offset = 0
    for (const c of chunks) {
      merged.set(c, offset)
      offset += c.length
    }
    return encodeWav(merged, 24000)
  }

  const completion = await api.chat.completions.create({
    model: MODELS.TTS,
    messages,
    audio: { format, voice },
  })
  const audioData = (completion.choices[0].message as any)?.audio?.data
  if (!audioData) return null
  return `data:audio/wav;base64,${audioData}`
}

export async function voiceCloneGenerate(params: {
  audioBase64: string
  mimeType: string
  text: string
  style?: string
  format?: 'wav' | 'pcm16'
}): Promise<string | null> {
  const { audioBase64, mimeType, text, style, format = 'wav' } = params
  const api = getClient()

  const messages: any[] = []
  if (style) {
    messages.push({ role: 'user', content: style })
  }
  messages.push({ role: 'assistant', content: text })

  console.log('[YiziVoice] voiceCloneGenerate messages:', JSON.stringify(messages, null, 2))

  const completion = await api.chat.completions.create({
    model: MODELS.VOICE_CLONE,
    messages,
    audio: {
      format,
      voice: `data:${mimeType};base64,${audioBase64}`,
    },
  })
  const audioData = (completion.choices[0].message as any)?.audio?.data
  if (!audioData) return null
  return `data:audio/wav;base64,${audioData}`
}

export interface VoiceDesignResult {
  audioUrl: string
  finalText: string | null
}

export async function voiceDesignGenerate(params: {
  description: string
  text?: string
  optimizePreview?: boolean
  format?: 'wav' | 'pcm16'
}): Promise<VoiceDesignResult | null> {
  const { description, text, optimizePreview = true, format = 'wav' } = params
  const api = getClient()

  const messages: any[] = [
    { role: 'user', content: description },
  ]
  if (text) {
    messages.push({ role: 'assistant', content: text })
  }

  const completion = await api.chat.completions.create({
    model: MODELS.VOICE_DESIGN,
    messages,
    audio: { format, optimize_text_preview: optimizePreview } as any,
  })
  const message = completion.choices[0].message as any
  const audioData = message?.audio?.data
  if (!audioData) return null
  return {
    audioUrl: `data:audio/wav;base64,${audioData}`,
    // Only present when optimize_text_preview is true.
    finalText: message?.final_text_preview ?? null,
  }
}

export async function asrTranscribe(params: {
  audioBase64: string
  mimeType: string
  language?: 'auto' | 'zh' | 'en'
}): Promise<string> {
  const { audioBase64, mimeType, language = 'auto' } = params
  const api = getClient()

  const completion = await api.chat.completions.create({
    model: MODELS.ASR,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'input_audio',
            input_audio: {
              data: `data:${mimeType};base64,${audioBase64}`,
            },
          },
        ],
      },
    ],
    extra_body: {
      asr_options: { language },
    },
  } as any)
  return completion.choices[0]?.message?.content || ''
}

// 文本生成(结构化输出 JSON 模式,关闭深度思考以降低延迟)
// V2.5/V2.6 text models default to thinking enabled; disable it explicitly
export async function textGenerate<T = unknown>(params: {
  system: string
  user: string
  maxTokens?: number
}): Promise<T> {
  const { system, user, maxTokens = 1024 } = params
  let model = DEFAULT_TEXT_MODEL
  try {
    const settings = await loadAppSettings()
    model = settings.textModel?.trim() || DEFAULT_TEXT_MODEL
  } catch { /* bridge unavailable: keep the current default */ }
  const api = getClient()
  const completion = await api.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    response_format: { type: 'json_object' },
    max_completion_tokens: maxTokens,
    // 关闭深度思考(非标准 OpenAI 参数,需通过 as any 透传)
    ...({ thinking: { type: 'disabled' } } as any),
  } as any)
  const content = completion.choices[0]?.message?.content
  if (!content) throw new Error(t('errors.modelNoContent'))
  try {
    return JSON.parse(content) as T
  } catch (e) {
    throw new Error(t('errors.modelParseFailed'))
  }
}

function encodeWav(samples: Float32Array, sampleRate: number): string {
  const buffer = new ArrayBuffer(44 + samples.length * 2)
  const view = new DataView(buffer)
  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i))
  }
  writeString(0, 'RIFF')
  view.setUint32(4, 36 + samples.length * 2, true)
  writeString(8, 'WAVE')
  writeString(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  writeString(36, 'data')
  view.setUint32(40, samples.length * 2, true)
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
  return `data:audio/wav;base64,${btoa(binary)}`
}
