import { X, Pencil } from 'lucide-react'
import type { ReactNode } from 'react'
import { Tooltip } from './Tooltip'

interface ChipProps {
  selected?: boolean
  onClick?: () => void
  onDelete?: () => void
  onEdit?: () => void
  children: ReactNode
  title?: string
}

// 胶囊选择器:全应用统一的选中样式(主色填充),不再按场景区分色调
export function Chip({ selected, onClick, onDelete, onEdit, children, title }: ChipProps) {
  const hasActions = !!(onDelete || onEdit)
  return (
    <span className="group/chip relative inline-flex">
      <button
        type="button"
        title={title}
        onClick={onClick}
        className={`pl-3 h-7 rounded-full text-sm font-medium border transition-all duration-100 ease-out cursor-pointer whitespace-nowrap ${
          selected ? 'bg-accent-strong text-accent-on border-transparent' : 'bg-surface-hover text-ink border-line hover:bg-surface-active'
        } ${hasActions ? 'pr-3 group-hover/chip:pr-12' : 'pr-3'}`}
      >
        {children}
      </button>
      {onEdit && (
        // 定位交给外层 span:Tooltip 的 wrapper 自带 relative,放在按钮上会丢失定位基准
        <span className="absolute -top-1 right-5 hidden group-hover/chip:flex">
          <Tooltip label="修改">
            <button
              type="button"
              aria-label="修改"
              onClick={e => {
                e.stopPropagation()
                onEdit()
              }}
              className="w-4 h-4 rounded-full bg-accent text-accent-on grid place-items-center cursor-pointer"
            >
              <Pencil size={12} strokeWidth={2.5} />
            </button>
          </Tooltip>
        </span>
      )}
      {onDelete && (
        <span className="absolute -top-1 right-1 hidden group-hover/chip:flex">
          <Tooltip label="删除">
            <button
              type="button"
              aria-label="删除"
              onClick={e => {
                e.stopPropagation()
                onDelete()
              }}
              className="w-4 h-4 rounded-full bg-danger text-white grid place-items-center cursor-pointer"
            >
              <X size={12} strokeWidth={2.5} />
            </button>
          </Tooltip>
        </span>
      )}
    </span>
  )
}
