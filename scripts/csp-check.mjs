// CSP 白名单一致性校验。
//
// 防的是这一类漂移:代码里新增了网络调用或资源来源,但 tauri.conf.json 的 CSP 没跟上。
// 打包态 CSP 生效、桌面 tauri dev 不生效(webview 直连 devUrl,CSP 头只注入 tauri:// 响应),
// 所以这类问题只在装包后暴露,且往往静默无报错(见 docs/pitfalls.md)。
//
// 用法:npm run csp:check

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, dirname, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = p => readFileSync(join(root, p), 'utf8')

const failures = []
const warnings = []
const fail = msg => failures.push(msg)
const warn = msg => warnings.push(msg)

// ---------- 1. 解析 CSP ----------
const conf = JSON.parse(read('src-tauri/tauri.conf.json'))
const csp = conf.app?.security?.csp
if (!csp) {
  fail('tauri.conf.json 未配置 app.security.csp')
  report()
}

const directives = {}
for (const part of csp.split(';')) {
  const [name, ...sources] = part.trim().split(/\s+/)
  if (name) directives[name] = sources
}
const src = name => directives[name] ?? []

// ---------- 2. connect-src 必备项 ----------
// ipc: / http://ipc.localhost 缺失 → 打包态所有 invoke 失效
// data: / blob: 缺失 → 下载与录音回显静默失败(2026-09 实际踩过)
for (const required of ["'self'", 'ipc:', 'http://ipc.localhost', 'data:', 'blob:']) {
  if (!src('connect-src').includes(required)) {
    fail(`connect-src 缺少 ${required}`)
  }
}

// ---------- 3. asset protocol 必备项 ----------
for (const directive of ['img-src', 'media-src']) {
  for (const required of ['asset:', 'http://asset.localhost']) {
    if (!src(directive).includes(required)) {
      fail(`${directive} 缺少 ${required}(历史音频回放依赖 asset protocol)`)
    }
  }
}

// ---------- 4. 扫描 src/ 里的网络调用 ----------
const files = []
const walk = dir => {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) walk(full)
    else if (/\.(ts|tsx)$/.test(entry)) files.push(full)
  }
}
walk(join(root, 'src'))

const allowedHosts = new Set()
for (const entry of src('connect-src')) {
  const m = entry.match(/^https?:\/\/([^/]+)$/)
  if (m) allowedHosts.add(m[1])
}

const NET_CALL = /\b(?:fetch|WebSocket|EventSource)\s*\(\s*([`'"])([^`'"]*)\1/g
const SCHEME = /^(data|blob|asset|filesystem|https?):/

for (const file of files) {
  const text = readFileSync(file, 'utf8')
  const rel = relative(root, file).replace(/\\/g, '/')
  for (const line of text.split('\n')) {
    NET_CALL.lastIndex = 0
    const m = NET_CALL.exec(line)
    if (!m) continue
    const url = m[2]
    if (url.includes('${')) {
      warn(`${rel}: 动态 URL 无法静态校验,请人工确认已在 connect-src: ${url.trim().slice(0, 60)}`)
      continue
    }
    const scheme = url.match(SCHEME)?.[1]
    if (!scheme) continue // 相对路径走 'self',无需白名单
    if (['data', 'blob', 'asset', 'filesystem'].includes(scheme)) {
      if (!src('connect-src').includes(`${scheme}:`)) {
        fail(`${rel}: 对 ${scheme}: URL 调用了网络 API,但 connect-src 未放行 ${scheme}:`)
      }
      continue
    }
    const host = url.replace(/^https?:\/\//, '').split('/')[0]
    if (!allowedHosts.has(host) && !['localhost', '127.0.0.1'].includes(host.split(':')[0])) {
      fail(`${rel}: 网络调用目标 ${host} 不在 connect-src 白名单内`)
    }
  }
}

// ---------- 5. 接口地址锁死 ----------
// 应用只对接小米 MiMo 一家服务,接口地址固定为 mimoApi.ts 的 MIMO_BASE_URL。
// connect-src 是静态白名单:一旦 baseUrl 变回用户可编辑,填了白名单外的域名就会
// "dev 正常、打包态被拦" —— 与 2026-09 下载失效同一类问题。
const mimoApi = read('src/services/mimoApi.ts')
const mimoBaseUrl = mimoApi.match(/MIMO_BASE_URL\s*=\s*'([^']+)'/)?.[1]
if (!mimoBaseUrl) {
  fail('mimoApi.ts 未找到 MIMO_BASE_URL 常量')
} else {
  const host = mimoBaseUrl.replace(/^https?:\/\//, '').split('/')[0]
  if (!allowedHosts.has(host)) {
    fail(`MIMO_BASE_URL 的域名 ${host} 不在 connect-src 白名单内(改接口地址必须同步改 CSP)`)
  }
}

const editableBaseUrl = files.filter(f => /setBaseUrl|value=\{baseUrl\}/.test(readFileSync(f, 'utf8')))
if (editableBaseUrl.length) {
  fail(
    `baseUrl 又被做成用户可编辑的了:${editableBaseUrl
      .map(f => relative(root, f).replace(/\\/g, '/'))
      .join(', ')}。应锁死为 MIMO_BASE_URL,否则白名单外的域名只在打包态被拦。`
  )
}

// ---------- 6. script-src 收紧提示 ----------
if (src('script-src').includes("'unsafe-inline'")) {
  warn("script-src 含 'unsafe-inline',削弱了 XSS 防护")
}

report()

function report() {
  for (const w of warnings) console.log(`WARN  ${w}`)
  for (const f of failures) console.log(`FAIL  ${f}`)
  if (failures.length) {
    console.log(`\ncsp:check 失败:${failures.length} 项`)
    process.exit(1)
  }
  console.log(`\ncsp:check 通过(${warnings.length} 条提示)`)
}
