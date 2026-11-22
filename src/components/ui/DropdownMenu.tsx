import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { ChevronDown } from 'lucide-react'
import { Tooltip } from './Tooltip'

export interface MenuItem {
  key: string
  label: ReactNode
  icon?: LucideIcon
  danger?: boolean
}

interface DropdownMenuProps {
  /** Omit for an icon-only trigger (kebab): see the chevron rule below. */
  label?: ReactNode
  icon?: LucideIcon
  items: MenuItem[]
  onSelect: (key: string) => void
  align?: 'start' | 'end'
  menuWidth?: number
  variant?: 'secondary' | 'ghost'
  /** Hover copy for an icon-only trigger (§5.9-1). Doubles as its aria-label. */
  tooltip?: string
  /** Caption above the items, for a menu whose items are a bare list that needs naming
      (the voice card's "move this voice to a category"). Not focusable, not selectable.
      12px is legal here because a caption is not a control's own label (§5.12-12). */
  heading?: string
}

// M3 下拉菜单,替代原生 select / 自制浮层;外点与 Esc 关闭
//
// v2.1: an icon-only trigger renders NO chevron and drops to the 24px square icon
// button (§5.8 rule 3 -> 12px icon). The chevron means "this opens a menu" *next to a
// text label* which it can point at; without a label it is a second glyph doing the same
// job, and it made one control read as two parts. Same-token rule: both kebab call sites
// (history header, voice-library card) now share one trigger geometry.
export function DropdownMenu({
  label,
  icon: Icon,
  items,
  onSelect,
  align = 'start',
  menuWidth,
  variant = 'secondary',
  tooltip,
  heading,
}: DropdownMenuProps) {
  const [open, setOpen] = useState(false)
  // v2.1: a trigger near the bottom of the viewport (the voice card's action band)
  // would otherwise open straight into the scroll container's clip. One generous
  // estimate at open time decides the direction; measuring the mounted panel instead
  // would cost a second render pass for no visible gain.
  const [dropUp, setDropUp] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  const toggle = () => {
    if (!open) {
      const rect = rootRef.current?.getBoundingClientRect()
      const estimated = items.length * 32 + 12
      setDropUp(!!rect && rect.bottom + 6 + estimated > window.innerHeight - 8)
    }
    setOpen(v => !v)
  }

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const hasLabel = label !== undefined && label !== null && label !== ''

  const triggerCls =
    variant === 'ghost'
      ? 'text-ink-2 hover:bg-surface-hover hover:text-ink'
      : 'bg-surface-2 border border-line text-ink hover:bg-surface-hover'

  // Icon-only triggers are icon buttons, so rule 3 (not rule 1) sizes them.
  const triggerLayout = hasLabel
    ? 'inline-flex items-center gap-1.5 h-[34px] px-3.5 text-sm'
    : 'grid place-items-center w-6 h-6'

  const trigger = (
    <button
      type="button"
      aria-label={hasLabel ? undefined : tooltip}
      onClick={toggle}
      className={`${triggerLayout} rounded-sm font-medium cursor-pointer transition-all duration-100 ease-out select-none ${triggerCls} ${
        open ? 'bg-surface-hover text-ink' : ''
      }`}
    >
      {Icon && (hasLabel ? <Icon size={14} /> : <Icon size={12} />)}
      {label}
      {hasLabel && <ChevronDown size={14} className={`transition-transform duration-100 ${open ? 'rotate-180' : ''}`} />}
    </button>
  )

  return (
    <div ref={rootRef} className="relative">
      {tooltip ? <Tooltip label={tooltip} align={align === 'end' ? 'end' : 'start'}>{trigger}</Tooltip> : trigger}

      {open && (
        <div
          role="menu"
          className={`mat-overlay absolute z-[80] py-1.5 min-w-[168px] animate-pop-in ${
            dropUp ? 'bottom-full mb-1.5' : 'top-full mt-1.5'
          } ${align === 'end' ? 'right-0' : 'left-0'}`}
          style={menuWidth ? { width: menuWidth } : undefined}
        >
          {heading && (
            <p role="presentation" className="px-3 pt-0.5 pb-1.5 text-xs text-ink-3 truncate">
              {heading}
            </p>
          )}
          {items.map(item => (
            <button
              key={item.key}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false)
                onSelect(item.key)
              }}
              className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm cursor-pointer transition-colors duration-75 text-left ${
                item.danger ? 'text-danger-text hover:bg-danger-soft' : 'text-ink hover:bg-surface-hover'
              }`}
            >
              {item.icon && <item.icon size={14} className="shrink-0 opacity-70" />}
              <span className="truncate">{item.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
