import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { readFileSync } from 'fs'

// 版本号单一来源：package.json。构建时注入为常量，界面里不再硬编码版本字符串。
// 刻意不用 Tauri 的 getVersion()——那需要额外的 core:app:allow-version capability，
// 又多一个"只在打包态暴露"的改动面，而这里零新权限、dev 与浏览器模式都能用。
const { version } = JSON.parse(readFileSync(path.resolve(__dirname, 'package.json'), 'utf-8'))

export default defineConfig({
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'production'),
    __APP_VERSION__: JSON.stringify(version),
  },
  plugins: [
    react(),
    {
      name: 'remove-crossorigin',
      transformIndexHtml(html) {
        return html.replace(/ crossorigin/g, '')
      },
    },
    {
      // 这两个文件都是「这份配置的输入」,但都不是 import 进来的,所以 Vite 不把它们算作
      // 「配置依赖」,改它们既不重启 dev server 也不重载页面。各有一个**静默故障**,
      // 而实测下来两者的**修法不一样** —— 这正是这里分成两种反应的原因:
      //
      //   package.json —— dev 下 `define` 不是内联替换:Vite 把值当全局量由 dev server
      //   注入,值取自 server 的配置,所以改完版本号关于页一直显示旧值、**刷新也没用**
      //   (2026-10 发 v2.1.2 时踩到:dev 里 2.1.1,生产构建是对的)。
      //   `server.restart()` 修得了:define 来自 Vite 自己的 config,重启会重读。
      //
      //   tailwind.config.js —— PostCSS 插件不会重建工具类,新 token 的 class 完全不生效,
      //   元素静默继承父级颜色(v4 期间踩到:text-hero-1..7 一个都没生成,7 个词全黑)。
      //   ⚠️ `server.restart()` **修不了这个**。2026-10 实测:同一份配置(带一个 safelist
      //   探针)交给新起的 dev server,CSS 里有那个类(78652 字符);而老进程经过两次
      //   server.restart() 之后仍然没有(78551 字符)。Tailwind 插件解析出的配置缓存在
      //   Node 模块里,活过了同进程重启 —— 只有**进程级重启**才算数(Ctrl+C 后重开
      //   `npm run tauri:dev`)。既然重启没用,就别白付一次页面重载,改成把这件事**喊出来**:
      //   静默的错误值比一次报错难查得多。
      name: 'restart-on-config-input-change',
      configureServer(server) {
        const pkgPath = path.resolve(__dirname, 'package.json')
        const twPath = path.resolve(__dirname, 'tailwind.config.js')
        server.watcher.add(pkgPath)
        server.watcher.add(twPath)
        server.watcher.on('change', file => {
          const hit = path.resolve(file)
          if (hit === pkgPath) {
            server.config.logger.info('package.json changed -> restarting dev server (版本号会重新注入)')
            server.restart()
          } else if (hit === twPath) {
            server.config.logger.warn(
              'tailwind.config.js changed -> 工具类不会重建(server.restart 也无效,配置缓存在 Node 模块里)。'
              + '请完整重启:npm run tauri:dev。否则新 token 的 class 不生效,元素会静默继承父级颜色。',
            )
          }
        })
      },
    },
  ],
  base: './',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 5173,
    watch: {
      // Windows 下监听构建产物会因文件被替换/删除抛 EBUSY,导致 dev server 崩溃。
      // 一旦崩溃,Vite 会连带把 beforeDevCommand 一起带走,表现为"应用自己关了"。
      //   - src-tauri: Rust 编译产物;dist: `npm run build`(emptyOutDir) 时整目录重建
      //   - */.NAME.<pid>.<guid>.tmpdir/: 编辑器/工具的原子写临时目录。实测编辑
      //     .github/workflows/ci.yml 时,Vite 会去 watch 这个刚建就被删的 tmp 目录,
      //     抛 EBUSY 直接终止进程(2026-09 实际踩过)
      // 注意:指定 ignored 会覆盖 Vite 默认值,所以 .git / node_modules 必须显式带上。
      ignored: [
        '**/.git/**',
        '**/node_modules/**',
        '**/src-tauri/**',
        '**/dist/**',
        '**/*.tmpdir/**',
        '**/*.tmp',
      ],
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
})
