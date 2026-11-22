import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { Loader2 } from 'lucide-react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'soft'
type Size = 'sm' | 'md' | 'lg'

// v4: every size uses the body role (text-sm, 14px) and the control radius.
// Sizes differ by height and padding only - button text no longer varies.
const sizeCls: Record<Size, string> = {
  sm: 'h-7 px-2.5 text-sm gap-1 rounded-sm',
  md: 'h-[34px] px-3.5 text-sm gap-1.5 rounded-sm',
  lg: 'h-[42px] px-5 text-sm gap-2 rounded-sm',
}

const variantCls: Record<Variant, string> = {
  primary: 'bg-accent-strong text-accent-on hover:bg-accent-hover shadow-xs disabled:hover:bg-accent-strong',
  secondary: 'bg-surface-2 border border-line text-ink hover:bg-surface-hover',
  ghost: 'text-ink-2 hover:bg-surface-hover hover:text-ink',
  danger: 'bg-danger text-white hover:brightness-110',
  soft: 'bg-accent-soft text-accent hover:bg-accent-soft hover:brightness-105',
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
  icon?: ReactNode
  full?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', loading, icon, full, className = '', children, disabled, ...rest },
  ref,
) {
  const isDisabled = disabled || loading
  return (
    <button
      ref={ref}
      disabled={isDisabled}
      className={`inline-flex items-center justify-center font-medium select-none whitespace-nowrap transition-all duration-100 ease-out cursor-pointer ${sizeCls[size]} ${variantCls[variant]} ${
        full ? 'w-full' : ''
      } ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
      {...rest}
    >
      {/* v4: every Button variant labels at body(14px), so per icon rule 1 the icon is 14px
          too. The old `size === 'sm' ? 13 : 15` put both branches off-tier. */}
      {loading ? <Loader2 size={14} className="animate-spin" /> : icon}
      {children}
    </button>
  )
})
