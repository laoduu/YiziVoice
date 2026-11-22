import { useState, useEffect, useCallback, useRef } from 'react'
import { Plus, Search, Clock, Mic, AudioLines, FolderOpen, Trash2, Copy, Download, Eraser, MoreHorizontal, ScanFace, Play, Pause, History } from 'lucide-react'
import {
  loadHistory, deleteHistoryEntry, getHistoryAudioSrc, releaseAudioSrc, downloadEntryAudio, clearAllHistory, openHistoryFolder,
  notifyHistoryUpdated, fmtEntryTime, pruneOrphanAudio,
  HistoryEntry, TtsHistoryEntry, AsrHistoryEntry,
} from '../services/historyService'
import { useToast } from './Toast'
import { Button } from './ui/Button'
import { Input } from './ui/Input'
import { DropdownMenu } from './ui/DropdownMenu'
import { Dialog } from './ui/Dialog'
import { Tooltip } from './ui/Tooltip'
import { EmptyState } from './ui/Skeleton'
import type { Tool } from '../App'
import { PaneToggle } from '../App'
import { useI18n, type MessageKey } from '../i18n/react'
import type { LucideIcon } from 'lucide-react'

type TabType = 'all' | 'tts' | 'asr'

// 功能菜单顺序(与快捷键 Ctrl+1/2/3 一致)
const TOOL_NAV: { tool: Tool; labelKey: MessageKey; icon: LucideIcon }[] = [
  { tool: 'clone', labelKey: 'nav.clone', icon: ScanFace },
  { tool: 'tts', labelKey: 'nav.tts', icon: AudioLines },
  { tool: 'asr', labelKey: 'nav.asr', icon: Mic },
]

interface LeftPaneProps {
  activeTool: Tool
  onSelectTool: (t: Tool) => void
  onNewSession: () => void
  onLoadTts: (entry: TtsHistoryEntry) => void
  onToggleLeft: () => void
}

