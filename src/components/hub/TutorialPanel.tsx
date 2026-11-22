import { Fragment, useState, type ReactNode } from 'react'
import {
  ArrowRight, AudioLines, ChevronDown, Cpu, History, KeyRound, Mic, ScanFace,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useApp } from '../../App'
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

type Target = 'settings' | 'clone' | 'tts' | 'asr' | 'history'

interface Step {
  title: string
  icon: LucideIcon
  goal: string
  bullets: ReactNode[]
  more?: ReactNode[]
  mock: ReactNode
  action?: { label: string; target: Target }
  anchor?: string
}

const FLOW: { label: string; caption: string; icon: LucideIcon; target: Target }[] = [
  { label: '配置密钥与模型', caption: 'API Key + 文本模型', icon: KeyRound, target: 'settings' },
  { label: '准备音色', caption: '克隆 / 上传 / 设计', icon: ScanFace, target: 'clone' },
  { label: '文生音', caption: '选音色、写文案、生成', icon: AudioLines, target: 'tts' },
  { label: '音转文', caption: '录音或上传转文字', icon: Mic, target: 'asr' },
  { label: '历史与导出', caption: '回放 / 还原 / 下载', icon: History, target: 'history' },
]

const STEPS: Step[] = [
  {
    title: '配置 API Key',
    icon: KeyRound,
    goal: '先让应用能调用 MiMo 接口',
    bullets: [
      '打开「设置」（标题栏右上角齿轮，或 Ctrl+,）',
      <>
        没有账号先 <SignupLink>注册 MiMo 账号</SignupLink>；邀请码 <InviteCode /> 可领 10 元体验金
      </>,
      '粘贴 Key 后点「验证」确认可用，再点输入框内的「保存」',
    ],
    more: [
      'Key 加密保存在系统钥匙串，保存后不再显示',
      '替换时输入新 Key；删除时点「清除」并在弹窗确认',
      '「验证」调用 /models 探针，不消耗 token',
    ],
    mock: <SettingsKeyMock />,
    action: { label: '去设置', target: 'settings' },
  },
  {
    title: '配置 AI 文本模型',
    icon: Cpu,
    goal: '决定「AI 生成」使用哪个文本模型',
    bullets: [
      '同一设置页，API Key 下方是「AI 文本模型」',
      '默认 mimo-v2.6-flash；点「获取模型」列出当前 Key 可用的文本模型',
      '从下拉中选择会自动填入并保存，也可手动填写模型 ID',
    ],
    more: [
      '用于「AI 生成风格描述」与「AI 生成描述与试听文本」',
      'TTS 语音合成免费；ASR 与 2.6 系列文本模型付费，需账户余额',
      '建议使用 mimo-v2.6-flash，每次生成音色描述仅需几分钱',
    ],
    mock: <SettingsModelMock />,
    action: { label: '去设置', target: 'settings' },
  },
  {
    title: '音色克隆与设计',
    icon: ScanFace,
    goal: '先准备声音，再去文生音里使用',
    bullets: [
      '三种入口：「开始录音」「上传文件」「设计音色」',
      '录音/上传后点「确认并保存角色」，试听并填写名称、分类',
      '设计音色可点右上角「AI 生成描述与试听文本」一次补全两段内容',
    ],
    more: [
      '已手写的试听文本不会被 AI 覆盖',
      '设计音色默认归入「设计音色」分类',
      '设计音频会作为样本保存；文生音仍通过 voiceclone 复用',
    ],
    mock: <VoiceSampleMock />,
    action: { label: '去克隆音色', target: 'clone' },
  },
  {
    title: '文生音',
    icon: AudioLines,
    goal: '用选定音色把文案变成语音',
    bullets: [
      '输入文案，在右侧音色库选择预置或克隆音色（可试听）',
      '选择风格写法：「标签方式」「自由描述」或「导演演绎」',
      '点击「生成语音」，完成后播放或下载 WAV',
    ],
    more: [
      '标签方式：选风格胶囊，按需插入开头风格标签或内嵌音频标签',
      '自由描述 / 导演演绎：可点「AI 生成风格描述」补全',
      'TTS 系列语音生成模型免费调用',
    ],
    mock: <TtsMock />,
    action: { label: '去文生音', target: 'tts' },
  },
  {
    title: '音转文',
    icon: Mic,
    goal: '把录音或音频文件转成文字',
    bullets: [
      '进入「音转文」，点「开始录音」或上传音频文件',
      '识别完成后查看并复制文本',
      '录音来源的音频可在历史记录中回放',
    ],
    more: [
      '上传来源不会复制音频到数据目录；原文件仍在原位置',
      'ASR 语音转文字为付费模型，使用时需账户余额',
    ],
    mock: <AsrMock />,
    action: { label: '去音转文', target: 'asr' },
  },
  {
    title: '历史记录',
    icon: History,
    goal: '回看、还原或导出之前的结果',
    bullets: [
      '左栏自动保存每次生成/识别，支持搜索与「全部 / 文生音 / 音转文」筛选',
      '悬停条目显示：播放、复制文本、还原任务、下载音频、删除',
      '「还原任务」仅文生音，会把模式、音色、风格、文本和结果音频一起装回',
    ],
    more: [
      '播放中该行操作会整组保持可见',
      '右上角「…」可清理孤儿音频',
      '删除记录会同时删除对应音频',
    ],
    mock: <HistoryMock />,
    anchor: 'tutorial-history',
  },
]

