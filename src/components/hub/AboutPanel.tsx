import { Mic, Sparkles, Zap, HardDrive, ArrowRight } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { RefreshCw, Download, X } from 'lucide-react'
import { useI18n } from '../../i18n/react'
import {
  useUpdateState, checkUpdate, checkOnStartup, installUpdateAction,
  openDownloadPage, skipUpdate,
} from '../../services/updateStore'
import { formatBytes, notesExcerpt } from '../../services/update'
import type { MessageKey } from '../../i18n/core'

function openExternalLink(url: string) {
  if ((window as any).desktopAPI?.openExternalLink) {
    (window as any).desktopAPI.openExternalLink(url)
  } else {
    window.open(url, '_blank')
  }
}

const FEATURES: { icon: LucideIcon; titleKey: MessageKey; descKey: MessageKey; tone: 'accent' | 'accent2' }[] = [
  { icon: Mic, titleKey: 'about.feature.clone.title', descKey: 'about.feature.clone.desc', tone: 'accent' },
  { icon: Sparkles, titleKey: 'about.feature.style.title', descKey: 'about.feature.style.desc', tone: 'accent' },
  { icon: Zap, titleKey: 'about.feature.speed.title', descKey: 'about.feature.speed.desc', tone: 'accent2' },
  { icon: HardDrive, titleKey: 'about.feature.local.title', descKey: 'about.feature.local.desc', tone: 'accent2' },
]

// Product names are brand names and stay untranslated; only descriptions go
// through the catalog.
const PRODUCTS: { name: string; icon: string; descKey: MessageKey; url: string }[] = [
  { name: 'YiziMarkdown', icon: '/yizimarkdown.png', descKey: 'about.product.yizimarkdown.desc', url: 'https://md.yizigpt.com' },
  { name: 'YiziShare', icon: '/yizishare.png', descKey: 'about.product.yizishare.desc', url: 'https://share.yizigpt.com' },
  { name: 'YiziStudio', icon: '/yizistudio.png', descKey: 'about.product.yizistudio.desc', url: 'https://www.aidashi.vip/' },
  { name: '一路狂标', icon: '/yilukuangbiao.png', descKey: 'about.product.yilukuangbiao.desc', url: 'https://biao.yizigpt.com/' },
  { name: '荔书', icon: '/lishu.png', descKey: 'about.product.lishu.desc', url: 'https://todo.yepaper.com' },
]

