import { t } from '../i18n/core'

// 桌面桥:把 Rust 命令包装成 window.desktopAPI 供前端调用。
// 必须在渲染前安装(见 main.tsx boot),且禁止在模块顶层读取 window.desktopAPI。

let _convertFileSrc: ((path: string) => string) | null = null

export async function tauriAssetSrc(path: string): Promise<string> {
  if (!_convertFileSrc) {
    _convertFileSrc = (await import('@tauri-apps/api/core')).convertFileSrc
  }
  return _convertFileSrc(path)
}

function detectPlatform(): string {
  const ua = navigator.userAgent || ''
  if (/Win/i.test(ua)) return 'win32'
  if (/Mac/i.test(ua)) return 'darwin'
  if (/Android/i.test(ua)) return 'android'
  if (/Linux|X11/i.test(ua)) return 'linux'
  return 'unknown'
}

export async function installTauriBridge(): Promise<void> {
  const [{ invoke }, { getCurrentWindow }, dialogPlugin, openerPlugin] = await Promise.all([
    import('@tauri-apps/api/core'),
    import('@tauri-apps/api/window'),
    import('@tauri-apps/plugin-dialog'),
    import('@tauri-apps/plugin-opener'),
  ])

  const win = getCurrentWindow()
  const openDialog = dialogPlugin.open
  const openUrl = openerPlugin.openUrl

  ;(window as any).desktopAPI = {
    platform: detectPlatform(),

    // —— 在线更新 ——
    updater: {
      getInstallKind: () => invoke<string>('get_install_kind'),
      checkManual: () =>
        invoke<{ success: boolean; data?: unknown; message?: string }>('check_manual_update'),
      getAppVersion: () => invoke<string>('get_app_version'),
    },

    // —— 窗口控制 ——
    minimize: () => win.minimize(),
    maximize: async () => {
      // macOS 习惯:最大化 = 原生全屏;Windows/Linux 维持放大/还原
      if (detectPlatform() === 'darwin') {
        await win.setFullscreen(!(await win.isFullscreen()))
        return
      }
      await win.toggleMaximize()
    },
    close: () => win.close(),
    openExternalLink: (url: string) => openUrl(url),

    // —— 配置管理 ——
    config: {
      getConfigDir: () => invoke('config_get_config_dir'),
      loadAll: () => invoke('config_load_all'),
    },

    // —— 音色管理 ——
    voices: {
      loadList: () => invoke('voices_load_list'),
      loadVoice: (id: string) => invoke('voices_load_voice', { id }),
      saveVoice: (voice: unknown) => invoke('voices_save_voice', { voice }),
      deleteVoice: (id: string) => invoke('voices_delete_voice', { id }),
      loadCategories: () => invoke('voices_load_categories'),
      saveCategories: (categories: string[]) => invoke('voices_save_categories', { categories }),
      updateCategory: (id: string, category: string) =>
        invoke('voices_update_category', { id, category }),
      reassignCategory: (fromCategory: string, toCategory: string) =>
        invoke('voices_reassign_category', { fromCategory, toCategory }),
      renameCategory: (fromCategory: string, toCategory: string) =>
        invoke('voices_rename_category', { fromCategory, toCategory }),
    },

    // —— 风格管理 ——
    styles: {
      load: () => invoke('styles_load'),
      save: (styles: unknown[]) => invoke('styles_save', { styles }),
    },

    // —— 音频标签管理 ——
    audioTags: {
      loadOpening: () => invoke('audio_tags_load_opening'),
      loadInline: () => invoke('audio_tags_load_inline'),
      saveOpening: (categories: unknown[]) => invoke('audio_tags_save_opening', { categories }),
      saveInline: (categories: unknown[]) => invoke('audio_tags_save_inline', { categories }),
    },

    // —— 历史记录管理 ——
    history: {
      loadIndex: () => invoke('history_load_index'),
      saveEntry: (entry: unknown, audioBase64?: string) =>
        invoke('history_save_entry', { entry, audioBase64: audioBase64 ?? null }),
      deleteEntry: (id: string) => invoke('history_delete_entry', { id }),
      getAudioPath: (id: string) => invoke('history_get_audio_path', { id }),
      // Linux 专用回放通道:<audio> 取不到 asset://(见 historyService 注释)
      readAudio: (id: string) =>
        invoke<{ success: boolean; dataBase64?: string; message?: string }>('history_read_audio', {
          id,
        }),
      exportAudio: (id: string, fileName: string) =>
        invoke<{ success: boolean; canceled?: boolean; message?: string }>('export_history_audio', {
          id,
          fileName,
        }),
      clearAll: () => invoke('history_clear_all'),
      openFolder: () => invoke('history_open_folder'),
      pruneOrphanAudio: (dryRun: boolean) =>
        invoke<{ success: boolean; removed?: number; message?: string }>(
          'history_prune_orphan_audio',
          { dryRun },
        ),
    },

    // —— 设置管理 ——
    settings: {
      load: () => invoke('settings_load'),
      loadApiKey: () => invoke('settings_load_api_key'),
      save: (data: unknown) => invoke('settings_save', { data }),
      migrateCheck: () => invoke('settings_migrate_check'),
      migrate: (oldData: unknown) => invoke('settings_migrate', { oldData }),
    },

    // —— 数据目录管理(select-dir 由 dialog 插件承担)—— 
    storage: {
      getDataDir: () => invoke('storage_get_data_dir'),
      selectDir: async () => {
        let defaultPath: string | undefined
        try {
          const info = await invoke<{ current?: string }>('storage_get_data_dir')
          defaultPath = info?.current
        } catch {
          /* 忽略,仅用于预选目录 */
        }
        const selected = await openDialog({
          directory: true,
          multiple: false,
          title: t('services.selectDataDir'),
          defaultPath,
        })
        return typeof selected === 'string' ? selected : null
      },
      migrateData: (newDir: string) => invoke('storage_migrate_data', { newDir }),
      resetDataDir: () => invoke('storage_reset_data_dir'),
    },

    // —— 导出(系统另存为 + Rust 写盘;WebView2 不响应 <a download>)——
    exportTextFile: (content: string, fileName: string) =>
      invoke<{ success: boolean }>('export_text_file', { content, fileName }),
    exportBinaryFile: (dataBase64: string, fileName: string) =>
      invoke<{ success: boolean }>('export_binary_file', { dataBase64, fileName }),
  }
}
