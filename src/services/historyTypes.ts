export type HistoryType = 'tts' | 'asr'

export interface BaseHistoryEntry {
  id: string
  type: HistoryType
  createdAt: string
  preview: string
}

export interface TtsHistoryEntry extends BaseHistoryEntry {
  type: 'tts'
  text: string
  voice: string
  voiceName: string
  // 组装后真正发给 API 的 userPrompt。**语义不可变**:它决定音频内容,
  // 旧记录靠它才能对应上已生成的音频,不要拿它承载界面状态。
  style: string
  styleName: string
  audioFileName: string
  duration?: number
  // ── 以下为「生成时的界面状态」,用于点击历史记录后完整还原编辑器 ──
  // 全部可选:v2.0.4 及更早写入的记录没有这些字段,消费端必须 ?? 兜底。
  ttsMode?: 'tags' | 'natural'
  nlMode?: 'paragraph' | 'director'
  nlParagraph?: string
  nlRole?: string
  nlScene?: string
  nlDirection?: string
  openPanel?: 'style' | 'opening' | 'inline'
}

export interface AsrHistoryEntry extends BaseHistoryEntry {
  type: 'asr'
  sourceType: 'record' | 'upload'
  language: string
  text: string
  duration?: number
  fileName?: string
  // 录音音频(仅"录音"来源会落盘)。旧记录没有此字段,没有它就不显示播放/下载。
  audioFileName?: string
}

export type HistoryEntry = TtsHistoryEntry | AsrHistoryEntry

export interface HistoryIndex {
  version: 1
  entries: HistoryEntry[]
}
