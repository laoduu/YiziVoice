import type { ReactNode } from 'react'
import {
  AudioLines, Check, Copy, Download, HelpCircle, History, Mic, Palette, Play,
  Trash2, Upload,
} from 'lucide-react'
import { useI18n } from '../../i18n/react'

// Presentational only: these are coarse "interface sketches", not a second product UI.
// Every frame is aria-hidden and pointer-events-none so it never steals focus or clicks.

function MockFrame({ label, children }: { label: string; children: ReactNode }) {
  const { t: tr } = useI18n()
  return (
    <div
      aria-hidden="true"
      className="select-none pointer-events-none rounded-md border border-line bg-surface-1 p-3"
    >
      <p className="text-xs text-ink-3 mb-2">{tr('tutorial.mock.frame', { label })}</p>
      {children}
    </div>
  )
}

function MockLabel({ children }: { children: ReactNode }) {
  return <span className="text-sm font-medium text-ink-2">{children}</span>
}

function MockField({
  children, className = '', multiline = false,
}: { children: ReactNode; className?: string; multiline?: boolean }) {
  return (
    <div className={`${multiline ? 'h-12 items-start pt-1.5' : 'h-8 items-center'} rounded-sm border border-line bg-surface-2 px-2 flex gap-1.5 text-sm text-ink-3 ${className}`}>
      {children}
    </div>
  )
}

function MockButton({ children, tone = 'secondary' }: { children: ReactNode; tone?: 'primary' | 'secondary' }) {
  return (
    <span
      className={`h-6 px-2 rounded-sm inline-flex items-center text-sm font-medium shrink-0 ${
        tone === 'primary'
          ? 'bg-accent-strong text-accent-on'
          : 'border border-line bg-surface-2 text-ink-2'
      }`}
    >
      {children}
    </span>
  )
}

