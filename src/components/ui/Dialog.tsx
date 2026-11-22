import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { useI18n } from '../../i18n/react'
import { Tooltip } from './Tooltip'

interface DialogProps {
  open: boolean
  onClose: () => void
  title?: ReactNode
  subtitle?: ReactNode
  children?: ReactNode
  footer?: ReactNode
  width?: number
}

// M3 弹窗:backdrop + 居中面板;Esc 关闭
// 注:原先为设置中心加过 header(自定义头部)入口,设置中心改为整页视图后已移除
export function Dialog({ open, onClose, title, subtitle, children, footer, width = 480 }: DialogProps) {
  const { t: tr } = useI18n()
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  // Portalled to <body> on purpose, and this is not cosmetic.
  //
  // `backdrop-filter` (like `filter`) makes the element a containing block for
  // `position: fixed` descendants. Every `.mat-panel` and `.mat-overlay` in this app
  // has one, and Dialogs are rendered inside those panels (App's left sidebar,
  // VoiceClone's aside). So `fixed inset-0` did NOT mean the viewport there - it
  // resolved against the panel's own box, and the modal centred itself inside the
  // sidebar instead of over the whole window. Reported by the owner for the history
  // delete dialog; it silently affected all five Dialog call sites.
  //
  // Do not "simplify" this back into an inline fragment. If a future dialog has to
  // live in the tree, it needs a positioning scheme other than `fixed`.
  return createPortal(
    <>
      <div className="fixed inset-0 z-[70] bg-black/35 animate-fade-in" style={{ backdropFilter: 'blur(2px)' }} onClick={onClose} />
      {/* grid 居中容器:避免 translate 与入场动画的 transform 冲突(否则弹窗会从偏移位置跳入) */}
      <div className="fixed inset-0 z-[71] grid place-items-center p-4 pointer-events-none">
        <div
          role="dialog"
          aria-modal="true"
          className="mat-overlay pointer-events-auto relative p-6 animate-pop-in flex flex-col w-full"
          style={{ maxWidth: width, maxHeight: '84vh' }}
        >
        {/* Tooltip 的 wrapper 自己就是定位锚点,所以把 absolute 放在外层 div 上,
            不要放到 button 上 —— 否则 button 会相对 wrapper 定位,wrapper 尺寸为 0 会跑位 */}
        <div className="absolute top-4 right-4">
          <Tooltip label={tr('common.close')} align="end">
            <button
              type="button"
              aria-label={tr('common.close')}
              onClick={onClose}
              className="w-7 h-7 rounded-sm grid place-items-center text-ink-3 hover:bg-surface-hover hover:text-ink cursor-pointer transition-colors"
            >
              <X size={16} />
            </button>
          </Tooltip>
        </div>

        {(title || subtitle) && (
          <div className="mb-5 pr-8">
            {title && <h3 className="text-xl font-semibold text-ink tracking-[-0.01em]">{title}</h3>}
            {subtitle && <p className="text-sm text-ink-2 mt-1">{subtitle}</p>}
          </div>
        )}

        <div className="flex-1 overflow-y-auto min-h-0">{children}</div>

        {footer && <div className="flex justify-end gap-2.5 pt-5 mt-1">{footer}</div>}
        </div>
      </div>
    </>,
    document.body,
  )
}
