import { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen, ScanFace, AudioLines, Mic } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import TextToSpeech from './pages/TextToSpeech'
import SpeechToText from './pages/SpeechToText'
import VoiceClone from './pages/VoiceClone'
import { TitleBar } from './components/TitleBar'
import { LeftPane } from './components/LeftPane'
import { Welcome } from './components/Welcome'
import { HubPage, type HubTab } from './components/hub/HubPage'
import { Tooltip } from './components/ui/Tooltip'
import { ToastProvider } from './components/Toast'
import { migrateLegacySettings } from './services/storage'
import type { TtsHistoryEntry } from './services/historyTypes'

export type Tool = 'home' | 'tts' | 'asr' | 'clone'

// 收起态窄条的工具导航(与左栏菜单一致)
const COLLAPSED_TOOLS: { tool: Tool; label: string; icon: LucideIcon }[] = [
  { tool: 'clone', label: '克隆音色', icon: ScanFace },
  { tool: 'tts', label: '文生音', icon: AudioLines },
  { tool: 'asr', label: '音转文', icon: Mic },
]

interface AppContextShape {
  activeTool: Tool
  setTool: (t: Tool) => void
  newSession: () => void
  resetSignal: number
  // 一次性"载入历史"指令:signal 触发 effect,数据放 ref 里、取走即清。
  // 不用 state 承载——StrictMode 挂载期 effect 会跑两次,state 会被读到两次(实测还原执行 2 次、弹 2 条提示)
  ttsLoadSignal: number
  takeTtsEntry: () => TtsHistoryEntry | null
  rightOpen: boolean
  toggleRight: () => void
}

const AppContext = createContext<AppContextShape>({
  activeTool: 'tts',
  setTool: () => {},
  newSession: () => {},
  resetSignal: 0,
  ttsLoadSignal: 0,
  takeTtsEntry: () => null,
  rightOpen: true,
  toggleRight: () => {},
})

export function useApp() {
  return useContext(AppContext)
}

export function PaneToggle({ side, open, onToggle }: { side: 'left' | 'right'; open: boolean; onToggle: () => void }) {
  const Icon = side === 'left' ? (open ? PanelLeftClose : PanelLeftOpen) : open ? PanelRightClose : PanelRightOpen
  return (
    <Tooltip label={`${open ? '收起' : '展开'}${side === 'left' ? '左侧栏' : '右侧栏'} (Ctrl+${side === 'left' ? 'L' : 'R'})`} side="bottom" align="end">
      <button
        type="button"
        onClick={onToggle}
        aria-label={`切换${side === 'left' ? '左' : '右'}侧栏`}
        className="w-7 h-7 rounded-sm grid place-items-center text-ink-3 hover:text-ink hover:bg-surface-hover cursor-pointer transition-colors"
      >
        <Icon size={14} />
      </button>
    </Tooltip>
  )
}