export function TutorialPanel({ onOpenSettings }: { onOpenSettings: () => void }) {
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

  const toggle = (title: string) => setExpanded(prev => ({ ...prev, [title]: !prev[title] }))

  return (
    <div className="space-y-5 pr-1">
      {/* 顶部流程图:先讲清"这套工具由哪几块组成",再进入细节 */}
      <section className="mat-card p-4">
        <div className="flex items-end justify-between gap-3 mb-3">
          <h3 className="text-base font-semibold text-ink">30 秒看懂</h3>
          <p className="text-xs text-ink-3">点任意节点可直接跳转</p>
        </div>
        <div className="flex flex-wrap items-stretch gap-2">
          {FLOW.map((node, i) => (
            <Fragment key={node.label}>
              <button
                type="button"
                onClick={() => go(node.target)}
                className="flex-1 min-w-32 rounded-sm border border-line bg-surface-1 p-3 text-left cursor-pointer transition-colors duration-100 hover:bg-surface-hover"
              >
                <node.icon size={24} className="text-accent" />
                <span className="block text-sm font-medium text-ink mt-1.5">{node.label}</span>
                <span className="block text-xs text-ink-3 mt-0.5">{node.caption}</span>
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
        const isOpen = !!expanded[step.title]
        return (
          <section key={step.title} id={step.anchor} className="mat-card p-4">
            <div className="flex flex-col lg:flex-row gap-4">
              <div className="w-full lg:w-72 shrink-0">{step.mock}</div>

              <div className="flex-1 min-w-0">
                <div className="flex items-start gap-3">
                  <span className="w-10 h-10 rounded-full bg-accent-soft text-accent grid place-items-center shrink-0">
                    <step.icon size={24} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-ink-3">
                      STEP {String(index + 1).padStart(2, '0')}
                    </p>
                    <h4 className="text-base font-semibold text-ink">{step.title}</h4>
                    <p className="text-xs text-ink-3 mt-0.5">{step.goal}</p>
                  </div>
                </div>

                <ul className="mt-3 list-disc list-inside space-y-1.5 ml-1 text-sm text-ink-2">
                  {step.bullets.map((item, i) => <li key={i}>{item}</li>)}
                </ul>

                {step.more && (
                  <>
                    <button
                      type="button"
                      onClick={() => toggle(step.title)}
                      aria-expanded={isOpen}
                      className="mt-2.5 inline-flex items-center gap-1 text-sm font-medium text-ink-3 hover:text-ink cursor-pointer"
                    >
                      {isOpen ? '收起' : '展开更多'}
                      <ChevronDown size={14} className={`transition-transform duration-100 ${isOpen ? 'rotate-180' : ''}`} />
                    </button>
                    {isOpen && (
                      <ul className="mt-2 list-disc list-inside space-y-1.5 ml-1 text-sm text-ink-2">
                        {step.more.map((item, i) => <li key={i}>{item}</li>)}
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
                    {step.action.label}
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
            <h4 className="text-base font-semibold text-ink mb-2">文件与数据存储</h4>
            <ul className="list-disc list-inside space-y-1.5 ml-1 text-sm text-ink-2">
              <li>历史记录保存在「文档 / YiziVoice / History /」：index.json 是索引，tts/ 与 asr/ 存放对应音频</li>
              <li>音色、风格、音频标签等配置保存在「文档 / YiziVoice / config /」</li>
              <li>可在 设置 → 数据存储 中查看当前目录，并整体迁移到其它位置</li>
              <li>API Key 不写入任何文件，只保存在系统钥匙串（Windows 凭据管理器 / macOS Keychain）</li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  )
}
