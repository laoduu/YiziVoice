// i18n core — a tiny self-built localization layer (no runtime deps).
//
// Design (see AGENTS.md):
// - Keys are domain-scoped dotted strings, e.g. 'tts.generate'.
// - The zh-CN catalog is the key source of truth: `MessageKey = keyof typeof zhCN`.
//   The en catalog is typed `Record<MessageKey, string>` so a missing translation
//   is a compile error, not a silent fallback.
// - `t(key, vars?)` supports `{name}` interpolation.
// - Language persists to AppSettings.lang (Rust side passes JSON through) and is
//   cached in localStorage to avoid first-frame flash — same pattern as theme.ts.
//
// Non-component code (services, error mapping) may import `t` directly; it reads
// the module-level current language. React components should prefer `useI18n()`
// from './react' so they re-render on language change.

import { zhCN } from './locales/zh-CN'
import { en } from './locales/en'

export type Lang = 'zh-CN' | 'en'
export type MessageKey = keyof typeof zhCN
export type MessageVars = Record<string, string | number>

export const LANGUAGES: { value: Lang; label: string }[] = [
  { value: 'zh-CN', label: '简体中文' },
  { value: 'en', label: 'English' },
]

const CACHE_KEY = 'yizivoice_lang'

let currentLang: Lang = 'zh-CN'
const listeners = new Set<(lang: Lang) => void>()

function normalize(v: unknown): Lang | null {
  return v === 'zh-CN' || v === 'en' ? v : null
}

// Sync read for first frame; settings file value corrects it asynchronously.
export function cachedLang(): Lang {
  try {
    return normalize(localStorage.getItem(CACHE_KEY)) ?? 'zh-CN'
  } catch {
    return 'zh-CN'
  }
}

export function getLang(): Lang {
  return currentLang
}

export function applyLang(lang: Lang) {
  currentLang = lang
  document.documentElement.setAttribute('lang', lang === 'zh-CN' ? 'zh-Hans' : 'en')
  try {
    localStorage.setItem(CACHE_KEY, lang)
  } catch {
    /* ignore */
  }
  listeners.forEach(fn => fn(lang))
}

export function subscribeLang(fn: (lang: Lang) => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

// Load persisted language from settings (desktop bridge) and apply it.
export async function initLangFromSettings(): Promise<void> {
  applyLang(cachedLang())
  try {
    const api = (window as any).desktopAPI
    if (!api) return
    const settings = await api.settings.load()
    const lang = normalize(settings?.lang)
    if (lang && lang !== cachedLang()) applyLang(lang)
  } catch {
    /* settings unavailable — keep cached value */
  }
}

// Persist language: localStorage first (instant), settings file async (durable).
export async function setLang(lang: Lang): Promise<void> {
  applyLang(lang)
  try {
    const api = (window as any).desktopAPI
    if (!api) return
    const settings = await api.settings.load()
    await api.settings.save({ ...settings, lang })
  } catch {
    /* at least the cached value took effect */
  }
}

const zhCatalog: Record<string, string> = zhCN
const enCatalog: Record<string, string> = en
const CATALOGS: Record<Lang, Record<string, string>> = {
  'zh-CN': zhCatalog,
  en: enCatalog,
}

function interpolate(template: string, vars?: MessageVars): string {
  if (!vars) return template
  return template.replace(/\{(\w+)\}/g, (m, name: string) =>
    Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : m,
  )
}

/** Translate. Safe outside React (reads current language). */
export function t(key: MessageKey, vars?: MessageVars): string {
  const template =
    CATALOGS[currentLang][key as string] ?? (zhCN as Record<string, string>)[key as string] ?? (key as string)
  return interpolate(template, vars)
}
