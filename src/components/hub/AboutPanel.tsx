import { Mic, Sparkles, Zap, HardDrive, ArrowRight } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useI18n } from '../../i18n/react'
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
  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center text-center pt-1">
        <img src="/icon.png" alt="YiziVoice" className="w-[72px] h-[72px] rounded-2xl shadow-[var(--shadow-card)]" />
        <p className="mt-2.5 text-xs text-ink-3 tracking-wide">{tr('about.version', { version: __APP_VERSION__ })}</p>
      </div>

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
