import { Mic, Sparkles, Zap, HardDrive, ArrowRight } from 'lucide-react'

function openExternalLink(url: string) {
  if ((window as any).desktopAPI?.openExternalLink) {
    (window as any).desktopAPI.openExternalLink(url)
  } else {
    window.open(url, '_blank')
  }
}

const FEATURES = [
  { icon: Mic, title: '音色克隆', desc: '保留你的独特声音', tone: 'accent' },
  { icon: Sparkles, title: '风格控制', desc: '让每段语音都有态度', tone: 'accent' },
  { icon: Zap, title: '极速生成', desc: '灵感不等待', tone: 'accent2' },
  { icon: HardDrive, title: '本地优先', desc: '你的数据你做主', tone: 'accent2' },
] as const

const PRODUCTS = [
  { name: 'YiziMarkdown', icon: '/yizimarkdown.png', desc: '既好看，又彪悍的 Markdown 编辑器', url: 'https://md.yizigpt.com' },
  { name: 'YiziShare', icon: '/yizishare.png', desc: '局域网里畅聊秒传的共享工具', url: 'https://share.yizigpt.com' },
  { name: 'YiziStudio', icon: '/yizistudio.png', desc: '种草式营销AI爆款内容创作工具', url: 'https://www.aidashi.vip/' },
  { name: '一路狂标', icon: '/yilukuangbiao.png', desc: 'AI 智能商标取名与品牌诠释平台', url: 'https://biao.yizigpt.com/' },
  { name: '荔书', icon: '/lishu.png', desc: '随说随记+AI整理的灵感与待办管理工具', url: 'https://todo.yepaper.com' },
]

// 关于面板:由 HubPage 作为「关于」页签挂载(整页视图)
export function AboutPanel() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center text-center pt-1">
        <img src="/icon.png" alt="YiziVoice" className="w-[72px] h-[72px] rounded-2xl shadow-[var(--shadow-card)]" />
        <p className="mt-2.5 text-xs text-ink-3 tracking-wide">版本 v{__APP_VERSION__}</p>
      </div>

      <p className="text-sm text-ink-2 leading-relaxed">
        YiziVoice 诞生于一个简单的想法：让每个人都能轻松拥有自己的声音。我们相信，声音是有温度的——它承载着情感，传递着力量。基于 MiMo-V2.5-TTS
        系列大模型，让技术不再是障碍，让创意自由流淌。
      </p>

      <section>
        <h4 className="text-base font-semibold text-ink mb-3">产品特色</h4>
        <div className="grid grid-cols-4 gap-2.5">
          {FEATURES.map(f => (
            <div key={f.title} className={`mat-card p-3.5 ${f.tone === 'accent' ? '' : ''}`}>
              <f.icon size={16} className={f.tone === 'accent' ? 'text-accent mb-2' : 'text-accent-2-text mb-2'} />
              <h5 className="text-base font-semibold text-ink mb-0.5">{f.title}</h5>
              <p className="text-xs text-ink-3">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h4 className="text-base font-semibold text-ink mb-3">官方网站</h4>
        {/* 与其他产品同为两列栅格(gap 一致),保证上下两个区块的卡片左右边缘对齐 */}
        <div className="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={() => openExternalLink('https://voice.yizigpt.com')}
            className="mat-card w-full text-left p-3 flex items-center gap-3 cursor-pointer hover:bg-surface-hover transition-colors group"
          >
            <img src="/icon.png" alt="YiziVoice" className="w-9 h-9 rounded-sm shrink-0" />
            <div className="flex-1 min-w-0">
              <h5 className="text-base font-semibold text-ink">YiziVoice官网</h5>
              <p className="text-xs text-ink-3">最新版本、使用帮助与产品动态</p>
            </div>
            <ArrowRight size={16} className="text-ink-3 group-hover:text-accent transition-colors shrink-0" />
          </button>
        </div>
      </section>

      <section>
        <h4 className="text-base font-semibold text-ink mb-3">我们的其他产品</h4>
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
                <p className="text-xs text-ink-3">{p.desc}</p>
              </div>
              <ArrowRight size={16} className="text-ink-3 group-hover:text-accent transition-colors shrink-0" />
            </button>
          ))}
        </div>
      </section>

      <div className="text-center">
        <p className="text-xs text-ink-3">为冰冷的文字，赋予有温度的声音</p>
      </div>
    </div>
  )
}
