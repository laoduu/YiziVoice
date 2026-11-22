import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes } from 'react'

const baseField =
  'w-full bg-surface-2 border border-line rounded-sm text-sm text-ink placeholder:text-ink-3 outline-none transition-all duration-100 ease-out focus:border-accent focus:shadow-[0_0_0_3px_var(--accent-soft)]'

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className = '', ...rest }, ref) {
    return <input ref={ref} className={`${baseField} h-[34px] px-3 ${className}`} {...rest} />
  },
)

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className = '', ...rest }, ref) {
    return (
      <textarea
        ref={ref}
        className={`${baseField} rounded-md p-3.5 text-sm leading-relaxed resize-y ${className}`}
        {...rest}
      />
    )
  },
)
