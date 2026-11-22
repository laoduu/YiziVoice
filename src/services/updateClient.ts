/**
 * 在线更新的运行时外壳：把 tauri-plugin-updater 与后端环境 / 安装形态判定收到一处。
 *
 * 分层（与 YiziMarkdown 同构）：
 * - update.ts        纯逻辑（版本比较、要不要提示）——可 review、无 IO
 * - 本文件            和插件 / 后端打交道（能不能更新、检查、下载安装）
 * - updateStore      状态机（现在处于什么状态、跳过过哪个版本）
 *
 * 「能不能自动更新」取决于运行环境，判断散在界面各处迟早漏拦：
 * 开发模式 / 浏览器 / 非 Windows / 非 NSIS 安装 —— 一律走手动通道（提示去 Releases 下载）。
 * 这条路上失败必须保守：少提示一次更新没有代价，装坏一次代价很大。
 */
import { check as checkPlugin, type Update } from '@tauri-apps/plugin-updater'
import { getBridge } from './configService'
import { normalizeVersion } from './update'

/** 安装形态。取值与 cmds/update.rs 的 get_install_kind 一一对应 */
export type InstallKind = 'nsis' | 'other'

/** 不能自动更新的原因；null = 可以 */
export type UpdateBlocker =
  | 'dev'
  | 'not-tauri'
  /** 非 Windows：清单只有 Windows 资源，dmg/deb 手动装 */
  | 'not-windows'
  /** 非 NSIS 安装（便携副本 / 探测不出）：覆盖不了自己 */
  | 'not-nsis'

/**
 * 装不了但查得到的通道（macOS / Linux / 便携版）：
 * 仍去读清单，有新版本就提示手动下载，而不是直接闭嘴。
 */
export type ManualUpdateBlocker = 'not-windows' | 'not-nsis'

export const isManualUpdateChannel = (blocker: UpdateBlocker | null | undefined): boolean =>
  blocker === 'not-windows' || blocker === 'not-nsis'

export const isTauriRuntime = (): boolean => {
  try {
    return !!(window as any).desktopAPI
  } catch {
    return false
  }
}

/** 探测当前环境能不能自动更新。任何一步拿不到答案都按「不能」处理。 */
export const getUpdateBlocker = async (): Promise<UpdateBlocker | null> => {
  // Vite 开发模式：热更新的是源码，装包没有意义，还会覆盖正在调试的环境
  if (import.meta.env.DEV) return 'dev'
  if (!isTauriRuntime()) return 'not-tauri'

  const api = getBridge()
  const platform = api.platform
  if (platform !== 'win32') return 'not-windows'

  try {
    const kind = await (window as any).desktopAPI.updater?.getInstallKind?.()
    if (kind === 'nsis') return null
    return 'not-nsis'
  } catch {
    // 探测不出安装形态：宁可不更新，也不要装坏别人的环境
    return 'not-nsis'
  }
}

/** 清单里读到的新版本（拍平成普通对象，界面不必认识插件的资源类型） */
export interface AvailableUpdate {
  version: string
  currentVersion: string
  notes: string
  date: string | null
  /** auto = 插件能自己下载并装（Windows NSIS）；manual = 只能去下载页手动换包 */
  mode: 'auto' | 'manual'
}

/** check_manual_update 的返回：只要提示所需字段 */
export interface ManualUpdateInfo {
  version: string
  notes: string
  date: string | null
}

/** 当前运行版本（手动更新提示要显示「你现在是 v几」） */
export const getCurrentVersion = (): string =>
  // 构建时由 vite 注入；与设置页/关于页同一来源
  (typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.0')

/**
 * 只查版本、不安装（macOS / Linux / 便携版）。
 * 后端读 plugins.updater.endpoints 指向的同一份 latest.json。
 * 失败抛错：调用方要区分「检查失败」与「已是最新」，静默吞掉会让用户以为检查过了。
 */
export const checkManualUpdate = async (): Promise<ManualUpdateInfo> => {
  const api = getBridge()
  const res = await api.updater.checkManual()
  if (!res?.success) {
    throw new Error(res?.message || 'check failed')
  }
  return res.data as ManualUpdateInfo
}

/** 插件返回的 Update 在 Rust 侧持有资源，用完必须 close()，否则反复检查会漏。 */
let pending: Update | null = null

const releasePending = async (): Promise<void> => {
  const handle = pending
  pending = null
  if (!handle) return
  try {
    await handle.close()
  } catch {
    // 关不掉只是资源晚一点回收，不影响功能
  }
}

/** 检查更新（自动通道）。返回 null = 已是最新；网络/清单出错抛错。 */
export const checkForUpdate = async (): Promise<AvailableUpdate | null> => {
  await releasePending()
  const update = await checkPlugin()
  if (!update) return null
  pending = update
  return {
    version: normalizeVersion(update.version),
    currentVersion: normalizeVersion(update.currentVersion),
    notes: typeof update.body === 'string' ? update.body : '',
    date: update.date ?? null,
    mode: 'auto',
  }
}

/**
 * 下载并安装。Windows NSIS 下 installMode = passive：装完安装器自己退出，
 * 我们的进程随之结束 —— 调用前必须把该落盘的东西落完。
 * restartAfterInstall: true —— 安装器装完会自己把应用拉起来。
 * 句柄活到进程结束：用户「跳过」后仍可能改主意点「立即更新」。
 */
export const installUpdate = async (
  onProgress: (downloaded: number, total: number | null) => void,
): Promise<void> => {
  const handle = pending
  if (!handle) throw new Error('installUpdate: 没有待安装的更新')
  let downloaded = 0
  let total: number | null = null
  await handle.downloadAndInstall(
    event => {
      if (event.event === 'Started') {
        total = event.data.contentLength ?? null
      } else if (event.event === 'Progress') {
        downloaded += event.data.chunkLength
      } else {
        downloaded = total ?? downloaded
      }
      onProgress(downloaded, total)
    },
    { restartAfterInstall: true },
  )
  // 走到这里说明安装器已接过控制权；资源随进程结束回收
  pending = null
}

/** 打开某版本的 Release 页（手动更新通道）。指向 tag 而非 /releases/latest。 */
export const releasePageUrl = (version: string | null | undefined): string => {
  const v = normalizeVersion(version ?? '')
  if (!v) return 'https://github.com/laoduu/YiziVoice/releases/latest'
  return `https://github.com/laoduu/YiziVoice/releases/tag/v${v}`
}
