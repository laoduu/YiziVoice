import { detectRuntime } from './runtime'
import { t } from '../i18n/core'

export interface ApiSettings {
  apiKey: string
  baseUrl: string
  /** Rust returns whether the OS credential store holds a key; the value itself is never echoed. */
  apiKeyConfigured?: boolean
  /** Set only when the user explicitly removes the stored key. */
  clearApiKey?: boolean
}

export interface VoiceProfile {
  id: string
  name: string
  category: string
  audioBase64: string
  mimeType: string
  previewAudioBase64?: string
  description?: string
  createdAt: number
}

export interface AppSettings {
  api: ApiSettings
  defaultVoice: string
  defaultFormat: 'wav' | 'pcm16'
  /** Model ID used by every in-app text-generation call (AI style descriptions). */
  textModel?: string
  theme?: 'light' | 'dark'
  /** UI language; persisted like theme (see i18n/core.ts). */
  lang?: 'zh-CN' | 'en'
}

// ========== 迁移函数 ==========

export async function migrateLegacySettings(): Promise<void> {
  const api = (window as any).desktopAPI
  if (!api?.settings?.migrateCheck) return

  const needsMigration = await api.settings.migrateCheck()
  if (!needsMigration) return

  console.log('[YiziVoice] Starting migration from localStorage to Documents/YiziVoice/')

  const oldSettings = JSON.parse(localStorage.getItem('yizivoice_settings') || '{}')
  const oldConfig = JSON.parse(localStorage.getItem('yizivoice_config_fallback') || '{}')

  await api.settings.migrate({ settings: oldSettings, configFallback: oldConfig })

  // Clear all old localStorage keys
  localStorage.removeItem('yizivoice_settings')
  localStorage.removeItem('yizivoice_config_fallback')
  localStorage.removeItem('yizivoice_history_index')
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key?.startsWith('yizivoice_history_audio_')) {
      localStorage.removeItem(key)
      i--
    }
  }

  console.log('[YiziVoice] Migration completed')
}

// ========== 工具函数 ==========

export function exportVoiceProfiles(profiles: VoiceProfile[]): string {
  const data = profiles.map(p => ({
    name: p.name,
    category: p.category,
    audioBase64: p.audioBase64,
    mimeType: p.mimeType,
    description: p.description,
    previewAudioBase64: p.previewAudioBase64,
  }))
  return JSON.stringify({ version: 1, profiles: data }, null, 2)
}

export function importVoiceProfiles(jsonStr: string): VoiceProfile[] {
  const data = JSON.parse(jsonStr)
  if (!data.profiles || !Array.isArray(data.profiles)) {
    throw new Error(t('errors.invalidVoiceFile'))
  }
  return data.profiles.map((p: any) => ({
    id: `import_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name: p.name || t('services.unnamedVoice'),
    category: p.category || t('common.uncategorized'),
    audioBase64: p.audioBase64,
    mimeType: p.mimeType || 'audio/wav',
    description: p.description,
    previewAudioBase64: p.previewAudioBase64,
    createdAt: Date.now(),
  }))
}

// Tauri 下 WebView2 不响应 <a download>:走"另存为对话框 + Rust 写盘";
// 浏览器(纯前端调试)保持锚点下载。
export async function downloadFile(content: string, filename: string, mimeType: string): Promise<boolean> {
  if (detectRuntime() === 'tauri') {
    const api = (window as any).desktopAPI
    if (!api?.exportTextFile) return false
    const res = await api.exportTextFile(content, filename)
    return !!res?.success
  }
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
  return true
}

function dataUrlBase64(dataUrl: string): string | null {
  const marker = ';base64,'
  const at = dataUrl.indexOf(marker)
  if (!dataUrl.startsWith('data:') || at < 0) return null
  return dataUrl.slice(at + marker.length)
}

// 下载音频(入参为 data: URL)。Tauri 下直接取 base64 段交 Rust 写盘。
// 勿改回 fetch(url)→FileReader:多一次大音频内存拷贝,且曾因打包态 CSP 的 connect-src
// 未放行 data:/blob: 而静默失效(dev 态不套 CSP,所以只在装包后暴露)。
export async function downloadUrl(url: string, filename: string): Promise<boolean> {
  if (detectRuntime() !== 'tauri') {
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    return true
  }
  const api = (window as any).desktopAPI
  if (!api?.exportBinaryFile) return false
  const base64 = dataUrlBase64(url)
  if (!base64) {
    console.warn(`${t('services.downloadOnlyDataUrl')} ${url.slice(0, 48)}`)
    return false
  }
  const res = await api.exportBinaryFile(base64, filename)
  return !!res?.success
}
