import { Fragment, useState, type ComponentType, type ReactNode } from 'react'
import {
  ArrowRight, AudioLines, ChevronDown, Cpu, History, KeyRound, Mic, ScanFace,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useApp } from '../../App'
import { useI18n } from '../../i18n/react'
import type { MessageKey } from '../../i18n/core'
import {
  AsrMock, HistoryMock, SettingsKeyMock, SettingsModelMock, StorageTreeMock, TtsMock, VoiceSampleMock,
} from './tutorialMocks'

function openExternalLink(url: string) {
  if ((window as any).desktopAPI?.openExternalLink) {
    (window as any).desktopAPI.openExternalLink(url)
  } else {
    window.open(url, '_blank', 'noopener')
  }
}

// 邀请码高亮(全应用统一橙色等宽)
function InviteCode() {
  return <code className="font-mono font-semibold text-accent-2-text">DHLC96</code>
}

// 注册链接:桌面端走系统浏览器新窗口
function SignupLink({ children }: { children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={() => openExternalLink('https://platform.xiaomimimo.com?ref=DHLC96')}
      className="text-accent font-medium underline hover:brightness-110 cursor-pointer"
    >
      {children}
    </button>
  )
}

// t() only emits plain strings, so a sentence carrying inline JSX splits on
// named markers ('{link}', '{code}') and the segments interleave with the
// given nodes — keeps word order translatable per language.
function inlineSegments(template: string, nodes: Record<string, ReactNode>): ReactNode[] {
  const re = /\{(\w+)\}/g
  const out: ReactNode[] = []
  let last = 0
  let i = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(template))) {
    if (m.index > last) out.push(template.slice(last, m.index))
    out.push(<Fragment key={i++}>{nodes[m[1]] ?? m[0]}</Fragment>)
    last = m.index + m[0].length
  }
  if (last < template.length) out.push(template.slice(last))
  return out
}

type Target = 'settings' | 'clone' | 'tts' | 'asr' | 'history'

// Static step definitions hold message keys and icons only; translated copy is
// resolved at render so the panel re-renders on language change.
interface StepDef {
  id: string
  titleKey: MessageKey
  icon: LucideIcon
  goalKey: MessageKey
  bulletKeys: MessageKey[]
  moreKeys?: MessageKey[]
  Mock: ComponentType
  action?: { labelKey: MessageKey; target: Target }
  anchor?: string
}

const FLOW: { labelKey: MessageKey; captionKey: MessageKey; icon: LucideIcon; target: Target }[] = [
  { labelKey: 'tutorial.flow.keys.label', captionKey: 'tutorial.flow.keys.caption', icon: KeyRound, target: 'settings' },
  { labelKey: 'tutorial.flow.voice.label', captionKey: 'tutorial.flow.voice.caption', icon: ScanFace, target: 'clone' },
  { labelKey: 'nav.tts', captionKey: 'tutorial.flow.tts.caption', icon: AudioLines, target: 'tts' },
  { labelKey: 'nav.asr', captionKey: 'tutorial.flow.asr.caption', icon: Mic, target: 'asr' },
  { labelKey: 'tutorial.flow.history.label', captionKey: 'tutorial.flow.history.caption', icon: History, target: 'history' },
]

const STEPS: StepDef[] = [
  {
    id: 'api-key',
    titleKey: 'tutorial.step1.title',
    icon: KeyRound,
    goalKey: 'tutorial.step1.goal',
    bulletKeys: ['tutorial.step1.b1', 'tutorial.step1.b2', 'tutorial.step1.b3'],
    moreKeys: ['tutorial.step1.m1', 'tutorial.step1.m2', 'tutorial.step1.m3'],
    Mock: SettingsKeyMock,
    action: { labelKey: 'tutorial.goSettings', target: 'settings' },
  },
  {
    id: 'text-model',
    titleKey: 'tutorial.step2.title',
    icon: Cpu,
    goalKey: 'tutorial.step2.goal',
    bulletKeys: ['tutorial.step2.b1', 'tutorial.step2.b2', 'tutorial.step2.b3'],
    moreKeys: ['tutorial.step2.m1', 'tutorial.step2.m2', 'tutorial.step2.m3'],
    Mock: SettingsModelMock,
    action: { labelKey: 'tutorial.goSettings', target: 'settings' },
  },
  {
    id: 'voice',
    titleKey: 'tutorial.step3.title',
    icon: ScanFace,
    goalKey: 'tutorial.step3.goal',
    bulletKeys: ['tutorial.step3.b1', 'tutorial.step3.b2', 'tutorial.step3.b3'],
    moreKeys: ['tutorial.step3.m1', 'tutorial.step3.m2', 'tutorial.step3.m3'],
    Mock: VoiceSampleMock,
    action: { labelKey: 'tutorial.goClone', target: 'clone' },
  },
  {
    id: 'tts',
    titleKey: 'nav.tts',
    icon: AudioLines,
    goalKey: 'tutorial.step4.goal',
    bulletKeys: ['tutorial.step4.b1', 'tutorial.step4.b2', 'tutorial.step4.b3'],
    moreKeys: ['tutorial.step4.m1', 'tutorial.step4.m2', 'tutorial.step4.m3'],
    Mock: TtsMock,
    action: { labelKey: 'tutorial.goTts', target: 'tts' },
  },
  {
    id: 'asr',
    titleKey: 'nav.asr',
    icon: Mic,
    goalKey: 'tutorial.step5.goal',
    bulletKeys: ['tutorial.step5.b1', 'tutorial.step5.b2', 'tutorial.step5.b3'],
    moreKeys: ['tutorial.step5.m1', 'tutorial.step5.m2'],
    Mock: AsrMock,
    action: { labelKey: 'tutorial.goAsr', target: 'asr' },
  },
  {
    id: 'history',
    titleKey: 'nav.history',
    icon: History,
    goalKey: 'tutorial.step6.goal',
    bulletKeys: ['tutorial.step6.b1', 'tutorial.step6.b2', 'tutorial.step6.b3'],
    moreKeys: ['tutorial.step6.m1', 'tutorial.step6.m2', 'tutorial.step6.m3'],
    Mock: HistoryMock,
    anchor: 'tutorial-history',
  },
]

