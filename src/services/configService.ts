import type { AllConfig, VoiceList, VoiceProfile, StylesConfig, AudioTagsConfig } from './configTypes'
import type { AppSettings } from './storage'

// ========== 桌面桥安全访问 ==========

// 桥由 tauriShim 在 boot 阶段注入(见 main.tsx);缺失说明未走 Tauri 宿主
export function getBridge() {
  const api = (window as any).desktopAPI
  if (!api) throw new Error('desktop bridge not available')
  return api
}

// ========== 设置管理 ==========

export interface SettingsSaveResult {
  success: boolean
  keyConfigured: boolean
  message?: string
}

export async function loadAppSettings(): Promise<AppSettings> {
  return await getBridge().settings.load()
}

/** Only used to boot the API client. The settings form must use `apiKeyConfigured`. */
export async function loadApiKey(): Promise<string> {
  return await getBridge().settings.loadApiKey()
}

export async function saveAppSettings(settings: AppSettings): Promise<SettingsSaveResult> {
  return await getBridge().settings.save(settings)
}

// ========== 配置加载 ==========

export async function loadAllConfig(): Promise<AllConfig> {
  return await getBridge().config.loadAll()
}

// ========== 音色管理 ==========

export async function loadVoiceList(): Promise<VoiceList> {
  return await getBridge().voices.loadList()
}

export async function loadVoice(id: string): Promise<VoiceProfile | null> {
  return await getBridge().voices.loadVoice(id)
}

export async function saveVoice(voice: Omit<VoiceProfile, 'id' | 'createdAt'> & { id?: string; createdAt?: number }): Promise<{ voice: VoiceProfile; list: VoiceList }> {
  return await getBridge().voices.saveVoice(voice)
}

export async function deleteVoice(id: string): Promise<VoiceList> {
  return await getBridge().voices.deleteVoice(id)
}

export async function loadVoiceCategories(): Promise<string[]> {
  return await getBridge().voices.loadCategories()
}

export async function saveVoiceCategories(categories: string[]): Promise<string[]> {
  return await getBridge().voices.saveCategories(categories)
}

export async function updateVoiceCategory(id: string, category: string): Promise<VoiceList> {
  return await getBridge().voices.updateCategory(id, category)
}

export async function reassignVoiceCategory(fromCategory: string, toCategory: string): Promise<VoiceList> {
  return await getBridge().voices.reassignCategory(fromCategory, toCategory)
}

export interface RenameCategoryResult {
  list: VoiceList
  error: string | null
}

export async function renameVoiceCategory(fromCategory: string, toCategory: string): Promise<RenameCategoryResult> {
  return await getBridge().voices.renameCategory(fromCategory, toCategory)
}

// ========== 风格管理 ==========

export async function loadStyles(): Promise<StylesConfig> {
  return await getBridge().styles.load()
}

export async function saveStyles(styles: StylesConfig['styles']): Promise<StylesConfig> {
  return await getBridge().styles.save(styles)
}

// ========== 音频标签管理 ==========

export async function loadOpeningTags(): Promise<AudioTagsConfig> {
  return await getBridge().audioTags.loadOpening()
}

export async function loadInlineTags(): Promise<AudioTagsConfig> {
  return await getBridge().audioTags.loadInline()
}

export async function saveOpeningTags(categories: AudioTagsConfig['categories']): Promise<AudioTagsConfig> {
  return await getBridge().audioTags.saveOpening(categories)
}

export async function saveInlineTags(categories: AudioTagsConfig['categories']): Promise<AudioTagsConfig> {
  return await getBridge().audioTags.saveInline(categories)
}
