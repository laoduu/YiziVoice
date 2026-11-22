export type RuntimeKind = 'tauri' | 'browser'

// 桌面壳只有 Tauri 一条线;'browser' 仅用于在浏览器里跑 `npm run dev` 做纯 UI 调试,
// 此时桌面桥不存在,依赖桥的功能不可用。
export function detectRuntime(): RuntimeKind {
  if (typeof window === 'undefined') return 'browser'
  return '__TAURI_INTERNALS__' in window ? 'tauri' : 'browser'
}
