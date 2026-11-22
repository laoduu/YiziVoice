/**
 * 在线更新的纯逻辑：版本比较、是否提示、进度与体积格式化。
 *
 * 单独成模块的原因：判断一旦出错，表现是「反复打扰」或「该提示不提示」，
 * 极难复现 —— 做成纯函数便于 review（与 YiziMarkdown 同构）。
 *
 * 真正的检查 / 下载 / 安装由 tauri-plugin-updater 与 updateClient 负责；
 * 这里只回答「要不要把这个版本给用户看」「进度条画到哪儿」。
 */

/** 去掉前导 v 与首尾空白：清单里允许写 "v2.1.5"，本地版本不带 v。 */
export const normalizeVersion = (v: string): string =>
  String(v ?? '').trim().replace(/^v/i, '')

interface ParsedVersion {
  main: number[]
  pre: string[]
}

/** 解析 semver（宽松：允许 1.2 这种段数不足）。无法解析返回 null */
const parseVersion = (raw: string): ParsedVersion | null => {
  const cleaned = normalizeVersion(raw).split('+')[0]
  const [core, ...rest] = cleaned.split('-')
  if (!/^\d+(\.\d+)*$/.test(core)) return null
  const pre = rest.join('-')
  return { main: core.split('.').map(Number), pre: pre ? pre.split('.') : [] }
}

/** 比较版本：a < b → -1，相等 → 0，a > b → 1。
 *  任一侧无法解析返回 0 —— 宁可「不提示」，也不要因脏版本号弹更新。 */
export const compareVersion = (a: string, b: string): number => {
  const pa = parseVersion(a)
  const pb = parseVersion(b)
  if (!pa || !pb) return 0

  const len = Math.max(pa.main.length, pb.main.length)
  for (let i = 0; i < len; i++) {
    const x = pa.main[i] ?? 0
    const y = pb.main[i] ?? 0
    if (x !== y) return x < y ? -1 : 1
  }

  if (pa.pre.length && !pb.pre.length) return -1
  if (!pa.pre.length && pb.pre.length) return 1

  const preLen = Math.max(pa.pre.length, pb.pre.length)
  for (let i = 0; i < preLen; i++) {
    const x = pa.pre[i]
    const y = pb.pre[i]
    if (x === undefined) return -1
    if (y === undefined) return 1
    const xNum = /^\d+$/.test(x)
    const yNum = /^\d+$/.test(y)
    if (xNum && yNum) {
      if (Number(x) !== Number(y)) return Number(x) < Number(y) ? -1 : 1
      continue
    }
    if (xNum !== yNum) return xNum ? -1 : 1
    if (x !== y) return x < y ? -1 : 1
  }
  return 0
}

export type UpdateDecision = 'latest' | 'skipped' | 'available'

/**
 * 要不要把这个版本提示给用户？
 * - candidate 必须严格新于 current
 * - 用户点过「跳过此版本」后，同一版本不再提示
 * - 版本缺失 / 无法解析按 `latest` 处理：宁可不提示，也不要因脏清单误报
 */
export const decideUpdate = (
  candidate: string,
  current: string,
  skipped?: string | null,
): UpdateDecision => {
  const cand = normalizeVersion(candidate)
  const cur = normalizeVersion(current)
  if (!cand || !cur) return 'latest'
  if (compareVersion(cand, cur) <= 0) return 'latest'
  if (skipped && compareVersion(cand, skipped) === 0) return 'skipped'
  return 'available'
}

/** 下载进度 0~1；总大小未知返回 null（界面画不确定态，不假装 0%） */
export const progressRatio = (
  downloaded: number,
  total: number | null | undefined,
): number | null => {
  if (!Number.isFinite(downloaded) || !total || total <= 0) return null
  return Math.max(0, Math.min(1, downloaded / total))
}

/** 人类可读大小：1835008 → "1.8 MB" */
export const formatBytes = (bytes: number): string => {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  let value = bytes
  let i = 0
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024
    i++
  }
  return `${i === 0 ? value : Math.round(value * 10) / 10} ${units[i]}`
}

/** 更新说明压成一句摘要（提示卡只有几行空间） */
export const notesExcerpt = (markdown: string, maxLength = 160): string => {
  const plain = String(markdown ?? '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/^\s*\|.*\|\s*$/gm, ' ')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    .replace(/[*_`~>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  const chars = Array.from(plain)
  return chars.length > maxLength ? `${chars.slice(0, maxLength).join('')}…` : plain
}