// 关于面板:由 HubPage 作为「关于」页签挂载(整页视图)
export function AboutPanel() {
  const { t: tr } = useI18n()
  const up = useUpdateState()
  const [notesOpen, setNotesOpen] = useState(false)

  // 打开关于页时若还没查过，主动查一次（自动检查失败静默，这里 manual=false 同规则；
  // 用户点「检查更新」才用 manual=true 把失败原因显示出来）
  useEffect(() => {
    if (up.status === 'idle') void checkOnStartup()
    // 仅挂载时触发一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const busy = up.status === 'checking' || up.status === 'downloading'
  const percent = up.total ? Math.round((up.downloaded / up.total) * 100) : null
  const excerpt = up.update?.notes ? notesExcerpt(up.update.notes) : ''

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center text-center pt-1">
        <img src="/icon.png" alt="YiziVoice" className="w-[72px] h-[72px] rounded-2xl shadow-[var(--shadow-card)]" />
        <p className="mt-2.5 text-xs text-ink-3 tracking-wide">{tr('about.version', { version: __APP_VERSION__ })}</p>
      </div>

      {/* 在线更新：检测 + Windows NSIS 一键安装 / 其余平台手动下载 */}
      <section>
        <h4 className="text-base font-semibold text-ink mb-3">{tr('update.section')}</h4>
        <div className="mat-card p-4 space-y-3">
          <p className="text-xs text-ink-3">{tr('update.current', { version: __APP_VERSION__ })}</p>

          {up.status === 'idle' && !up.blocker && (
            <p className="text-xs text-ink-3">{tr('update.checking')}</p>
          )}
          {up.status === 'idle' && up.blocker === 'dev' && (
            <p className="text-xs text-ink-3">{tr('update.devHint')}</p>
          )}
          {up.status === 'idle' && up.blocker === 'not-tauri' && (
            <p className="text-xs text-ink-3">{tr('update.notTauriHint')}</p>
          )}
          {up.status === 'checking' && <p className="text-xs text-ink-3">{tr('update.checking')}</p>}
          {up.status === 'latest' && <p className="text-xs text-ink-3">{tr('update.latest')}</p>}

          {(up.status === 'available' || up.status === 'skipped') && up.update && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-ink">
                {up.status === 'skipped'
                  ? tr('update.skipped', { version: up.update.version })
                  : tr('update.found', { version: up.update.version })}
              </p>
              {excerpt && (
                <div>
                  <button
                    type="button"
                    onClick={() => setNotesOpen(o => !o)}
                    className="text-xs text-accent hover:underline cursor-pointer"
                  >
                    {tr('update.notes')}
                  </button>
                  {notesOpen && (
                    <p className="mt-1.5 text-xs text-ink-3 leading-relaxed whitespace-pre-wrap">{up.update.notes}</p>
                  )}
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                {up.update.mode === 'auto' && up.status === 'available' ? (
                  <button
                    type="button"
                    onClick={() => void installUpdateAction()}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-sm bg-accent-strong text-accent-on text-sm font-medium hover:bg-accent-hover cursor-pointer transition-colors"
                  >
                    <Download size={14} />
                    {tr('update.install')}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => openDownloadPage()}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-sm bg-accent-strong text-accent-on text-sm font-medium hover:bg-accent-hover cursor-pointer transition-colors"
                  >
                    <Download size={14} />
                    {tr('update.openPage')}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => skipUpdate()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-sm border border-line text-ink-2 text-sm font-medium hover:bg-surface-hover cursor-pointer transition-colors"
                >
                  <X size={14} />
                  {tr('update.skip')}
                </button>
              </div>
              {up.blocker && up.update.mode === 'manual' && (
                <p className="text-xs text-ink-3">{tr('update.manualHint')}</p>
              )}
            </div>
          )}

          {up.status === 'downloading' && (
            <div className="space-y-1.5">
              <p className="text-xs text-ink-3">
                {percent !== null
                  ? tr('update.downloading', { percent })
                  : tr('update.downloading', { percent: 0 })}
                {up.total ? ` · ${formatBytes(up.total)}` : ''}
              </p>
              <div className="h-1.5 rounded-full bg-surface-hover overflow-hidden">
                <div
                  className="h-full bg-accent transition-all duration-200"
                  style={{ width: percent !== null ? `${percent}%` : '30%' }}
                />
              </div>
            </div>
          )}
          {up.status === 'installed' && (
            <p className="text-xs text-ink-3">{tr('update.installing')}</p>
          )}

          {up.status === 'error' && (
            <div className="space-y-1.5">
              <p className="text-xs text-danger-text">
                {up.errorPhase === 'install' ? tr('update.installFailed') : tr('update.checkFailed')}
                {up.error ? `：${up.error}` : ''}
              </p>
              <button
                type="button"
                onClick={() => void checkUpdate(true)}
                className="text-xs text-accent hover:underline cursor-pointer"
              >
                {tr('update.retry')}
              </button>
            </div>
          )}

          {/* 检查按钮：下载/安装中隐藏；dev/非 Tauri 不给（点了也没结果） */}
          {!busy && up.status !== 'installed' && up.status !== 'error'
            && up.blocker !== 'dev' && up.blocker !== 'not-tauri' && (
            <button
              type="button"
              onClick={() => void checkUpdate(true)}
              disabled={busy}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-sm border border-line text-ink-2 text-sm font-medium hover:bg-surface-hover cursor-pointer transition-colors disabled:opacity-50"
            >
              <RefreshCw size={14} className={busy ? 'animate-spin' : ''} />
              {up.status === 'checking' ? tr('update.checking') : tr('update.check')}
            </button>
          )}
        </div>
      </section>

      <p className="text-sm text-ink-2 leading-relaxed">
        {tr('about.intro')}
      </p>

      <section>
        <h4 className="text-base font-semibold text-ink mb-3">{tr('about.features')}</h4>
        <div className="grid grid-cols-4 gap-2.5">
          {FEATURES.map(f => (
            <div key={f.titleKey} className={`mat-card p-3.5 ${f.tone === 'accent' ? '' : ''}`}>
              <f.icon size={16} className={f.tone === 'accent' ? 'text-accent mb-2' : 'text-accent-2-text mb-2'} />
              <h5 className="text-base font-semibold text-ink mb-0.5">{tr(f.titleKey)}</h5>
              <p className="text-xs text-ink-3">{tr(f.descKey)}</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h4 className="text-base font-semibold text-ink mb-3">{tr('about.officialSite')}</h4>
        {/* 与其他产品同为两列栅格(gap 一致),保证上下两个区块的卡片左右边缘对齐 */}
        <div className="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={() => openExternalLink('https://voice.yizigpt.com')}
            className="mat-card w-full text-left p-3 flex items-center gap-3 cursor-pointer hover:bg-surface-hover transition-colors group"
          >
            <img src="/icon.png" alt="YiziVoice" className="w-9 h-9 rounded-sm shrink-0" />
            <div className="flex-1 min-w-0">
              <h5 className="text-base font-semibold text-ink">{tr('about.siteTitle')}</h5>
              <p className="text-xs text-ink-3">{tr('about.siteDesc')}</p>
            </div>
            <ArrowRight size={16} className="text-ink-3 group-hover:text-accent transition-colors shrink-0" />
          </button>
        </div>
      </section>

      <section>
        <h4 className="text-base font-semibold text-ink mb-3">{tr('about.otherProducts')}</h4>
        <div className="grid grid-cols-2 gap-2.5">
          {PRODUCTS.map(p => (
            <button
              key={p.name}
              type="button"
              onClick={() => openExternalLink(p.url)}
              className="mat-card w-full text-left p-3 flex items-center gap-3 cursor-pointer hover:bg-surface-hover transition-colors group"
            >
              <img src={p.icon} alt={p.name} className="w-9 h-9 rounded-sm shrink-0" />
              <div className="flex-1 min-w-0">
                <h5 className="text-base font-semibold text-ink">{p.name}</h5>
                <p className="text-xs text-ink-3">{tr(p.descKey)}</p>
              </div>
              <ArrowRight size={16} className="text-ink-3 group-hover:text-accent transition-colors shrink-0" />
            </button>
          ))}
        </div>
      </section>

      <div className="text-center">
        <p className="text-xs text-ink-3">{tr('about.tagline')}</p>
      </div>
    </div>
  )
}
