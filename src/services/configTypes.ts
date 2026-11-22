// ========== 配置类型定义 ==========

export interface VoiceMeta {
  id: string
  name: string
  category: string
  description?: string
  filePath: string
  createdAt: number
  previewAvailable: boolean
  /**
   * 样本的峰值包络（0~1，34 根），音色卡片用它画水印波形。
   * v2.1 起由 Rust 在保存时算出、写进 list.json；旧角色由 `voices_load_list` 回填，
   * 读不出样本时为 null。消费端必须按「可能缺失」处理。
   */
  waveform?: number[] | null
}

export interface VoiceList {
  version: number
  lastUpdated: number
  voices: VoiceMeta[]
  categories: string[]
}

export interface VoiceProfile {
  id: string
  name: string
  category: string
  description?: string
  audioBase64: string
  mimeType: string
  previewAudioBase64?: string
  createdAt: number
}

export interface StyleItem {
  id: string
  label: string
  value: string
  builtin?: boolean
}

export interface StylesConfig {
  version: number
  lastUpdated: number
  styles: StyleItem[]
}

export interface AudioTagCategory {
  name: string
  tags: string[]
  builtin?: boolean
  customTags?: string[]
}

export interface AudioTagsConfig {
  version: number
  lastUpdated: number
  categories: AudioTagCategory[]
}

export interface AllConfig {
  voiceList: VoiceList
  styles: StylesConfig
  openingTags: AudioTagsConfig
  inlineTags: AudioTagsConfig
}
