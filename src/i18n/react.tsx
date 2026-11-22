// React binding for the i18n core. Components use `useI18n()`; anything that
// needs translation outside React (services, error mappers) imports `t` from
// '../core' directly.
//
// Must live in a separate module from core.ts: a context cannot be created at
// module top-level in core.ts while services import `t` from it (React would
// then be pulled into non-component bundles).

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { cachedLang, getLang, setLang as setLangCore, subscribeLang, t, type Lang, type MessageKey, type MessageVars } from './core'

export type { Lang, MessageKey, MessageVars }

interface I18nContextValue {
  lang: Lang
  t: (key: MessageKey, vars?: MessageVars) => string
  setLang: (lang: Lang) => void
}

const I18nContext = createContext<I18nContextValue>({
  lang: 'zh-CN',
  t,
  setLang: () => {},
})

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => getLang() || cachedLang())

  useEffect(() => {
    // Re-render subtree when language changes (init already applied the value).
    return subscribeLang(setLangState)
  }, [])

  return (
    <I18nContext.Provider
      value={{
        lang,
        t,
        setLang: (l: Lang) => {
          void setLangCore(l)
        },
      }}
    >
      {children}
    </I18nContext.Provider>
  )
}

export function useI18n(): I18nContextValue {
  return useContext(I18nContext)
}
