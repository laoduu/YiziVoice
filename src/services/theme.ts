export type Theme = 'light' | 'dark'

const CACHE_KEY = 'yizivoice_theme'

// 同步读缓存先行应用,避免首帧闪烁;settings 文件中的持久值异步校正
export function cachedTheme(): Theme {
  try {
    const v = localStorage.getItem(CACHE_KEY)
    if (v === 'light' || v === 'dark') return v
  } catch { /* ignore */ }
  return 'light'
}

export function applyTheme(theme: Theme) {
  document.documentElement.setAttribute('data-theme', theme)
  try { localStorage.setItem(CACHE_KEY, theme) } catch { /* ignore */ }
}

export async function initThemeFromSettings() {
  applyTheme(cachedTheme())
  try {
    const api = (window as any).desktopAPI
    if (!api) return
    const settings = await api.settings.load()
    if (settings?.theme === 'light' || settings?.theme === 'dark') {
      if (settings.theme !== cachedTheme()) applyTheme(settings.theme)
    }
  } catch { /* settings 尚不可用时保持缓存值 */ }
}

export async function setTheme(theme: Theme) {
  applyTheme(theme)
  try {
    const api = (window as any).desktopAPI
    if (!api) return
    const settings = await api.settings.load()
    await api.settings.save({ ...settings, theme })
  } catch { /* 至少本地缓存已生效 */ }
}