function DesktopShell() {
  const [activeTool, setTool] = useState<Tool>('home')
  const [resetSignal, setResetSignal] = useState(0)
  const pendingTtsEntry = useRef<TtsHistoryEntry | null>(null)
  const [ttsLoadSignal, setTtsLoadSignal] = useState(0)
  const [leftOpen, setLeftOpen] = useState(true)
  const [rightOpen, setRightOpen] = useState(true)
  // 设置中心页签,null = 未打开(此时显示工具工作台)。
  // 受控而非页面内部自持:入口(Ctrl+, / 标题栏齿轮)可直接指定落地页签
  const [hubTab, setHubTab] = useState<HubTab | null>(null)
  const hubOpen = hubTab !== null

  // 选工具即离开设置中心。左栏、收起态窄条、欢迎页、快捷键共用此入口,
  // 否则会出现「点工具切走了但设置中心还盖在上面」
  const selectTool = useCallback((t: Tool) => {
    setHubTab(null)
    setTool(t)
  }, [])

  const closeHub = useCallback(() => setHubTab(null), [])

  // 标题栏齿轮做成 toggle:再点一次回到原来的工作台
  const toggleHub = useCallback(() => {
    setHubTab(v => (v === null ? 'settings' : null))
  }, [])

  useEffect(() => {
    migrateLegacySettings()
    // 启动即初始化 OpenAI 客户端(密钥在凭据库,读取后装配),否则重启后所有功能不可用
    import('./services/configService').then(async m => {
      try {
        // The key is write-only for the UI; only the client boot path reads it back.
        const key = await m.loadApiKey()
        if (key) {
          const { initClient } = await import('./services/mimoApi')
          initClient({ apiKey: key })
        }
      } catch { /* 桥接未就绪时跳过,设置页保存时会再次初始化 */ }
    })
  }, [])

  // 新建:回到欢迎页并清空当前会话状态
  const newSession = useCallback(() => {
    setResetSignal(s => s + 1)
    selectTool('home')
  }, [selectTool])

  const loadTts = useCallback((entry: TtsHistoryEntry) => {
    pendingTtsEntry.current = entry
    setTtsLoadSignal(s => s + 1)
    selectTool('tts')
  }, [selectTool])

  // 取走即清:同一轮渲染里被调用两次,第二次必然拿到 null(结构性幂等,不依赖记忆某个 guard 写法)
  const takeTtsEntry = useCallback(() => {
    const entry = pendingTtsEntry.current
    pendingTtsEntry.current = null
    return entry
  }, [])

  // 全局快捷键(顺序与左栏菜单一致:克隆/文生音/音转文)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey
      if (!mod) return
      const k = e.key.toLowerCase()
      if (k === '1') { e.preventDefault(); selectTool('clone') }
      else if (k === '2') { e.preventDefault(); selectTool('tts') }
      else if (k === '3') { e.preventDefault(); selectTool('asr') }
      else if (k === 'l') { e.preventDefault(); setLeftOpen(v => !v) }
      else if (k === 'r') { e.preventDefault(); setRightOpen(v => !v) }
      else if (k === 'f') { e.preventDefault(); document.getElementById('history-search')?.focus() }
      else if (e.key === ',') { e.preventDefault(); setHubTab('settings') }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectTool])

  // Esc 返回工作台(设置中心是整页视图,没有弹窗可关,由这里承接原先 Dialog 的 Esc 语义)
  useEffect(() => {
    if (!hubOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); setHubTab(null) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [hubOpen])

  const ctx = useMemo<AppContextShape>(
    () => ({
      activeTool,
      setTool: selectTool,
      newSession,
      resetSignal,
      ttsLoadSignal,
      takeTtsEntry,
      rightOpen,
      toggleRight: () => setRightOpen(v => !v),
    }),
    [activeTool, selectTool, newSession, resetSignal, ttsLoadSignal, takeTtsEntry, rightOpen],
  )

  return (
    <AppContext.Provider value={ctx}>
      <div className="h-full flex flex-col">
        <TitleBar onOpenSettings={toggleHub} settingsOpen={hubOpen} />

        <div className="flex-1 flex min-h-0 gap-2 px-2 pb-2">
          {/* 左侧栏 */}
          <aside
            className={`mat-panel shrink-0 mat-clip transition-[width] duration-200 ease-out flex flex-col ${
              leftOpen ? 'w-[260px]' : 'w-12'
            }`}
          >
            {leftOpen ? (
              <LeftPane
                activeTool={activeTool}
                onSelectTool={selectTool}
                onNewSession={newSession}
                onLoadTts={loadTts}
                onToggleLeft={() => setLeftOpen(v => !v)}
              />
            ) : (
              <div className="flex-1 flex flex-col items-center gap-1 py-2">
                <button
                  type="button"
                  onClick={() => setLeftOpen(v => !v)}
                  aria-label="展开左侧栏"
                  title="展开左侧栏 (Ctrl+L)"
                  className="w-8 h-8 rounded-sm grid place-items-center text-ink-3 hover:text-ink hover:bg-surface-hover cursor-pointer transition-colors"
                >
                  <PanelLeftOpen size={16} />
                </button>
                <div className="flex-1 flex flex-col items-center gap-1 mt-1">
                  {COLLAPSED_TOOLS.map(n => (
                    <button
                      key={n.tool}
                      type="button"
                      onClick={() => selectTool(n.tool)}
                      title={n.label}
                      aria-label={n.label}
                      className={`w-8 h-8 rounded-sm grid place-items-center cursor-pointer transition-colors ${
                        activeTool === n.tool
                          ? 'text-accent bg-surface-active'
                          : 'text-ink-3 hover:text-ink hover:bg-surface-hover'
                      }`}
                    >
                      <n.icon size={16} />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </aside>

          {/* 中央区:设置中心整页视图,或欢迎页/工具工作台 */}
          <main className="flex-1 min-w-0 flex flex-col">
            {/* 工具视图槽:打开设置中心时隐藏但保持挂载,避免丢失正在编辑的草稿。
                原先由弹窗叠加在工具之上天然保证这一点,改成整页视图后必须显式保留 */}
            <div className={`flex-1 min-h-0 ${hubOpen ? 'hidden' : ''}`}>
              {activeTool === 'home' && <Welcome onSelect={selectTool} />}
              {activeTool === 'tts' && <TextToSpeech />}
              {activeTool === 'asr' && <SpeechToText />}
              {activeTool === 'clone' && <VoiceClone />}
            </div>

            {/* 整页视图而非弹窗:三个页签内容高差 517px,弹窗框高会随内容跳动 */}
            {hubTab !== null && (
              <HubPage tab={hubTab} onTabChange={setHubTab} onBack={closeHub} />
            )}
          </main>
        </div>
      </div>
    </AppContext.Provider>
  )
}

export default function App() {
  return (
    <ToastProvider>
      <DesktopShell />
    </ToastProvider>
  )
}
