import { useState } from 'react'
import { Minus, Square, X, Sun, Moon, Settings } from 'lucide-react'
import { cachedTheme, setTheme, type Theme } from '../services/theme'

// 渲染时读取(勿提升到模块顶层):桌面桥在 boot 中先于渲染注入
const hasWindowControls = () => !!(window as any).desktopAPI

// 全应用唯一品牌露出点:纯文字字标,克制化规则见 DESIGN.md §7
export function TitleBar({ onOpenSettings, settingsOpen = false }: { onOpenSettings: () => void; settingsOpen?: boolean }) {
  const [theme, setThemeState] = useState<Theme>(cachedTheme())

  const toggleTheme = () => {
    const next: Theme = theme === 'light' ? 'dark' : 'light'
    setThemeState(next)
    void setTheme(next)
  }

  return (
    <header className="titlebar" data-tauri-drag-region>
      <span data-tauri-drag-region className="text-sm font-semibold tracking-[-0.01em] text-ink pl-1 select-none">YiziVoice</span>

      <div className="flex items-center gap-1" data-tauri-drag-region>
        <button
          type="button"
          className="titlebar-btn"
          onClick={toggleTheme}
          aria-label={theme === 'light' ? '切换到暗色主题' : '切换到亮色主题'}
          title={theme === 'light' ? '暗色主题' : '亮色主题'}
        >
          {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
        </button>

        {/* 设置中心统一入口(设置/教程/关于三页签),紧邻主题切换。
            做成 toggle 并带选中态:设置中心是整页视图,需要让用户看得出当前正停在它上面 */}
        <button
          type="button"
          className={`titlebar-btn${settingsOpen ? ' active' : ''}`}
          onClick={onOpenSettings}
          aria-label={settingsOpen ? '关闭设置中心' : '设置中心'}
          aria-pressed={settingsOpen}
          title={settingsOpen ? '关闭设置中心 (Esc)' : '设置 (Ctrl+,)'}
        >
          <Settings size={16} />
        </button>

        {hasWindowControls() && (
          <>
            <div className="w-px h-4 bg-line mx-1" />
            <button className="titlebar-btn" onClick={() => (window as any).desktopAPI.minimize()} aria-label="最小化" title="最小化">
              <Minus size={16} />
            </button>
            <button className="titlebar-btn" onClick={() => (window as any).desktopAPI.maximize()} aria-label="最大化" title="最大化/还原">
              <Square size={16} />
            </button>
            <button className="titlebar-btn close" onClick={() => (window as any).desktopAPI.close()} aria-label="关闭" title="关闭">
              <X size={16} />
            </button>
          </>
        )}
      </div>
    </header>
  )
}
