import type { ReactNode } from 'react'

interface TooltipProps {
  label: string
  children: ReactNode
  side?: 'top' | 'bottom'
  /** start:左对齐锚点(长文案靠左边缘时避免溢出容器) */
  align?: 'start' | 'center' | 'end'
  /** 只放非定位类(如 shrink-0)。定位由组件内部的 relative 负责,别在这里写 absolute。 */
  className?: string
}

// 轻量 CSS tooltip(hover 显示),用于 Rail/图标按钮
export function Tooltip({ label, children, side = 'top', align = 'center', className = '' }: TooltipProps) {
  return (
    <span className={`relative inline-flex group/tt ${className}`}>
      {children}
      <span
        role="tooltip"
        className={`pointer-events-none absolute whitespace-nowrap mat-overlay px-2 py-1 text-xs font-medium text-ink opacity-0 group-hover/tt:opacity-100 transition-opacity duration-100 z-[90] ${
          align === 'start' ? 'left-0' : align === 'end' ? 'right-0' : 'left-1/2 -translate-x-1/2'
        } ${
          side === 'top' ? 'bottom-full mb-1.5' : 'top-full mt-1.5'
        }`}
      >
        {label}
      </span>
    </span>
  )
}
