// 发版前置校验。
//
// 防两件事:
//   1. 版本号漂移 —— 需要同步 3 处(package.json / tauri.conf.json / Cargo.toml)。
//      界面里的版本由 vite.config.ts 构建时从 package.json 注入,不再手工同步。
//   2. tag 与产物不对应 —— 曾出现 tag 打好 7.5 小时后才本机打包,导致无法确证
//      "已发布的二进制 == tag 的源码"。这里强制 HEAD 必须就是该版本的 tag。
//
// 用法:npm run release:check（CI 的 release job 也会跑)

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = p => readFileSync(join(root, p), 'utf8')
const git = (...args) =>
  execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()

const failures = []
const warnings = []

// ---------- 1. 版本号三处一致 ----------
const cargoToml = read('src-tauri/Cargo.toml')
const packageSection = cargoToml.split(/^\[/m).find(s => s.startsWith('package]'))

const sources = [
  ['package.json', JSON.parse(read('package.json')).version],
  ['src-tauri/tauri.conf.json', JSON.parse(read('src-tauri/tauri.conf.json')).version],
  ['src-tauri/Cargo.toml [package]', packageSection?.match(/^version\s*=\s*"([^"]+)"/m)?.[1]],
]

const version = sources[0][1]
for (const [file, found] of sources) {
  if (!found) failures.push(`${file}: 未能解析出版本号`)
  else if (found !== version) failures.push(`${file}: ${found} ≠ package.json 的 ${version}`)
}

// 界面里的版本必须用构建时注入的常量,硬编码回去就又多一处手工同步。
// ⚠️ 这里不写死某一个文件:关于页原先在 `components/dialogs/AboutDialog.tsx`,设置中心整页化
// 之后搬到 `components/hub/AboutPanel.tsx` —— 写死路径的检查会直接 ENOENT 崩掉(而不是报失败),
// 于是「发版门禁」在真正发版那一步才炸。改为扫 src/,顺带把「有没有人又把版本号写回源码」
// 也一起看住(那次搬迁证明「文件会搬家」,而「不许硬编码」才是这条要守的事)。
const srcFiles = []
const walkSrc = dir => {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) walkSrc(full)
    else if (/\.(ts|tsx)$/.test(entry)) srcFiles.push(full)
  }
}
walkSrc(join(root, 'src'))
const usesConstant = srcFiles.filter(f => readFileSync(f, 'utf8').includes('__APP_VERSION__'))
if (!usesConstant.length) {
  failures.push('src/ 下没有任何文件使用 __APP_VERSION__ —— 关于页的版本号丢了,或又被硬编码了')
}
const hardcoded = srcFiles.filter(f => readFileSync(f, 'utf8').includes(version))
if (hardcoded.length) {
  failures.push(`版本号 ${version} 被硬编码进源码:${hardcoded.map(f => f.slice(root.length + 1)).join(', ')}`
    + '(应使用构建时注入的 __APP_VERSION__)')
}

// ---------- 2. CHANGELOG 必须有该版本条目 ----------
const changelog = read('CHANGELOG.md')
const escaped = version.replace(/\./g, '\\.')
// 接受两种历史标题：`## v2.1.4（…）` 与 Keep-a-Changelog 风格 `## [2.1.4] - …`
if (
  !new RegExp(`^## v${escaped}(\\s|$|（|\\()`, 'm').test(changelog) &&
  !new RegExp(`^## \\[${escaped}\\]`, 'm').test(changelog)
) {
  failures.push(`CHANGELOG.md: 缺少 "## v${version}" 或 "## [${version}]" 条目`)
}
if (/^## 未发布/m.test(changelog)) {
  warnings.push('CHANGELOG.md 仍有 "## 未发布" 节:发版时应改名为 "## vX.Y.Z（日期）"')
}

// ---------- 3. 工作区必须干净 ----------
const dirty = git('status', '--porcelain')
if (dirty) {
  failures.push(`工作区有未提交改动,发版产物无法追溯到源码:\n${dirty}`)
}

// ---------- 4. HEAD 必须就是该版本的 tag ----------
const tag = `v${version}`
let tagCommit = null
try {
  tagCommit = git('rev-parse', `${tag}^{commit}`)
} catch {
  failures.push(`tag ${tag} 不存在。发版流程:先提交 → git tag ${tag} → git push origin ${tag}`)
}
if (tagCommit) {
  const head = git('rev-parse', 'HEAD')
  if (head !== tagCommit) {
    failures.push(`HEAD (${head.slice(0, 7)}) 不是 tag ${tag} (${tagCommit.slice(0, 7)}):产物与 tag 不对应`)
  }
}

// ---------- 输出 ----------
for (const w of warnings) console.log(`WARN  ${w}`)
for (const f of failures) console.log(`FAIL  ${f}`)
if (failures.length) {
  console.log(`\nrelease:check 失败:${failures.length} 项`)
  process.exit(1)
}
console.log(`\nrelease:check 通过:版本 ${version},HEAD == ${tag}(${warnings.length} 条提示)`)
