import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { initThemeFromSettings } from './services/theme'
import { detectRuntime } from './services/runtime'
import { installGlassLight } from './services/glassLight'

async function boot() {
  initThemeFromSettings()
  // 玻璃材质的指针灯光。纯 DOM,两个宿主都要装(不是桌面能力的一部分)
  installGlassLight()
  // 非 Tauri 宿主(浏览器里跑 `npm run dev` 做纯 UI 调试)没有桌面桥,依赖桥的功能不可用
  if (detectRuntime() === 'tauri') {
    const { installTauriBridge } = await import('./services/tauriShim')
    await installTauriBridge()
  }
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  )
}

boot()