function MockFocus({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-sm ring-1 ring-accent ${className}`}>{children}</div>
}

function MockDisc({ icon: Icon, label }: { icon: typeof Mic; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <span className="w-12 h-12 rounded-full grid place-items-center bg-accent-soft text-accent">
        <Icon size={24} />
      </span>
      <span className="text-xs text-ink-2">{label}</span>
    </div>
  )
}

export function SettingsKeyMock() {
  const { t: tr } = useI18n()
  return (
    <MockFrame label={tr('tutorial.mock.settingsKey')}>
      <div className="flex items-center justify-between">
        <MockLabel>MiMo API Key</MockLabel>
        <span className="text-xs text-ink-3">{tr('settings.keyConfigured')}</span>
      </div>
      <MockFocus className="mt-1.5">
        <MockField>
          <span className="flex-1 truncate">sk-••••••••••••</span>
          <span className="text-ink-3">{tr('settings.verify')}</span>
          <MockButton tone="primary">{tr('common.save')}</MockButton>
        </MockField>
      </MockFocus>
      <p className="text-xs text-ink-3 mt-2">{tr('tutorial.mock.keyHint')}</p>
    </MockFrame>
  )
}

export function SettingsModelMock() {
  const { t: tr } = useI18n()
  return (
    <MockFrame label={tr('tutorial.mock.settingsModel')}>
      <div className="flex items-center gap-1">
        <MockLabel>{tr('settings.textModel')}</MockLabel>
        <HelpCircle size={12} className="text-ink-3" />
      </div>
      <MockFocus className="mt-1.5">
        <div className="flex items-center gap-1.5">
          <MockField className="flex-1">
            <span className="truncate">mimo-v2.6-flash</span>
          </MockField>
          <MockButton>{tr('settings.fetchModels')}</MockButton>
        </div>
      </MockFocus>
      <div className="mt-2 rounded-sm border border-line bg-surface-2 py-1">
        {['mimo-v2.6-flash', 'mimo-v2.6-pro', 'mimo-v2.6-pro-ultraspeed'].map((id, i) => (
          <div key={id} className="px-2 flex items-center gap-1.5 text-xs text-ink-2">
            <span className="flex-1 truncate">{id}</span>
            {i === 0 && <Check size={12} className="text-accent" />}
          </div>
        ))}
      </div>
    </MockFrame>
  )
}

export function VoiceSampleMock() {
  const { t: tr } = useI18n()
  return (
    <MockFrame label={tr('tutorial.mock.voiceSample')}>
      <div className="flex items-start justify-center gap-3">
        <MockDisc icon={Mic} label={tr('tutorial.mock.startRecording')} />
        <MockDisc icon={Upload} label={tr('tutorial.mock.uploadFile')} />
        <MockDisc icon={Palette} label={tr('tutorial.mock.designVoice')} />
      </div>
      <div className="mt-3 flex items-center justify-between gap-2">
        <MockLabel>{tr('tutorial.mock.voiceDesc')}</MockLabel>
        <MockFocus className="rounded-sm">
          <MockButton>{tr('tutorial.mock.aiGenBoth')}</MockButton>
        </MockFocus>
      </div>
      <MockField className="mt-1.5">
        <span className="truncate">{tr('tutorial.mock.voiceDescSample')}</span>
      </MockField>
      <div className="mt-2">
        <MockLabel>{tr('tutorial.mock.previewText')}</MockLabel>
        <MockField className="mt-1.5">
          <span className="truncate">{tr('tutorial.mock.previewPlaceholder')}</span>
        </MockField>
      </div>
    </MockFrame>
  )
}

export function TtsMock() {
  const { t: tr } = useI18n()
  return (
    <MockFrame label={tr('nav.tts')}>
      <div className="flex items-center gap-1">
        {(['tutorial.mock.modeTags', 'tutorial.mock.modeFree', 'tutorial.mock.modeDirector'] as const).map((key, i) => (
          <span
            key={key}
            className={`h-7 px-2 rounded-full inline-flex items-center text-xs font-medium ${
              i === 1 ? 'bg-surface-2 text-accent border border-accent' : 'text-ink-3 border border-line'
            }`}
          >
            {tr(key)}
          </span>
        ))}
      </div>
      <div className="mt-2 flex items-center gap-1.5 text-xs text-ink-3">
        <span className="w-1.5 h-1.5 rounded-full bg-accent" />
        {tr('tutorial.mock.currentVoice')}
      </div>
      <MockField multiline className="mt-2">
        <span className="truncate">{tr('tutorial.mock.textPlaceholder')}</span>
      </MockField>
      <div className="mt-2 flex justify-end">
        <MockButton tone="primary">{tr('tutorial.mock.generate')}</MockButton>
      </div>
    </MockFrame>
  )
}

export function AsrMock() {
  const { t: tr } = useI18n()
  return (
    <MockFrame label={tr('nav.asr')}>
      <div className="flex items-start justify-center gap-5">
        <MockDisc icon={Mic} label={tr('tutorial.mock.startRecording')} />
        <MockDisc icon={Upload} label={tr('tutorial.mock.uploadFile')} />
      </div>
      <MockField multiline className="mt-3">
        <span className="truncate">{tr('tutorial.mock.asrPlaceholder')}</span>
      </MockField>
      <div className="mt-2 flex items-center gap-1.5 text-xs text-ink-3">
        <Copy size={12} />
        {tr('tutorial.mock.copyHint')}
      </div>
    </MockFrame>
  )
}

export function HistoryMock() {
  const { t: tr } = useI18n()
  return (
    <MockFrame label={tr('nav.history')}>
      <div className="rounded-sm bg-surface-hover px-2 py-2">
        <div className="flex items-center gap-1.5">
          <AudioLines size={12} className="text-accent" />
          <span className="text-xs font-medium text-ink">{tr('tutorial.mock.historyItem')}</span>
          <span className="ml-auto text-xs text-ink-3">01:22</span>
        </div>
        <p className="text-xs text-ink-2 mt-1 truncate">{tr('tutorial.mock.historyText')}</p>
        <div className="flex items-center justify-end gap-2 mt-1.5 text-ink-3">
          <Play size={12} />
          <Copy size={12} />
          <History size={12} />
          <Download size={12} />
          <Trash2 size={12} className="text-danger-text" />
        </div>
      </div>
      <p className="text-xs text-ink-3 mt-2">{tr('tutorial.mock.historyOpsHint')}</p>
    </MockFrame>
  )
}

export function StorageTreeMock() {
  const { t: tr } = useI18n()
  return (
    <MockFrame label={tr('tutorial.mock.storageTree')}>
      <pre className="text-xs leading-relaxed text-ink-2 whitespace-pre">{tr('tutorial.mock.storageTreeText')}</pre>
    </MockFrame>
  )
}
