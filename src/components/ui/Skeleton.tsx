import type { CSSProperties } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Button } from './Button'

export function Skeleton({ className = '', style }: { className?: string; style?: CSSProperties }) {
  return <div className={`skeleton ${className}`} style={style} />
}

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  hint?: string
  action?: { label: string; onClick: () => void }
}

export function EmptyState({ icon: Icon, title, hint, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-14 text-center">
      <div className="w-12 h-12 rounded-full bg-surface-hover grid place-items-center mb-3">
        <Icon size={24} className="text-ink-3" />
      </div>
      <p className="text-sm font-medium text-ink-2">{title}</p>
      {hint && <p className="text-xs text-ink-3 mt-1">{hint}</p>}
      {action && (
        <Button variant="soft" size="sm" className="mt-4" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  )
}
