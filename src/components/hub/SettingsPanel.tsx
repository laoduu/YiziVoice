import { useState, useEffect, useRef, type ReactNode } from 'react'
import { Check, ExternalLink, FolderOpen, HelpCircle, RotateCcw, ShieldCheck } from 'lucide-react'
import { Button } from '../ui/Button'
import { Dialog } from '../ui/Dialog'
import { Input } from '../ui/Input'
import { Tooltip } from '../ui/Tooltip'
import { useToast } from '../Toast'
import {
  clearClient, DEFAULT_TEXT_MODEL, getApiErrorMessage, initClient, listAiModels,
  MIMO_BASE_URL, verifyApiKey, type AiModelInfo,
} from '../../services/mimoApi'
import { loadApiKey, loadAppSettings, saveAppSettings } from '../../services/configService'
import { cachedTheme } from '../../services/theme'
import { useI18n } from '../../i18n/react'
import { LANGUAGES, type Lang } from '../../i18n/core'
import { Segmented } from '../ui/Segmented'

const REGISTER_URL = 'https://platform.xiaomimimo.com?ref=DHLC96'
const INVITE_CODE = 'DHLC96'

function openExternalLink(url: string) {
  if ((window as any).desktopAPI?.openExternalLink) {
    (window as any).desktopAPI.openExternalLink(url)
  } else {
    window.open(url, '_blank')
  }
}

function CopyButton({ text }: { text: string }) {
  const { t: tr } = useI18n()
  return (
    <button
      type="button"
      onClick={() => navigator.clipboard.writeText(text)}
      className="text-sm font-medium px-2 py-0.5 rounded-sm border border-line text-accent hover:bg-surface-hover cursor-pointer transition-colors"
    >
      {tr('common.copy')}
    </button>
  )
}

// 段落标题:设置中心内所有段落标题统一走 heading 档(16px)。
// 与教程/关于同值——审计发现这三页原为 11/15/11px 三种取值
// 必须定义在模块作用域——定义在组件内部会导致每次渲染都是新的组件类型,子树被卸载重建
function SectionTitle({ children }: { children: string }) {
  return <h4 className="text-base font-semibold text-ink mb-3">{children}</h4>
}