// 左侧栏:新建 + 功能菜单 + 历史常驻列表
// (设置/教程/关于已上移到标题栏的设置中心,不再占用底部)
export function LeftPane({ activeTool, onSelectTool, onNewSession, onLoadTts, onToggleLeft }: LeftPaneProps) {
  const { t: tr } = useI18n()
  const [entries, setEntries] = useState<HistoryEntry[]>([])
  const [tab, setTab] = useState<TabType>('all')
  const [query, setQuery] = useState('')
  const [playing, setPlaying] = useState<string | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [pruneCount, setPruneCount] = useState<number | null>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const { showToast } = useToast()

  const refresh = useCallback(async () => {
    setEntries(await loadHistory())
  }, [])

  useEffect(() => {
    refresh()
    const onChanged = () => refresh()
    window.addEventListener('yizivoice:history-updated', onChanged)
    return () => window.removeEventListener('yizivoice:history-updated', onChanged)
  }, [refresh])

  // 卸载时释放 Linux 回放用的 blob URL(历史回放已是 data:,此处仅兜底)
  useEffect(() => () => releaseAudioSrc(audioRef.current?.src), [])

  const handlePlay = async (entry: { id: string }) => {
    if (playing === entry.id) {
      audioRef.current?.pause()
      if (audioRef.current) audioRef.current.currentTime = 0
      setPlaying(null)
      return
    }
    try {
      const src = await getHistoryAudioSrc(entry)
      if (!src) {
        showToast(tr('history.audioMissing'), 'error')
        return
      }
      if (audioRef.current) {
        // 换条目前释放上一条的 blob URL(仅 blob: 会被释放)
        releaseAudioSrc(audioRef.current.src)
        audioRef.current.src = src
        void audioRef.current.play().catch(() => {
          showToast(tr('ui.playFailed'), 'error')
          setPlaying(null)
        })
        setPlaying(entry.id)
      }
    } catch (e) {
      showToast(e instanceof Error ? e.message : tr('history.audioLoadFailed'), 'error')
    }
  }

  const handleCopy = async (text: string) => {
    await navigator.clipboard.writeText(text)
    showToast(tr('common.copied'), 'success')
  }

  const handleDownload = async (entry: HistoryEntry) => {
    const r = await downloadEntryAudio(entry)
    if (r.error) showToast(r.error, 'error')
  }

  // 先 dry-run 拿到数量,弹确认再真删。索引读不出来时 Rust 侧会拒绝执行。
  const handlePruneOrphans = async () => {
    const r = await pruneOrphanAudio(true)
    if (r.error) { showToast(r.error, 'error'); return }
    if (r.removed === 0) { showToast(tr('history.noOrphanAudio'), 'info'); return }
    setPruneCount(r.removed)
  }

  const handlePruneConfirm = async () => {
    setPruneCount(null)
    const r = await pruneOrphanAudio(false)
    if (r.error) { showToast(r.error, 'error'); return }
    showToast(tr('history.pruneDone', { count: r.removed }), 'success')
  }

  const handleDeleteConfirm = async () => {
    if (!deleteConfirmId) return
    await deleteHistoryEntry(deleteConfirmId)
    setDeleteConfirmId(null)
    await refresh()
    showToast(tr('history.deleted'), 'info')
  }

  const handleClearAll = async () => {
    await clearAllHistory()
    await refresh()
    showToast(tr('history.clearedAll'), 'info')
  }

  const filtered = entries.filter(e => {
    if (tab !== 'all' && e.type !== tab) return false
    if (!query.trim()) return true
    const text = e.type === 'tts' ? (e as TtsHistoryEntry).text : (e as AsrHistoryEntry).text
    return text.toLowerCase().includes(query.trim().toLowerCase())
  })

  const ttsCount = entries.filter(e => e.type === 'tts').length
  const asrCount = entries.filter(e => e.type === 'asr').length

  const TABS: { key: TabType; labelKey: MessageKey; icon: LucideIcon; count: number }[] = [
    { key: 'all', labelKey: 'history.tabAll', icon: Clock, count: entries.length },
    { key: 'tts', labelKey: 'nav.tts', icon: AudioLines, count: ttsCount },
    { key: 'asr', labelKey: 'nav.asr', icon: Mic, count: asrCount },
  ]

  return (
    <div className="h-full flex flex-col min-h-0">
      <audio ref={audioRef} onEnded={() => setPlaying(null)} />

      {/* 新建(与功能菜单同行样式) + 收起按钮 */}
      <div className="p-3 pb-2 flex items-center gap-2">
        <button
          type="button"
          onClick={onNewSession}
          className="flex-1 min-w-0 flex items-center gap-2.5 h-11 px-2.5 rounded-sm text-base font-medium text-ink cursor-pointer transition-colors duration-100 ease-out hover:bg-surface-hover"
        >
          <Plus size={16} />
          {tr('nav.newSession')}
        </button>
        <PaneToggle side="left" open={true} onToggle={onToggleLeft} />
      </div>

      {/* 功能菜单:克隆音色 / 文生音 / 音转文 */}
      <nav className="px-3 pb-2 space-y-0.5">
        {TOOL_NAV.map(n => (
          <button
            key={n.tool}
            type="button"
            onClick={() => onSelectTool(n.tool)}
            className={`w-full flex items-center gap-2.5 h-11 px-2.5 rounded-sm text-base font-medium cursor-pointer transition-colors duration-100 ease-out ${
              activeTool === n.tool
                ? 'bg-surface-active text-accent'
                : 'text-ink hover:bg-surface-hover'
            }`}
          >
            <n.icon size={16} />
            {tr(n.labelKey)}
          </button>
        ))}
      </nav>

      {/* 搜索 */}
      <div className="px-3 pb-2">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-3 pointer-events-none" />
          <Input
            id="history-search"
            placeholder={tr('history.searchPlaceholder')}
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="pl-8 h-[30px] text-sm"
          />
        </div>
      </div>

      {/* 类型筛选 */}
      <div className="px-3 pb-2 flex items-center gap-1">
        {TABS.map(t => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            title={`${tr(t.labelKey)} (${t.count})`}
            className={`flex-1 h-[26px] rounded-sm inline-flex items-center justify-center gap-1 text-sm font-medium cursor-pointer transition-all duration-100 ease-out ${
              tab === t.key ? 'bg-surface-active text-accent' : 'text-ink-2 hover:bg-surface-hover hover:text-ink'
            }`}
          >
            <t.icon size={14} />
            {t.count}
          </button>
        ))}
        <DropdownMenu
          variant="ghost"
          align="end"
          tooltip={tr('history.moreActions')}
          icon={MoreHorizontal}
          items={[
            { key: 'folder', label: tr('history.openFolder'), icon: FolderOpen },
            { key: 'prune', label: tr('history.pruneOrphans'), icon: Eraser },
            { key: 'clear', label: tr('history.clearAll'), icon: Trash2, danger: true },
          ]}
          onSelect={key => {
            if (key === 'folder') openHistoryFolder()
            if (key === 'prune') handlePruneOrphans()
            if (key === 'clear') handleClearAll()
          }}
        />
      </div>

      {/* 历史流 */}
      <div className="flex-1 overflow-y-auto px-2 pb-2 min-h-0">
        {filtered.length === 0 ? (
          <EmptyState icon={Clock} title={tr('history.emptyTitle')} hint={tr('history.emptyHint')} />
        ) : (
          filtered.map(entry => {
            const isTts = entry.type === 'tts'
            // tts 一定有音频;asr 只有"录音"来源才落盘(旧记录没有该字段)
            const hasAudio = !!(entry as { audioFileName?: string }).audioFileName
            const isPlaying = playing === entry.id
            // v4.1:行内操作默认全部 hover 才显示(此前播放/复制常显、其余三个 hover,
            // 同一行两种显隐规则)。但「正在播放」是进行中的状态,此时整行操作**一起**
            // 保持可见——只留暂停键可见会让这一行显得断裂。
            // 键盘同样要能看见它们:行本身 tabIndex=0(`group-focus-visible`),Tab 进到行内
            // 按钮时(`group-has-[:focus-visible]`)。**不要用 `focus-within`** —— 鼠标点过的
            // 按钮会长期持有焦点,整排就再也不收起了(音色卡片踩过,见 DESIGN.md §5.9)。
            const actionReveal = isPlaying
              ? 'opacity-100'
              : 'opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 group-has-[:focus-visible]:opacity-100'
            return (
              <div
                key={entry.id}
                role="button"
                tabIndex={0}
                onClick={() => isTts && onLoadTts(entry as TtsHistoryEntry)}
                onKeyDown={e => { if (e.key === 'Enter' && isTts) onLoadTts(entry as TtsHistoryEntry) }}
                className="group rounded-sm p-2.5 mb-1 cursor-pointer transition-colors duration-100 ease-out hover:bg-surface-hover"
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <span
                    className={`inline-flex items-center gap-1 text-xs font-medium ${
                      isTts ? 'text-accent' : 'text-success-text'
                    }`}
                  >
                    {isTts ? <AudioLines size={12} /> : <Mic size={12} />}
                    {isTts ? tr('nav.tts') : tr('nav.asr')}
                  </span>
                  {isTts && (
                    <span className="text-xs px-1.5 py-px rounded-full bg-accent-2-soft text-accent-2-text truncate max-w-[90px]">
                      {(entry as TtsHistoryEntry).voiceName}
                    </span>
                  )}
                  <span className="flex-1" />
                  <span className="text-xs text-ink-3 shrink-0">{fmtEntryTime(entry.createdAt)}</span>
                </div>

                {/* v4.1: entry text drops to caption tier and one colour step down.
                    This is a content PREVIEW in a dense list, not a control label --
                    see DESIGN.md 5.9-12, which bans 12px on control LABELS only. */}
                <p className="text-xs leading-relaxed text-ink-3 line-clamp-2 mb-1.5">
                  {isTts ? (entry as TtsHistoryEntry).text : (entry as AsrHistoryEntry).text}
                </p>

                <div className="flex items-center gap-0.5 -ml-1">
                  {hasAudio && (
                    <Tooltip label={isPlaying ? tr('common.pause') : tr('common.play')}>
                      <button
                        type="button"
                        aria-label={isPlaying ? tr('common.pause') : tr('common.play')}
                        onClick={e => { e.stopPropagation(); void handlePlay(entry) }}
                        className={`w-6 h-6 rounded-sm grid place-items-center cursor-pointer transition-all duration-100 ${actionReveal} ${
                          isPlaying ? 'bg-accent-strong text-accent-on' : 'text-ink-3 hover:bg-surface-active hover:text-accent'
                        }`}
                      >
                        {isPlaying ? <Pause size={12} /> : <Play size={12} />}
                      </button>
                    </Tooltip>
                  )}
                  <Tooltip label={tr('history.copyText')}>
                    <button
                      type="button"
                      aria-label={tr('history.copyText')}
                      onClick={e => { e.stopPropagation(); handleCopy(isTts ? (entry as TtsHistoryEntry).text : (entry as AsrHistoryEntry).text) }}
                      className={`w-6 h-6 rounded-sm grid place-items-center text-ink-3 hover:bg-surface-active hover:text-ink cursor-pointer transition-all duration-100 ${actionReveal}`}
                    >
                      <Copy size={12} />
                    </button>
                  </Tooltip>
                  {isTts && (
                    <Tooltip label={tr('history.restoreTask')}>
                      <button
                        type="button"
                        aria-label={tr('history.restoreTask')}
                        onClick={e => { e.stopPropagation(); onLoadTts(entry as TtsHistoryEntry) }}
                        className={`w-6 h-6 rounded-sm grid place-items-center text-ink-3 hover:bg-surface-active hover:text-accent cursor-pointer transition-all duration-100 ${actionReveal}`}
                      >
                        <History size={12} />
                      </button>
                    </Tooltip>
                  )}
                  {hasAudio && (
                    <Tooltip label={tr('common.downloadAudio')}>
                      <button
                        type="button"
                        aria-label={tr('common.downloadAudio')}
                        onClick={e => { e.stopPropagation(); void handleDownload(entry) }}
                        className={`w-6 h-6 rounded-sm grid place-items-center text-ink-3 hover:bg-surface-active hover:text-accent cursor-pointer transition-all duration-100 ${actionReveal}`}
                      >
                        <Download size={12} />
                      </button>
                    </Tooltip>
                  )}
                  <span className="flex-1" />
                  <Tooltip label={tr('common.delete')}>
                    <button
                      type="button"
                      aria-label={tr('common.delete')}
                      onClick={e => { e.stopPropagation(); setDeleteConfirmId(entry.id) }}
                      className={`w-6 h-6 rounded-sm grid place-items-center text-ink-3 hover:text-danger-text hover:bg-danger-soft cursor-pointer transition-all duration-100 ${actionReveal}`}
                    >
                      <Trash2 size={12} />
                    </button>
                  </Tooltip>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* 删除确认 */}
      <Dialog
        open={!!deleteConfirmId}
        onClose={() => setDeleteConfirmId(null)}
        title={tr('history.deleteConfirm')}
        subtitle={tr('history.deleteBody')}
        width={360}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteConfirmId(null)}>{tr('common.cancel')}</Button>
            <Button variant="danger" onClick={handleDeleteConfirm}>{tr('history.deleteConfirm')}</Button>
          </>
        }
      />
      {/* 清理孤儿音频确认 */}
      <Dialog
        open={pruneCount !== null}
        onClose={() => setPruneCount(null)}
        title={tr('history.pruneOrphans')}
        subtitle={tr('history.pruneBody', { count: pruneCount ?? 0 })}
        width={360}
        footer={
          <>
            <Button variant="secondary" onClick={() => setPruneCount(null)}>{tr('common.cancel')}</Button>
            <Button variant="danger" onClick={handlePruneConfirm}>{tr('history.pruneAction')}</Button>
          </>
        }
      />
    </div>
  )
}
