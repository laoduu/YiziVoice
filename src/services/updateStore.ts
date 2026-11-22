/**
 * 在线更新的状态机（界面唯一数据源）。
 *
 * 分两层：
 * - updateClient.ts  和插件 / 后端打交道（能不能更新、检查、下载安装）
 * - 本文件            现在处于什么状态、该不该打扰用户、跳过过哪个版本
 *
 * 扰民原则：自动检查只在真的有新版本且没被跳过时留下痕迹；
 * 失败与「已是最新」不出声；只有用户主动点「检查更新」才把失败原因显示出来。
 *
 * 不用 zustand：本仓库无该依赖，用模块级 store + useSyncExternalStore（React 18 内置）。
 */
import { useSyncExternalStore } from 'react'
import {
  checkForUpdate,
  checkManualUpdate,
  getCurrentVersion,
  getUpdateBlocker,
  installUpdate,
  isManualUpdateChannel,
  type AvailableUpdate,
  type ManualUpdateInfo,
  type UpdateBlocker,
} from './updateClient'
import { decideUpdate, type UpdateDecision } from './update'

export type UpdateStatus =
  | 'idle'
  | 'checking'
  | 'latest'
  | 'available'
  | 'skipped'
  | 'downloading'
  | 'installed'
  | 'error'

export interface UpdateState {
  status: UpdateStatus
  blocker: UpdateBlocker | null
  update: (AvailableUpdate | (ManualUpdateInfo & { currentVersion: string; mode: 'manual' })) | null
  downloaded: number
  total: number | null
  error: string | null
  /** 失败在哪一步：「检查失败」与「更新装不上」对用户是两件事 */
  errorPhase: 'check' | 'install' | null
}

const initialState: UpdateState = {
  status: 'idle',
  blocker: null,
  update: null,
  downloaded: 0,
  total: null,
  error: null,
  errorPhase: null,
}

let state: UpdateState = { ...initialState }
const listeners = new Set<() => void>()

const setState = (patch: Partial<UpdateState>) => {
  state = { ...state, ...patch }
  listeners.forEach(fn => fn())
}

const subscribe = (fn: () => void): (() => void) => {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

const getState = (): UpdateState => state

/** React 组件订阅状态快照 */
export const useUpdateState = (): UpdateState =>
  useSyncExternalStore(subscribe, getState, getState)

const SKIPPED_KEY = 'yizivoice_skipped_update'

const readSkipped = (): string | null => {
  try {
    return localStorage.getItem(SKIPPED_KEY)
  } catch {
    return null
  }
}

const writeSkipped = (version: string | null) => {
  try {
    if (version) localStorage.setItem(SKIPPED_KEY, version)
    else localStorage.removeItem(SKIPPED_KEY)
  } catch {
    /* ignore */
  }
}

const errorText = (e: unknown): string => {
  const msg = e instanceof Error ? e.message : String(e)
  return msg && msg !== 'undefined' ? msg : 'unknown error'
}

/**
 * 检查更新。`manual` = 用户主动点的：失败要留在界面上；自动检查失败静默回 idle。
 */
export const checkUpdate = async (manual: boolean): Promise<void> => {
  const { status } = getState()
  // 正在下载/安装时不打扰插件：check 会先释放上一次的资源
  if (status === 'checking' || status === 'downloading' || status === 'installed') return

  setState({ status: 'checking', error: null, errorPhase: null })

  const blocker = await getUpdateBlocker()
  setState({ blocker })

  // 不能自动装也查不了的（dev / 浏览器）：不到网络上问，不留提示
  const manualChannel = isManualUpdateChannel(blocker)
  if (blocker && !manualChannel) {
    setState({ status: 'idle', update: null })
    return
  }

  const skipped = readSkipped()
  try {
    if (manualChannel) {
      const info = await checkManualUpdate()
      const currentVersion = getCurrentVersion()
      const decision: UpdateDecision = decideUpdate(info.version, currentVersion, skipped)
      if (decision === 'latest') {
        setState({ status: 'latest', update: null })
        return
      }
      setState({
        update: { ...info, currentVersion, mode: 'manual' },
        status: decision,
      })
      return
    }
    const found = await checkForUpdate()
    if (!found) {
      setState({ status: 'latest', update: null })
      return
    }
    const decision = decideUpdate(found.version, found.currentVersion, skipped)
    if (decision === 'latest') {
      setState({ status: 'latest', update: null })
      return
    }
    setState({ update: found, status: decision })
  } catch (e) {
    setState({
      status: manual ? 'error' : 'idle',
      error: errorText(e),
      errorPhase: 'check',
    })
  }
}

/** 启动后自动检查一次（只在环境允许时；失败静默） */
export const checkOnStartup = async (): Promise<void> => {
  if (getState().status !== 'idle') return
  await checkUpdate(false)
}

/** 下载并安装（仅自动通道）。进度写入 state 供进度条订阅。 */
export const installUpdateAction = async (): Promise<void> => {
  const { update } = getState()
  if (!update || update.mode === 'manual') return
  setState({ status: 'downloading', downloaded: 0, total: null, error: null, errorPhase: null })
  try {
    await installUpdate((downloaded, total) => setState({ downloaded, total }))
    setState({ status: 'installed' })
  } catch (e) {
    setState({ status: 'error', error: errorText(e), errorPhase: 'install' })
  }
}

/** 手动通道：打开对应版本的 Release 页 */
export const openDownloadPage = (): void => {
  const version = getState().update?.version
  const url = version
    ? `https://github.com/laoduu/YiziVoice/releases/tag/v${version.replace(/^v/i, '')}`
    : 'https://github.com/laoduu/YiziVoice/releases/latest'
  const api = (window as any).desktopAPI
  if (api?.openExternalLink) api.openExternalLink(url)
  else window.open(url, '_blank')
}

/** 跳过这个版本：之后不再提示它（别的版本照常）。有意不释放插件句柄。 */
export const skipUpdate = (): void => {
  const version = getState().update?.version
  if (version) writeSkipped(version)
  setState({ status: 'skipped' })
}