export function TutorialPanel({ onOpenSettings }: { onOpenSettings: () => void }) {
  const { t: tr } = useI18n()
  const { setTool } = useApp()
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  const go = (target: Target) => {
    if (target === 'settings') {
      onOpenSettings()
      return
    }
    if (target === 'history') {
      document.getElementById('tutorial-history')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      return
    }
    setTool(target)
  }

  const toggle = (id: string) => setExpanded(prev => ({ ...prev, [id]: !prev[id] }))

  // Bullets are plain message keys except the one sentence that embeds the
  // signup link and invite code.
  const renderBullet = (key: MessageKey): ReactNode => {
    if (key === 'tutorial.step1.b2') {
      return inlineSegments(tr(key), {
        link: <SignupLink>{tr('tutorial.step1.b2Link')}</SignupLink>,
        code: <InviteCode />,
      })
    }
    return tr(key)
  }

  return (
    <div className="space-y-5 pr-1">
      {/* 顶部流程图:先讲清"这套工具由哪几块组成",再进入细节 */}
      <section className="mat-card p-4">
        <div className="flex items-end justify-between gap-3 mb-3">
          <h3 className="text-base font-semibold text-ink">{tr('tutorial.overviewTitle')}</h3>
          <p className="text-xs text-ink-3">{tr('tutorial.overviewHint')}</p>
        </div>
        <div className="flex flex-wrap items-stretch gap-2">
          {FLOW.map((node, i) => (
            <Fragment key={node.labelKey}>
              <button
                type="button"
                onClick={() => go(node.target)}
                className="flex-1 min-w-32 rounded-sm border border-line bg-surface-1 p-3 text-left cursor-pointer transition-colors duration-100 hover:bg-surface-hover"
              >
                <node.icon size={24} className="text-accent" />
                <span className="block text-sm font-medium text-ink mt-1.5">{tr(node.labelKey)}</span>
                <span className="block text-xs text-ink-3 mt-0.5">{tr(node.captionKey)}</span>
              </button>
              {i < FLOW.length - 1 && (
                <span className="hidden lg:grid place-items-center text-ink-3 shrink-0">
                  <ArrowRight size={14} />
                </span>
              )}
            </Fragment>
          ))}
        </div>
      </section>

      {STEPS.map((step, index) => {
        const isOpen = !!expanded[step.id]
        return (
          <section key={step.id} id={step.anchor} className="mat-card p-4">
            <div className="flex flex-col lg:flex-row gap-4">
              <div className="w-full lg:w-72 shrink-0"><step.Mock /></div>

              <div className="flex-1 min-w-0">
                <div className="flex items-start gap-3">
                  <span className="w-10 h-10 rounded-full bg-accent-soft text-accent grid place-items-center shrink-0">
                    <step.icon size={24} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-ink-3">
                      STEP {String(index + 1).padStart(2, '0')}
                    </p>
                    <h4 className="text-base font-semibold text-ink">{tr(step.titleKey)}</h4>
                    <p className="text-xs text-ink-3 mt-0.5">{tr(step.goalKey)}</p>
                  </div>
                </div>

                <ul className="mt-3 list-disc list-inside space-y-1.5 ml-1 text-sm text-ink-2">
                  {step.bulletKeys.map(k => <li key={k}>{renderBullet(k)}</li>)}
                </ul>

                {step.moreKeys && (
                  <>
                    <button
                      type="button"
                      onClick={() => toggle(step.id)}
                      aria-expanded={isOpen}
                      className="mt-2.5 inline-flex items-center gap-1 text-sm font-medium text-ink-3 hover:text-ink cursor-pointer"
                    >
                      {isOpen ? tr('tutorial.collapse') : tr('tutorial.expandMore')}
                      <ChevronDown size={14} className={`transition-transform duration-100 ${isOpen ? 'rotate-180' : ''}`} />
                    </button>
                    {isOpen && (
                      <ul className="mt-2 list-disc list-inside space-y-1.5 ml-1 text-sm text-ink-2">
                        {step.moreKeys.map(k => <li key={k}>{tr(k)}</li>)}
                      </ul>
                    )}
                  </>
                )}

                {step.action && (
                  <button
                    type="button"
                    onClick={() => go(step.action!.target)}
                    className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline cursor-pointer"
                  >
                    {tr(step.action.labelKey)}
                    <ArrowRight size={14} />
                  </button>
                )}
              </div>
            </div>
          </section>
        )
      })}

      <section className="mat-card p-4">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="w-full lg:w-72 shrink-0">
            <StorageTreeMock />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-base font-semibold text-ink mb-2">{tr('tutorial.storageTitle')}</h4>
            <ul className="list-disc list-inside space-y-1.5 ml-1 text-sm text-ink-2">
              <li>{tr('tutorial.storage1')}</li>
              <li>{tr('tutorial.storage2')}</li>
              <li>{tr('tutorial.storage3')}</li>
              <li>{tr('tutorial.storage4')}</li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  )
}