// 辅助说明:caption 档(12px)。text-3 提亮后达 4.55:1,满足 AA
function Hint({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <p className={`text-xs text-ink-3 ${className}`}>{children}</p>
}

interface DataDirInfo {
  current: string
  default: string
  isCustom: boolean
}

// 设置面板:由 HubPage 作为「设置」页签挂载(整页视图)。
// 三个页签常驻挂载(非按需渲染),因此切页签不会丢失这里的输入态;
// 关闭设置中心(HubPage 整棵卸载)后再打开,本 effect 会重新加载设置。
//
// 版式约定(与同页的教程/关于页签对齐):
//   - 段落之间只用 spacing(space-y-6)分隔,不用分隔线;规范 §8 一致性优先
//   - 每段结构固定为 [SectionTitle] → [主内容] → [mat-card 信息块(可选)] → [Hint 辅助说明]
//   - 全页仅「保存 API Key」一个实心主按钮(规范 §7:每视图仅 1 个主 CTA)
//   - 主题不在此设置:标题栏已有更顶层的入口,放这里属重复
export function SettingsPanel() {
  const { t: tr, lang, setLang } = useI18n()
  const [apiKey, setApiKey] = useState('')
  const [keyConfigured, setKeyConfigured] = useState(false)
  const [textModel, setTextModel] = useState(DEFAULT_TEXT_MODEL)
  const [savedTextModel, setSavedTextModel] = useState(DEFAULT_TEXT_MODEL)
  const [aiModels, setAiModels] = useState<AiModelInfo[]>([])
  const [modelsOpen, setModelsOpen] = useState(false)
  const [modelsLoading, setModelsLoading] = useState(false)
  const modelsRef = useRef<HTMLDivElement>(null)
  const [verifyState, setVerifyState] = useState<'idle' | 'verified' | 'failed'>('idle')
  const [verifying, setVerifying] = useState(false)
  const [clearKeyOpen, setClearKeyOpen] = useState(false)
  const [dirInfo, setDirInfo] = useState<DataDirInfo | null>(null)
  const [selectedDir, setSelectedDir] = useState<string | null>(null)
  const [migrating, setMigrating] = useState(false)
  const [saving, setSaving] = useState(false)
  const verifySeq = useRef(0)
  const { showToast } = useToast()

  useEffect(() => {
    // The stored key is never loaded into the form: only its presence is read
    // back, plus a one-off read for booting the API client.
    Promise.all([loadAppSettings(), loadApiKey()])
      .then(([s, key]) => {
        setKeyConfigured(!!s.api.apiKeyConfigured)
        const model = s.textModel?.trim() || DEFAULT_TEXT_MODEL
        setTextModel(model)
        setSavedTextModel(model)
        if (key) initClient({ apiKey: key })
      })
      .catch(() => { /* bridge not ready: saving in this panel will initialise the client */ })
    loadDataDirInfo()
  }, [])

  useEffect(() => {
    if (!modelsOpen) return
    const onDown = (e: MouseEvent) => {
      if (!modelsRef.current?.contains(e.target as Node)) setModelsOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setModelsOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [modelsOpen])

  const loadDataDirInfo = async () => {
    const api = (window as any).desktopAPI
    if (api?.storage?.getDataDir) setDirInfo(await api.storage.getDataDir())
  }

  const handleVerify = async () => {
    const draft = apiKey.trim()
    if (!draft) return
    const seq = ++verifySeq.current
    setVerifying(true)
    setVerifyState('idle')
    try {
      const ok = await verifyApiKey(draft)
      if (seq !== verifySeq.current) return
      setVerifyState(ok ? 'verified' : 'failed')
    } finally {
      if (seq === verifySeq.current) setVerifying(false)
    }
  }

  const handleFetchModels = async () => {
    setModelsLoading(true)
    try {
      const key = apiKey.trim() || await loadApiKey()
      const list = await listAiModels(key)
      setAiModels(list)
      setModelsOpen(true)
    } catch (e) {
      setModelsOpen(false)
      showToast(getApiErrorMessage(e) || tr('settings.fetchModelsFailed'), 'error')
    } finally {
      setModelsLoading(false)
    }
  }

  const persistTextModel = async (model: string) => {
    const next = model.trim()
    if (!next) {
      setTextModel(savedTextModel)
      return
    }
    const current = await loadAppSettings()
    const result = await saveAppSettings({ ...current, textModel: next, theme: cachedTheme() })
    setSavedTextModel(next)
    setTextModel(next)
    setModelsOpen(false)
    if (!result.success) {
      showToast(result.message || tr('settings.modelSavedKeyringFailed'), 'error')
      return
    }
    showToast(tr('settings.modelSaved'), 'success')
  }

  const handleSelectModel = (id: string) => {
    setTextModel(id)
    setModelsOpen(false)
    if (id !== savedTextModel) void persistTextModel(id)
  }

  const handleSave = async () => {
    const draft = apiKey.trim()
    if (!draft) return
    // Any in-flight verification now belongs to a draft that is being saved.
    verifySeq.current += 1
    setVerifying(false)
    setSaving(true)
    try {
      // settings_save 是整文件覆盖(不是 merge),必须带回现有字段,
      // 否则会抹掉 defaultVoice / defaultFormat 等本次界面没有暴露的配置
      const current = await loadAppSettings()
      const nextTextModel = textModel.trim() || savedTextModel
      const result = await saveAppSettings({
        ...current,
        api: { apiKey: draft, baseUrl: MIMO_BASE_URL },
        textModel: nextTextModel,
        theme: cachedTheme(),
      })
      setSavedTextModel(nextTextModel)
      setTextModel(nextTextModel)
      if (!result.success) {
        // Keep the draft so the user can retry; never leak it into settings.json.
        showToast(result.message || tr('settings.keySaveFailed'), 'error')
        return
      }
      initClient({ apiKey: draft })
      setApiKey('')
      setVerifyState('idle')
      setKeyConfigured(result.keyConfigured)
      showToast(tr('settings.keySaved'), 'success')
    } finally {
      setSaving(false)
    }
  }

  const handleClearKey = async () => {
    setClearKeyOpen(false)
    verifySeq.current += 1
    setSaving(true)
    try {
      const current = await loadAppSettings()
      const nextTextModel = textModel.trim() || savedTextModel
      const result = await saveAppSettings({
        ...current,
        api: { apiKey: '', baseUrl: MIMO_BASE_URL, clearApiKey: true },
        textModel: nextTextModel,
        theme: cachedTheme(),
      })
      setSavedTextModel(nextTextModel)
      setTextModel(nextTextModel)
      if (!result.success) {
        showToast(result.message || tr('settings.keyClearFailed'), 'error')
        return
      }
      clearClient()
      setApiKey('')
      setVerifyState('idle')
      setVerifying(false)
      setKeyConfigured(false)
      showToast(tr('settings.keyCleared'), 'success')
    } finally {
      setSaving(false)
    }
  }

  const handleSelectDir = async () => {
    const api = (window as any).desktopAPI
    if (!api?.storage?.selectDir) return
    const dir = await api.storage.selectDir()
    if (dir) setSelectedDir(dir)
  }

  const handleMigrate = async () => {
    if (!selectedDir) return
    const api = (window as any).desktopAPI
    if (!api?.storage?.migrateData) return
    setMigrating(true)
    try {
      const result = await api.storage.migrateData(selectedDir)
      if (result.success) {
        showToast(tr('settings.migrateDone'), 'success')
        setSelectedDir(null)
        await loadDataDirInfo()
      } else {
        showToast(result.message || tr('settings.migrateFailed'))
      }
    } catch (e: any) {
      showToast(tr('settings.migrateFailedWith', { message: e.message || tr('settings.unknownError') }))
    } finally {
      setMigrating(false)
    }
  }

  const handleResetDir = async () => {
    const api = (window as any).desktopAPI
    if (!api?.storage?.resetDataDir) return
    await api.storage.resetDataDir()
    showToast(tr('settings.dirResetDone'), 'info')
    setSelectedDir(null)
    await loadDataDirInfo()
  }

  const statusLabel =
    verifyState === 'verified' ? tr('settings.verifyOk')
    : verifyState === 'failed' ? tr('settings.verifyFailed')
    : keyConfigured ? tr('settings.keyConfigured')
    : tr('settings.keyNotConfigured')
  const statusTone =
    verifyState === 'verified' ? 'text-accent'
    : verifyState === 'failed' ? 'text-danger-text'
    : keyConfigured ? 'text-success-text'
    : 'text-warning-text'

  return (
    <div className="space-y-6">
      {/* 语言:界面显示语言,即时生效并持久化(settings.lang + localStorage) */}
      <section>
        <SectionTitle>{tr('settings.language')}</SectionTitle>
        <div className="flex items-center gap-3">
          <Segmented
            size="sm"
            options={LANGUAGES.map(l => ({ value: l.value, label: l.label }))}
            value={lang}
            onChange={v => setLang(v as Lang)}
          />
          <Hint>{tr('settings.languageHint')}</Hint>
        </div>
      </section>

      {/* 接口密钥:左右并列——左填 Key,右取 Key,两列同构(标题 + 输入框样式的控件 + 说明) */}
      <section>
        <SectionTitle>{tr('settings.apiKey')}</SectionTitle>

        <div className="grid grid-cols-2 gap-4 items-start">
          {/* 左列:填写 Key */}
          <div>
            <div className="flex items-center justify-between gap-2 h-5 mb-1.5">
              <span className="flex items-center gap-1.5">
                <label htmlFor="mimo-api-key" className="text-sm font-medium text-ink-2">MiMo API Key</label>
                {/* 加密说明收进 hover,不再占用版面 */}
                <Tooltip label={tr('settings.keyStorageHint')} align="start">
                  <span className="text-ink-3 inline-flex cursor-help" aria-label={tr('settings.keyStorageAria')}>
                    <ShieldCheck size={14} />
                  </span>
                </Tooltip>
              </span>
              <span className="flex items-center gap-2 shrink-0">
                <span aria-live="polite" className={`text-xs font-medium ${statusTone}`}>{statusLabel}</span>
                {keyConfigured && (
                  <button
                    type="button"
                    onClick={() => setClearKeyOpen(true)}
                    className="text-sm font-medium text-danger-text hover:underline cursor-pointer"
                  >
                    {tr('settings.clear')}
                  </button>
                )}
              </span>
            </div>

            <div className="relative">
              <Input
                id="mimo-api-key"
                type="text"
                placeholder={keyConfigured ? tr('settings.keyPlaceholderSaved') : 'sk-...'}
                value={apiKey}
                onChange={e => {
                  verifySeq.current += 1
                  setApiKey(e.target.value)
                  setVerifyState('idle')
                  setModelsOpen(false)
                }}
                className="pr-28"
                autoComplete="off"
              />
              {/* 放在输入框内部最右侧：验证在左、保存在右。已保存的 Key 从不进入这个
                  输入框，所以这里不存在「把已存 Key 显示出来」的路径。 */}
              <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
                <button
                  type="button"
                  onClick={handleVerify}
                  disabled={!apiKey.trim() || verifying || saving}
                  className="h-6 px-2 rounded-sm text-sm font-medium text-ink-2 hover:bg-surface-hover hover:text-ink disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
                >
                  {verifying ? tr('settings.verifying') : tr('settings.verify')}
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={!apiKey.trim() || saving || verifying}
                  className="h-6 px-2.5 rounded-sm text-sm font-medium bg-accent-strong text-accent-on hover:bg-accent-hover disabled:bg-surface-2 disabled:text-ink-3 disabled:hover:bg-surface-2 disabled:opacity-100 disabled:cursor-not-allowed cursor-pointer transition-colors"
                >
                  {tr('common.save')}
                </button>
              </div>
            </div>

            <div className="mt-4">
              <div className="flex items-center gap-1.5 mb-1.5">
                <label htmlFor="ai-text-model" className="text-sm font-medium text-ink-2">{tr('settings.textModel')}</label>
                <Tooltip label={tr('settings.textModelHint')} align="start">
                  <span className="text-ink-3 inline-flex cursor-help" aria-label={tr('settings.textModelAria')}>
                    <HelpCircle size={14} />
                  </span>
                </Tooltip>
              </div>

              <div ref={modelsRef} className="relative">
                <div className="flex items-center gap-2">
                  <Input
                    id="ai-text-model"
                    className="flex-1 min-w-0"
                    placeholder={DEFAULT_TEXT_MODEL}
                    value={textModel}
                    onChange={e => {
                      setTextModel(e.target.value)
                      setModelsOpen(false)
                    }}
                    onBlur={() => {
                      const next = textModel.trim()
                      if (!next) {
                        setTextModel(savedTextModel)
                      } else if (next !== savedTextModel) {
                        void persistTextModel(next)
                      }
                    }}
                    onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }}
                    autoComplete="off"
                  />
                  <Button variant="secondary" loading={modelsLoading} onClick={handleFetchModels}>
                    {tr('settings.fetchModels')}
                  </Button>
                </div>

                {modelsOpen && (
                  <div
                    role="menu"
                    className="mat-overlay absolute z-[80] top-full mt-1.5 left-0 right-0 py-1.5 max-h-64 overflow-y-auto animate-pop-in"
                  >
                    {aiModels.length === 0 ? (
                      <p className="px-3 py-2 text-sm text-ink-3">{tr('settings.noModels')}</p>
                    ) : aiModels.map(m => (
                      <button
                        key={m.id}
                        type="button"
                        role="menuitem"
                        onClick={() => handleSelectModel(m.id)}
                        className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-ink hover:bg-surface-hover cursor-pointer text-left transition-colors"
                      >
                        <span className="flex-1 truncate">{m.id}</span>
                        {textModel === m.id && <Check size={14} className="text-accent shrink-0" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <Hint className="mt-2">
                {tr('settings.pricingHint')}
              </Hint>
              <p className="text-xs font-medium text-accent mt-1">
                {tr('settings.modelSuggestion')}
              </p>
            </div>
          </div>

          {/* 右列:获取 Key */}
          <div>
            {/* 标签行固定 h-5:与左列标签行等高,保证两侧控件顶边严格对齐 */}
            <p className="flex items-center h-5 text-sm font-medium text-ink-2 mb-1.5">{tr('settings.noApiKeyYet')}</p>

            {/* 与左侧输入框同款同高,整块可点去注册 */}
            <button
              type="button"
              onClick={() => openExternalLink(REGISTER_URL)}
              title={tr('settings.openRegisterTitle')}
              className="w-full h-[34px] px-3 rounded-sm bg-surface-2 border border-line text-sm text-ink flex items-center gap-2 cursor-pointer transition-all duration-100 ease-out hover:border-accent hover:bg-surface-hover group"
            >
              <span className="flex-1 text-left truncate">platform.xiaomimimo.com</span>
              <ExternalLink size={14} className="text-ink-3 group-hover:text-accent transition-colors shrink-0" />
            </button>

            <div className="flex items-center gap-2 mt-2">
              <span className="text-sm text-ink-2">{tr('settings.inviteCode')}</span>
              <span className="font-mono text-sm font-semibold text-accent-2-text">{INVITE_CODE}</span>
              <CopyButton text={INVITE_CODE} />
            </div>
          </div>
        </div>
      </section>

      {/* 数据存储 */}
      <section>
        <SectionTitle>{tr('settings.dataStorage')}</SectionTitle>

        <div className="mat-card p-3">
          <div className="flex items-center justify-between gap-2 mb-1">
            <p className="text-xs text-ink-3">{tr('settings.currentDataDir')}</p>
            {dirInfo?.isCustom && (
              <span className="text-xs px-1.5 py-px rounded-full bg-accent-soft text-accent">{tr('settings.customDir')}</span>
            )}
          </div>
          <p className="text-sm text-ink break-all">{dirInfo?.current ?? tr('settings.dirLoading')}</p>
        </div>

        <div className="flex items-center gap-2 flex-wrap mt-3">
          <Button variant="secondary" size="sm" icon={<FolderOpen size={14} />} onClick={handleSelectDir}>
            {tr('settings.selectDir')}
          </Button>
          <Button variant="secondary" size="sm" loading={migrating} disabled={!selectedDir} onClick={handleMigrate}>
            {tr('settings.migrateToDir')}
          </Button>
          <Button variant="ghost" size="sm" icon={<RotateCcw size={14} />} onClick={handleResetDir}>
            {tr('settings.resetDir')}
          </Button>
        </div>

        <div className="mt-2 space-y-1">
          {selectedDir && dirInfo && selectedDir !== dirInfo.current && (
            <p className="text-xs text-accent break-all">{tr('settings.willMigrateTo', { dir: selectedDir })}</p>
          )}
          {dirInfo && !dirInfo.isCustom && (
            <Hint>{tr('settings.defaultDirHint')}</Hint>
          )}
        </div>
      </section>

      <Dialog
        open={clearKeyOpen}
        onClose={() => setClearKeyOpen(false)}
        title={tr('settings.clearKeyTitle')}
        subtitle={tr('settings.clearKeySubtitle')}
        width={360}
        footer={
          <>
            <Button variant="secondary" onClick={() => setClearKeyOpen(false)}>{tr('common.cancel')}</Button>
            <Button variant="danger" onClick={handleClearKey}>{tr('settings.clearKeyConfirm')}</Button>
          </>
        }
      />
    </div>
  )
}
