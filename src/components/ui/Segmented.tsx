import type { ReactNode } from 'react'

export interface SegmentedOption<T extends string> {
  value: T
  label: ReactNode
}

interface SegmentedProps<T extends string> {
  options: SegmentedOption<T>[]
  value: T
  onChange: (value: T) => void
  full?: boolean
  size?: 'sm' | 'md' | 'lg'
}

// 分段控件(工具切换/来源切换),active 用浮起面板表达
export function Segmented<T extends string>({ options, value, onChange, full, size = 'md' }: SegmentedProps<T>) {
  // v4: sm and md share the body role (text-sm); they differ by padding only.
  // `lg` is the page-level tab role (nav = text-base) and is used by the settings hub.
  const pad = size === 'sm' ? 'p-[3px]' : 'p-1'
  const itemCls =
    size === 'lg'
      ? 'px-4 py-1.5 text-base rounded-sm'
      : size === 'sm'
        ? 'px-2.5 py-1 text-sm rounded-sm'
        : 'px-4 py-1.5 text-sm rounded-sm'
  return (
    <div className={`inline-flex ${pad} rounded-md bg-surface-hover border border-line ${full ? 'w-full' : ''}`}>
      {options.map(opt => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`${itemCls} font-medium transition-all duration-100 ease-out cursor-pointer whitespace-nowrap ${
            full ? 'flex-1' : ''
          } ${
            value === opt.value
              ? 'bg-surface-3 text-ink shadow-xs'
              : 'text-ink-2 hover:text-ink'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}
