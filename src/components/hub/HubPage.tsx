import { useEffect, useRef } from 'react'
import { Settings, BookOpen, Info, ArrowLeft } from 'lucide-react'
import { Segmented } from '../ui/Segmented'
import { SettingsPanel } from './SettingsPanel'
import { TutorialPanel } from './TutorialPanel'
import { AboutPanel } from './AboutPanel'

export type HubTab = 'settings' | 'tutorial' | 'about'

const TABS = [
  { key: 'settings' as const, label: '设置', icon: Settings, desc: '接口密钥、AI 文本模型与数据存储位置' },
  { key: 'tutorial' as const, label: '教程', icon: BookOpen, desc: '从配置到生成，一步步上手' },
  { key: 'about' as const, label: '关于', icon: Info, desc: '版本信息与我们的其他产品' },
]

interface Props {
  tab: HubTab
  onTabChange: (t: HubTab) => void
  onBack: () => void
}

// 设置中心:整页视图(原窗口跳页),不再是弹窗。
//
// 为什么不做弹窗(实测 1280x1000):三个页签内容高 371 / 888 / 740,相差 517px(最矮的 139%)。
// 弹窗按内容自适应会让框高在 485 <-> 759 之间跳 274px;而统一高度必然二选一地难看——
// 取最高则设置页空出 274px(占 36%),取最矮则教程要多滚 517px。
// 整页视图的框高恒等于视口,跳动在结构上消失(教程只溢出 32px,其余两个都装得下)。
//
// 受控页签:由 App 持有(关闭态为 null),入口(Ctrl+, / 标题栏齿轮)可直接指定落在哪个页签,
// 不需要 open→tab 的同步 effect(StrictMode 挂载期 effect 会跑两次,AGENTS.md 有踩坑记录)
export function HubPage({ tab, onTabChange, onBack }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const active = TABS.find(t => t.key === tab) ?? TABS[0]

  // 切页签回到顶部:三个面板共用一个滚动容器,不重置会继承上一页的滚动位置
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 })
  }, [tab])

  return (
    <div className="mat-panel h-full flex flex-col mat-clip">
      {/* 页头:页签居中(与下方内容同一条中心轴——内容也是 mx-auto 居中),
          返回按钮绝对定位固定右上角,不参与居中,否则会把页签挤偏。
          页签说明从横向改为纵向居中排布,避免它把「页签整体」的中心带偏 */}
      <div className="shrink-0 relative px-5 py-3 border-b border-line">
        <button
          type="button"
          onClick={onBack}
          title="返回 (Esc)"
          className="absolute right-5 top-1/2 -translate-y-1/2 inline-flex items-center gap-1.5 h-7 px-2.5 rounded-sm text-sm text-ink-2 hover:text-ink hover:bg-surface-hover cursor-pointer transition-colors"
        >
          <ArrowLeft size={14} />
          返回
        </button>

        <div className="flex flex-col items-center gap-1.5">
          {/* 页签用 nav 档(16px),必须不小于其内部的段落标题(heading 16px),
              否则「容器比内容还小」——这正是审计发现的层级倒置 */}
          <Segmented
            value={tab}
            onChange={onTabChange}
            size="lg"
            options={TABS.map(t => ({
              value: t.key,
              label: (
                <span className="inline-flex items-center gap-1.5">
                  <t.icon size={16} />
                  {t.label}
                </span>
              ),
            }))}
          />
          <p className="text-xs text-ink-3">{active.desc}</p>
        </div>
      </div>

      {/* 内容:三个面板常驻挂载,仅切换显隐——切页签不会丢失设置页的输入态(API Key、已选目录)。
          限宽居中:整页比原弹窗(720)宽,不限宽会让控件在宽窗口下拉伸得难读 */}
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto px-5 py-5">
        <div className="max-w-[880px] mx-auto">
          <div className={tab === 'settings' ? '' : 'hidden'}><SettingsPanel /></div>
          <div className={tab === 'tutorial' ? '' : 'hidden'}>
            <TutorialPanel onOpenSettings={() => onTabChange('settings')} />
          </div>
          <div className={tab === 'about' ? '' : 'hidden'}><AboutPanel /></div>
        </div>
      </div>
    </div>
  )
}
