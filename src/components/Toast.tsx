import { useState, useEffect, useCallback, createContext, useContext } from 'react'
import { CircleAlert, CheckCircle2, Info } from 'lucide-react'

interface ToastItem {
  id: number
  message: string
  type: 'error' | 'success' | 'info'
}

interface ToastContextType {
  showToast: (message: string, type?: ToastItem['type']) => void
}

const ToastContext = createContext<ToastContextType>({ showToast: () => {} })

export function useToast() {
  return useContext(ToastContext)
}

const ICONS = {
  error: CircleAlert,
  success: CheckCircle2,
  info: Info,
} as const

const ICON_CLS = {
  error: 'text-danger-text',
  success: 'text-success-text',
  info: 'text-accent',
} as const

// 顶部居中轻量胶囊通知(M3 材质),替代旧渐变大块
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const showToast = useCallback((message: string, type: ToastItem['type'] = 'error') => {
    const id = Date.now() + Math.random()
    setToasts(prev => [...prev.slice(-3), { id, message, type }])
  }, [])

  useEffect(() => {
    if (toasts.length === 0) return
    const timer = setTimeout(() => {
      setToasts(prev => prev.slice(1))
    }, 3200)
    return () => clearTimeout(timer)
  }, [toasts])

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed top-12 left-1/2 -translate-x-1/2 z-[95] flex flex-col items-center gap-2 pointer-events-none">
        {toasts.map(toast => {
          const Icon = ICONS[toast.type]
          return (
            <div
              key={toast.id}
              className="mat-overlay pointer-events-auto pl-3.5 pr-4 py-2.5 shadow-overlay animate-slide-down flex items-center gap-2.5 max-w-[420px]"
            >
              <Icon size={14} className={`shrink-0 ${ICON_CLS[toast.type]}`} />
              <span className="text-sm font-medium text-ink">{toast.message}</span>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}
