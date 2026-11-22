import type { ReactNode } from 'react'
import {
  AudioLines, Check, Copy, Download, HelpCircle, History, Mic, Palette, Play,
  Trash2, Upload,
} from 'lucide-react'

// Presentational only: these are coarse "interface sketches", not a second product UI.
// Every frame is aria-hidden and pointer-events-none so it never steals focus or clicks.

function MockFrame({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div
      aria-hidden="true"
      className="select-none pointer-events-none rounded-md border border-line bg-surface-1 p-3"
    >
      <p className="text-xs text-ink-3 mb-2">界面示意 · {label}</p>
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
  return (
    <MockFrame label="设置 · 接口密钥">
      <div className="flex items-center justify-between">
        <MockLabel>MiMo API Key</MockLabel>
        <span className="text-xs text-ink-3">已配置</span>
      </div>
      <MockFocus className="mt-1.5">
        <MockField>
          <span className="flex-1 truncate">sk-••••••••••••</span>
          <span className="text-ink-3">验证</span>
          <MockButton tone="primary">保存</MockButton>
        </MockField>
      </MockFocus>
      <p className="text-xs text-ink-3 mt-2">保存后不再回显；替换时输入新 Key</p>
    </MockFrame>
  )
}

export function SettingsModelMock() {
  return (
    <MockFrame label="设置 · AI 文本模型">
      <div className="flex items-center gap-1">
        <MockLabel>AI 文本模型</MockLabel>
        <HelpCircle size={12} className="text-ink-3" />
      </div>
      <MockFocus className="mt-1.5">
        <div className="flex items-center gap-1.5">
          <MockField className="flex-1">
            <span className="truncate">mimo-v2.6-flash</span>
          </MockField>
          <MockButton>获取模型</MockButton>
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
  return (
    <MockFrame label="克隆音色 · 提交音色样本">
      <div className="flex items-start justify-center gap-3">
        <MockDisc icon={Mic} label="开始录音" />
        <MockDisc icon={Upload} label="上传文件" />
        <MockDisc icon={Palette} label="设计音色" />
      </div>
      <div className="mt-3 flex items-center justify-between gap-2">
        <MockLabel>音色描述</MockLabel>
        <MockFocus className="rounded-sm">
          <MockButton>AI 生成描述与试听文本</MockButton>
        </MockFocus>
      </div>
      <MockField className="mt-1.5">
        <span className="truncate">三十岁女性，声音温柔清晰…</span>
      </MockField>
      <div className="mt-2">
        <MockLabel>试听文本</MockLabel>
        <MockField className="mt-1.5">
          <span className="truncate">留空则自动生成</span>
        </MockField>
      </div>
    </MockFrame>
  )
}

export function TtsMock() {
  return (
    <MockFrame label="文生音">
      <div className="flex items-center gap-1">
        {['标签方式', '自由描述', '导演演绎'].map((label, i) => (
          <span
            key={label}
            className={`h-7 px-2 rounded-full inline-flex items-center text-xs font-medium ${
              i === 1 ? 'bg-surface-2 text-accent border border-accent' : 'text-ink-3 border border-line'
            }`}
          >
            {label}
          </span>
        ))}
      </div>
      <div className="mt-2 flex items-center gap-1.5 text-xs text-ink-3">
        <span className="w-1.5 h-1.5 rounded-full bg-accent" />
        当前音色：MiMo-默认
      </div>
      <MockField multiline className="mt-2">
        <span className="truncate">输入要朗读的文案…</span>
      </MockField>
      <div className="mt-2 flex justify-end">
        <MockButton tone="primary">生成语音</MockButton>
      </div>
    </MockFrame>
  )
}

export function AsrMock() {
  return (
    <MockFrame label="音转文">
      <div className="flex items-start justify-center gap-5">
        <MockDisc icon={Mic} label="开始录音" />
        <MockDisc icon={Upload} label="上传文件" />
      </div>
      <MockField multiline className="mt-3">
        <span className="truncate">识别结果会显示在这里…</span>
      </MockField>
      <div className="mt-2 flex items-center gap-1.5 text-xs text-ink-3">
        <Copy size={12} />
        可一键复制文本
      </div>
    </MockFrame>
  )
}

export function HistoryMock() {
  return (
    <MockFrame label="历史记录">
      <div className="rounded-sm bg-surface-hover px-2 py-2">
        <div className="flex items-center gap-1.5">
          <AudioLines size={12} className="text-accent" />
          <span className="text-xs font-medium text-ink">文生音 · 老独</span>
          <span className="ml-auto text-xs text-ink-3">01:22</span>
        </div>
        <p className="text-xs text-ink-2 mt-1 truncate">(愤怒)你以为你断了我的代言，就能让我跪着求你？</p>
        <div className="flex items-center justify-end gap-2 mt-1.5 text-ink-3">
          <Play size={12} />
          <Copy size={12} />
          <History size={12} />
          <Download size={12} />
          <Trash2 size={12} className="text-danger-text" />
        </div>
      </div>
      <p className="text-xs text-ink-3 mt-2">悬停时显示操作：播放 / 复制 / 还原 / 下载 / 删除</p>
    </MockFrame>
  )
}

export function StorageTreeMock() {
  return (
    <MockFrame label="数据目录">
      <pre className="text-xs leading-relaxed text-ink-2 whitespace-pre">{`文档 / YiziVoice
├─ History/
│  ├─ index.json
│  ├─ tts/
│  └─ asr/
└─ config/
   ├─ voices/
   ├─ styles/
   └─ audio-tags/`}</pre>
    </MockFrame>
  )
}
