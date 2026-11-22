#!/usr/bin/env node
/**
 * 生成在线更新清单 latest.json（tauri-plugin-updater 的静态端点格式）。
 *
 * 为什么需要它：updater 只认这一种格式，写错的表现是**客户端静默查不到更新**——
 * 平台键拼错、签名漏了、版本号带了个多余的 v，都不会报错，只是「没有更新」。
 *
 * 用法：
 *   node scripts/make-manifest.mjs \
 *     --version 2.1.5 \
 *     --notes CHANGELOG.md \
 *     --base-url https://github.com/laoduu/YiziVoice/releases/download/v2.1.5 \
 *     --artifact windows-x86_64-nsis=src-tauri/target/release/bundle/nsis/YiziVoice_2.1.5_x64-setup.exe \
 *     --artifact windows-x86_64=src-tauri/target/release/bundle/nsis/YiziVoice_2.1.5_x64-setup.exe \
 *     --out .release_tmp/latest.json
 *
 * 签名不是路径而是内容：脚本自动读 `<产物路径>.sig`（由 tauri.updater.conf.json 的
 * bundle.createUpdaterArtifacts = true 生成）。
 *
 * 上传顺序（很重要）：先传产物，**最后**传 latest.json。
 * 否则客户端会拿着旧清单一直「没有更新」。
 *
 * 平台键给两个（windows-x86_64-nsis 与 windows-x86_64）指向同一个安装包：
 * 插件按 {os}-{arch}-{installer} 再退到 {os}-{arch} 查找，少一个键就会「查不到更新」。
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join, dirname, basename, resolve, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

const USAGE = `
生成在线更新清单 latest.json

  --version <ver>             必填，新版本号（允许带 v，会归一化掉）
  --notes <file>              更新说明文件（Markdown，通常从 CHANGELOG.md 截取该版本段）
  --base-url <url>            必填，产物所在目录的 URL 前缀
  --artifact <平台键>=<路径>  必填，可重复。签名自动读 <路径>.sig
  --out <file>                输出路径，默认 .release_tmp/latest.json
  --pub-date <rfc3339>        可选，固定发布日期
  --dry-run                   只打印，不写文件
`

function fail(message) {
  console.error(`\n✗ ${message}\n`)
  console.error(USAGE)
  process.exit(1)
}

const args = process.argv.slice(2)
const opts = { artifacts: [], out: '.release_tmp/latest.json', dryRun: false }

for (let i = 0; i < args.length; i++) {
  const flag = args[i]
  const nextValue = () => {
    const value = args[++i]
    if (value === undefined) fail(`参数 ${flag} 缺少取值`)
    return value
  }
  switch (flag) {
    case '--version': opts.version = nextValue(); break
    case '--notes': opts.notesFile = nextValue(); break
    case '--base-url': opts.baseUrl = nextValue(); break
    case '--artifact': opts.artifacts.push(nextValue()); break
    case '--out': opts.out = nextValue(); break
    case '--pub-date': opts.pubDate = nextValue(); break
    case '--dry-run': opts.dryRun = true; break
    case '--help': case '-h': console.log(USAGE); process.exit(0); break
    default: fail(`未知参数：${flag}`)
  }
}

if (!opts.version) fail('缺少 --version')
if (!opts.baseUrl) fail('缺少 --base-url')
if (!opts.artifacts.length) fail('至少需要一个 --artifact <平台键>=<路径>')

// 版本归一化（去前导 v）
const version = String(opts.version).trim().replace(/^v/i, '')
if (!/^\d+(\.\d+)*$/.test(version)) fail(`版本号格式不对：${opts.version}`)

// 更新说明（可选；缺省空串）
let notes = ''
if (opts.notesFile) {
  const notesPath = resolve(root, opts.notesFile)
  if (!existsSync(notesPath)) fail(`找不到更新说明文件：${opts.notesFile}`)
  notes = readFileSync(notesPath, 'utf8').replace(/\r\n/g, '\n').trimEnd()
}

// 对照 tauri.conf.json 版本号
try {
  const confVersion = JSON.parse(readFileSync(join(root, 'src-tauri', 'tauri.conf.json'), 'utf8')).version
  if (confVersion !== version) {
    console.warn(`⚠ --version ${version} 与 tauri.conf.json 的 ${confVersion} 不一致（发版前请同步版本号）`)
  }
} catch {
  console.warn('⚠ 读不出 tauri.conf.json 版本号，跳过一致性提示')
}

// 产物与签名
const baseUrl = opts.baseUrl.replace(/\/+$/, '')
const platforms = {}
for (const spec of opts.artifacts) {
  const eq = spec.indexOf('=')
  if (eq <= 0) fail(`--artifact 格式应为 <平台键>=<路径>，收到：${spec}`)
  const platform = spec.slice(0, eq).trim()
  const filePath = resolve(root, spec.slice(eq + 1).trim())

  if (!existsSync(filePath)) fail(`找不到产物文件：${relative(root, filePath)}`)
  const sigPath = `${filePath}.sig`
  if (!existsSync(sigPath)) {
    fail(
      `找不到签名文件：${relative(root, sigPath)}\n` +
        '  签名由 tauri.updater.conf.json 的 createUpdaterArtifacts 生成；\n' +
        '  若没有，说明这次构建没带 --config src-tauri/tauri.updater.conf.json。',
    )
  }
  if (platforms[platform]) fail(`平台键重复：${platform}`)
  platforms[platform] = {
    signature: readFileSync(sigPath, 'utf8').trim(),
    url: `${baseUrl}/${basename(filePath)}`,
  }
  if (!platforms[platform].signature) fail(`${platform} 的签名为空`)
}

const manifest = {
  version,
  notes,
  pub_date: opts.pubDate ?? new Date().toISOString(),
  platforms,
}

const json = `${JSON.stringify(manifest, null, 2)}\n`
if (opts.dryRun) {
  console.log(json)
  process.exit(0)
}

const outPath = resolve(root, opts.out)
mkdirSync(dirname(outPath), { recursive: true })
writeFileSync(outPath, json, 'utf8')

console.log(`✓ 已生成 ${relative(root, outPath)}`)
console.log(`  版本：${manifest.version}`)
for (const [key, entry] of Object.entries(platforms)) {
  console.log(`  平台：${key}  →  ${entry.url}`)
}
console.log('\n上传顺序：先传全部产物，**最后**传 latest.json。')
