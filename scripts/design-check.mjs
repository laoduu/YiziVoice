// docs/design-system.md (v4) 视觉规范静态门禁。
//
// 防的是这一类漂移:凭感觉调样式,重新引入已经清理掉的取值。这些问题不会报错、
// 不会让构建失败,只会让规范慢慢失效 —— v4 审计时正是这样积累出「字号 8 档挤在
// 10–16px、任意值 71 处、视觉签名 40 种」的。
//
// 这里只能查**静态可判定**的部分。字体/颜色的实际渲染结果(签名数、对比度、
// 溢出)依赖浏览器,见 docs/design-system.md §9.2 的生产构建验收流程。
//
// 用法:npm run design:check

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, dirname, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = p => readFileSync(join(root, p), 'utf8')

const failures = []
const warnings = []
const fail = msg => failures.push(msg)
const warn = msg => warnings.push(msg)

// ---------- 收集源文件 ----------
const files = []
const walk = dir => {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) walk(full)
    else if (/\.(ts|tsx)$/.test(entry)) files.push(full)
  }
}
walk(join(root, 'src'))

const rel = f => relative(root, f).replace(/\\/g, '/')

// 每个文件读一次,按行保留行号
const sources = files.map(f => ({ path: rel(f), lines: readFileSync(f, 'utf8').split('\n') }))

// ---------- 1~4. 取值档位禁则 ----------
// 逐条对应 docs/design-system.md §5.1 / §5.5 / §5.2 / §5.3
const BANS = [
  { re: /text-\[\d/, why: '任意值字号 text-[Npx](§5.1 只用 text-xs|sm|base|xl|3xl)' },
  { re: /rounded-\[[\d.]+px\]/, why: '任意值圆角 rounded-[Npx](§5.5 只用 rounded-sm|md|lg|full)' },
  { re: /\bfont-(?:bold|extrabold|black)\b/, why: '字重 700(§5.2 只有 400/500/600)' },
  // 只禁 Tailwind 自带灰阶。text-white 本身合法 —— v4 的实心语义填充(danger/success/
  // accent)上就是要配白字,所以它走下面的 WARN 而不是 FAIL。
  { re: /\btext-(?:black|(?:gray|slate|zinc|neutral|stone)-\d)/, why: '非 token 文字色(§5.3 只用 text-ink / ink-2 / ink-3)' },
]

for (const { re, why } of BANS) {
  for (const { path, lines } of sources) {
    lines.forEach((line, i) => {
      if (re.test(line)) fail(`${path}:${i + 1}  ${why}`)
    })
  }
}

// text-white 只在实心填充上合法。填充可能写在父元素或同一模板串的下一行,
// 静态判定不了,因此只提示人工确认。
for (const { path, lines } of sources) {
  lines.forEach((line, i) => {
    if (/\btext-white\b/.test(line) && !/\bbg-(?:accent|danger|success|warning|accent-2|accent-strong)\b/.test(line)) {
      warn(`${path}:${i + 1}  text-white 未与实心填充同行,请确认它确实落在 bg-accent/danger/success 上(§5.3)`)
    }
  })
}

// ---------- 5. 图标档位 ----------
// §5.8 定 5 档:12(meta) / 14(control) / 16(nav) / 24(illustration) / 30(功能图标)。
// 图标尺寸此前完全没有档位,实测漂到 14 种 —— 同一角色给不同数(空态插图 24/26/28)。
const ICON_TIERS = [12, 14, 16, 24, 30, 36]
const ICON = /(?:^|[^\w-])([A-Z][A-Za-z0-9]*)\s+size=\{(\d+)\}/g
const iconSizes = new Map()

for (const { path, lines } of sources) {
  lines.forEach((line, i) => {
    ICON.lastIndex = 0
    let m
    while ((m = ICON.exec(line))) {
      const size = +m[2]
      if (!iconSizes.has(size)) iconSizes.set(size, [])
      iconSizes.get(size).push(`${path}:${i + 1}`)
      if (!ICON_TIERS.includes(size)) {
        fail(`${path}:${i + 1}  <${m[1]} size={${size}}> 不在图标 5 档内(§5.8 只用 ${ICON_TIERS.join('/')})`)
      }
    }
    // 非字面量的尺寸无法静态判定,提示人工确认
    const dyn = line.match(/[A-Z][A-Za-z0-9]*\s+size=\{(?!\d+\})[^}]+\}/)
    if (dyn) warn(`${path}:${i + 1}  图标尺寸非字面量,无法静态校验:${dyn[0].trim().slice(0, 50)}`)
  })
}

// ---------- 6. 文字色对比度(含 hover/按下态) ----------
// §5.3 的目标对比度必须在「最差的底」上核算,不是常态那个底。
// v4 只测静止态,把 --text-3 浅色定在 60% 量到 4.55:1 就收工了;但列表行 hover 时底色
// 变成 --surface-hover、按下变成 --surface-active,同一个 60% 在那两处只有 4.37/4.28,
// 低于 AA ——「241 个节点 0 失败」是假阴性。这里把三种底都算进去,取最差值判定。
const css = read('src/index.css')

const blockOf = selector => {
  const i = css.indexOf(selector)
  if (i < 0) return ''
  const open = css.indexOf('{', i)
  const close = css.indexOf('}', open)
  return css.slice(open + 1, close)
}

const rgba = v => {
  const m = String(v).trim().match(/rgba?\(([^)]+)\)/)
  if (m) {
    const p = m[1].split(',').map(s => parseFloat(s))
    return { r: p[0], g: p[1], b: p[2], a: p[3] === undefined ? 1 : p[3] }
  }
  const h = String(v).trim().match(/^#([0-9a-f]{6})$/i)
  if (h) return { r: parseInt(h[1].slice(0, 2), 16), g: parseInt(h[1].slice(2, 4), 16), b: parseInt(h[1].slice(4, 6), 16), a: 1 }
  return null
}

const token = (block, name) => {
  const m = block.match(new RegExp('--' + name + '\\s*:\\s*([^;]+);'))
  return m ? m[1].trim() : null
}

// 暗色主题里 --success-text 等是 `var(--success)` 这种别名。原门禁从不解析这些 token,
// 所以没暴露;v4.2 把它们纳入检查后必须跟一层间接引用。
const resolve = (block, name, depth = 0) => {
  const v = token(block, name)
  if (v && depth < 5) {
    const m = v.match(/^var\(\s*--([\w-]+)\s*\)$/)
    if (m) return resolve(block, m[1], depth + 1)
  }
  return v
}

const lin = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4) }
const lum = c => 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b)
const over = (f, b) => ({ r: f.r * f.a + b.r * (1 - f.a), g: f.g * f.a + b.g * (1 - f.a), b: f.b * f.a + b.b * (1 - f.a), a: 1 })
const contrast = (f, b) => {
  const F = over(f, b)
  const [hi, lo] = lum(F) > lum(b) ? [lum(F), lum(b)] : [lum(b), lum(F)]
  return (hi + 0.05) / (lo + 0.05)
}

// ---------- 5b. M2 不许有 backdrop-filter(v4.3) ----------
// 卡片永远坐在**已经模糊过**的面板/浮层里,所以它自己的背底本来就是平滑的,再加一层
// backdrop-filter 视觉上买不到东西,却要付一整块 render surface。这条以前只写在注释里;
// 现在门禁看住它,因为「M2 也加上模糊吧」是一个看起来无害、实际白付性能的改动。
{
  const m = css.match(/\.mat-card\s*\{([^}]*)\}/)
  if (!m) {
    fail('index.css 里找不到 .mat-card 的独立规则(材质声明被挪走或改名了?)')
  } else if (/backdrop-filter/.test(m[1])) {
    fail('.mat-card 不许有 backdrop-filter(§10.2:卡片背后已经是模糊过的底,再模糊买不到东西,只多一块 render surface)')
  }
}

// ---------- 5c. 描边必须与那圈透明边框配对(v4.3.5) ----------
// 三种材质都带 `border: 1px solid transparent`(去掉会让内容盒移 2px,实测某页深处会漂 4px)。
// 而绝对定位元素的 `inset` 是相对**包含块的 padding box** 解析的,所以 `inset: 0` 会把描边画在
// 元素真正的边缘**内** 1px,外面留一条带;表面底色又会涂满那圈透明边框(background-clip 默认
// border-box),于是元素**看起来**到边框盒为止、描边却在里面 —— 读起来就是**两层边线**,也就是
// 首页三张卡片被报的那个问题。实测剖面(两个主题、四条边都一样):
//   阴影 → 1px 纯表面色 → 1px 描边 → 表面色
// 修法是把描边本身推进那圈透明边框里(`inset: -1px`),它就成了元素最外一像素 —— 实测四条边
// 都只剩一条线。所以这两件事必须同时成立:**有 1px 边框** 且 **inset: -1px**;任何一半单独
// 看都很自然,只有配对才正确。去掉边框(或把 inset 改回 0)都会让那条带回来。
{
  // Rules are extracted properly rather than matched with a loose regex: `.mat-overlay`
  // also appears as the LAST selector of the shared sheen rule, and a regex that does not
  // pin the selector down happily reads that rule's body instead of the material's.
  const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .map(m => ({ sel: m[1].replace(/\/\*[\s\S]*?\*\//g, '').trim().replace(/\s+/g, ' '), body: m[2] }))
  const exact = sel => rules.find(r => r.sel === sel)
  const anyOf = list => rules.find(r => r.sel.split(',').map(s => s.trim()).join(',') === list.join(','))

  for (const name of ['.mat-panel', '.mat-card', '.mat-overlay']) {
    const r = exact(name)
    if (!r) fail(`描边配对:找不到 ${name} 的独立规则(改名了就要同步这条检查)`)
    else if (!/border\s*:\s*1px\s+solid\s+transparent/.test(r.body)) {
      fail(`描边配对:${name} 必须保留 1px 透明边框 —— 描边就画在这圈边框里(::after 的 inset: -1px)。`
        + '去掉它会让内容盒移动 2px,而且描边会从元素外面探出来 1px')
    }
  }
  const rim = anyOf(['.mat-panel::after', '.mat-card::after', '.mat-overlay::after'])
  if (!rim) fail('描边配对:找不到三材质共享的 ::after 规则')
  else if (!/inset\s*:\s*-1px\s*;/.test(rim.body)) {
    fail('描边配对:共享 ::after 的 inset 必须是 -1px。`inset: 0` 相对 padding box 解析,描边会内缩'
      + '一整条边、外面露出 1px 纯底色,卡片读起来是两层边线(这正是 v4.3.5 修掉的那个问题)')
  }
}

// ---------- 5d. 会裁剪的材质必须用 .mat-clip,不能用 overflow-hidden(v4.3.5) ----------
// 描边住在元素最外那一像素(那圈透明边框)里,而 `overflow: hidden` 在后代的**padding box**
// 处裁剪 —— 它会把描边整条吃掉,面板静默地少一条边线。`.mat-clip` 用 `overflow: clip` 把裁剪
// 边界推到边框盒 + 1px,刚好放出描边这一条带。实测(6 屏 x 2 主题逐像素比对)只有描边自己变化,
// 内容没有任何东西漏出来;而完全放开裁剪会改变成百上千个内容像素,说明裁剪本身是有用的。
{
  const clip = css.match(/\.mat-clip\s*\{([^}]*)\}/)
  if (!clip) fail('.mat-clip:index.css 里找不到这个类(裁剪类名改了就要同步这条检查)')
  else {
    if (!/overflow\s*:\s*clip\s*;/.test(clip[1])) fail('.mat-clip:必须是 overflow: clip(overflow: hidden 会在 padding box 处裁掉描边)')
    if (!/overflow-clip-margin\s*:\s*1px\s*;/.test(clip[1])) {
      fail('.mat-clip:必须有 overflow-clip-margin: 1px(没有它,overflow: clip 仍然在 padding box 处裁,描边照样被吃掉)')
    }
  }
  // `.mat-clip` 与任何 `overflow-*` 工具类同时出现在一个 className 里就是自相矛盾:两者都在
  // 设 overflow,谁赢看源序,失败方式还是那条 1px 的发丝线 —— 静态看不出来,只能在这里挡。
  for (const { path, lines } of sources) {
    lines.forEach((line, i) => {
      if (!line.includes('mat-clip')) return
      const other = line.match(/\boverflow-(?:hidden|clip|auto|scroll|visible|y-auto|x-auto)\b/)
      if (other) fail(`${path}:${i + 1} mat-clip 与 ${other[0]} 同时出现(${line.trim().slice(0, 60)})—— 会裁剪的材质只用 mat-clip,不要再写 overflow-*`)
    })
  }
}

const THEMES = [
  { name: '浅色', block: blockOf(':root {'), canvas: '--bg-canvas' },
  { name: '暗色', block: blockOf('[data-theme="dark"] {'), canvas: '--bg-canvas' },
]

// ---------- 6a. 场景模型(v4.3 液态玻璃) ----------
// 表面降了不透明度之后,“文字可能落到的最差底”不再**是一个**颜色,而是一整片随位置
// 变化的场。这是本仓库第四次面对「采样口径太窄」(前三次:只测静止底 / 只测白底 /
// 只测面板不测卡片),这次靠“再多测一个固定底”糊不过去 —— 底本身成了连续量,只能采样。
//
// 场景从 `--bg-scene` **直接解析**,不在这里另抄一份取值。抄一份必然漂移:CSS 改了场景
// 而门禁还按旧场景判定,比不检查更糟,因为它给的是假阴性。
const VIEW = { w: 1422, h: 864 }
const GRID = { x: 9, y: 7 }

const parseScene = block => {
  const raw = token(block, 'bg-scene')
  if (!raw) return { layers: [] } // 还没有场景时就是纯画布,合法
  const parts = []
  let depth = 0
  let cur = ''
  for (const ch of raw) {
    if (ch === '(') depth++
    else if (ch === ')') depth--
    if (ch === ',' && depth === 0) { parts.push(cur); cur = '' } else cur += ch
  }
  parts.push(cur)
  const layers = []
  for (const part of parts) {
    const s = part.trim()
    if (/^var\(/i.test(s)) continue // 最后一层就是 --bg-canvas 本身
    const g = s.match(
      /^radial-gradient\(\s*([\d.]+)px\s+([\d.]+)px\s+at\s+(-?[\d.]+)%\s+(-?[\d.]+)%\s*,\s*(rgba?\([^)]*\))\s*,\s*transparent\s+([\d.]+)%\s*\)$/i
    )
    if (!g) return { error: s }
    const c = rgba(g[5])
    if (!c) return { error: s }
    layers.push({ w: +g[1], h: +g[2], x: +g[3] / 100, y: +g[4] / 100, c, stop: +g[6] / 100 })
  }
  return { layers, raw }
}

// radial-gradient 的 alpha 沿椭圆半径线性衰减,到 stop 处归零(在 premultiplied 空间
// 插值,也就是直接线性)。CSS 里先列出的层画在最上面,所以从画布往上叠。
const sceneAt = (layers, base, x, y) => {
  let c = { ...base }
  for (let i = layers.length - 1; i >= 0; i--) {
    const b = layers[i]
    const t = Math.hypot((x - b.x * VIEW.w) / b.w, (y - b.y * VIEW.h) / b.h)
    if (t >= b.stop) continue
    c = over({ ...b.c, a: b.c.a * (1 - t / b.stop) }, c)
  }
  return c
}

for (const { name, block, canvas } of THEMES) {
  if (!block) { fail(`${name}主题:未能在 index.css 中定位 token 块`); continue }
  const canvasColor = rgba(token(block, canvas.slice(2)))
  const surface1 = rgba(token(block, 'surface-1'))
  if (!canvasColor || !surface1) { fail(`${name}主题:${canvas} 或 surface-1 无法解析`); continue }

  const scene = parseScene(block)
  if (scene.error) {
    fail(
      `${name}主题:--bg-scene 里有认不出的层「${scene.error}」。场景模型只认 ` +
        `radial-gradient(<rx>px <ry>px at <x>% <y>%, <color>, transparent <s>%)。` +
        `认不出就少算一层 = 悄悄放宽判定,所以这里直接失败而不是跳过`
    )
    continue
  }

  const samples = []
  for (let i = 0; i < GRID.x; i++) {
    for (let j = 0; j < GRID.y; j++) {
      samples.push(sceneAt(scene.layers, canvasColor, (i / (GRID.x - 1)) * VIEW.w, (j / (GRID.y - 1)) * VIEW.h))
    }
  }

  // 场景必须有结构,否则 backdrop-filter 是数学空操作 —— 那正是 v4.3 之前的病根,
  // 也是「调大模糊半径毫无变化」的原因。判据用**单通道最大跨度**而不是亮度跨度:
  // 暗色场景把近黑画布从亮度 0.003 抬到 0.009(几乎没动),但红通道动了 24 级,
  // 而模糊抹平的正是这个。只看亮度会把暗色误判成“没有结构”。
  {
    let spread = 0
    for (const ch of ['r', 'g', 'b']) {
      const vals = samples.map(s => s[ch])
      spread = Math.max(spread, Math.max(...vals) - Math.min(...vals))
    }
    if (spread < 8) {
      fail(
        `${name}主题:--bg-scene 的单通道最大跨度只有 ${spread.toFixed(1)} 级。` +
          `场景太平 → 表面上的 backdrop-filter 买不到任何东西(§10.2)`
      )
    }
  }

  const surface2 = rgba(token(block, 'surface-2'))

  // v4.2:补上「卡片」这一层基座。原来的模型把所有底都合成到 pane 上,漏掉了
  // 「tint 叠在 card 上、card 再叠在 pane 上」——而 --surface-2 比 --surface-1 亮得多,
  // 于是真实最差底比模型亮一大截。实测:暗色 `--accent` 当文字在 accent-soft 上,
  // 按 pane 模型算是 4.73:1(过),真实卡片里只有 4.21:1(不过),音色首字 3.9:1。
  // 这和 §9.2 记录过的两次「采样口径太窄」是同一类错误,不要再犯第三次。
  // v4.3 把这两个基座从「一个颜色」换成「网格上的 N 个颜色」,配对表本身不动。
  const panes = samples.map(s => over(surface1, s))
  const cards = panes.map(p => (surface2 ? over(surface2, p) : p))
  // v4.3.2: a third base. Not every card sits on a panel -- the three feature cards on
  // the welcome page are children of <main>, so their real backdrop is the SCENE, not
  // a panel. A panel is 0.58 white over the scene, so dropping it makes the base darker,
  // and darker is worse for dark text: this is the same "sampling frame too narrow" error
  // as the two already recorded in §9.2, just one layer further out. Same lesson as
  // §9.2-16 -- the gate only guarantees what it models.
  const bare = samples.map(s => (surface2 ? over(surface2, s) : s))
  const mid = Math.floor(panes.length / 2)
  const pane = panes[mid]
  const card = cards[mid]
  const tintOn = (name, base) => {
    const c = rgba(resolve(block, name))
    return c ? over(c, base) : base
  }

  // v4.3.1:底的**又一个维度**。材质上还有两层会提亮底的东西,而提亮正好让深色文字掉对比度:
  //   - 顶部镜面 `--glass-sheen`(background-image 顶层,顶沿处满强度)
  //   - 指针灯光 `--glass-glow`(`::before` 的径向渐变,光心处满强度)
  // 两者都在文字**之下**、表面之上,所以合成顺序是 glow over sheen over 表面 over 场景。
  // 取最坏情况:只算光心 + 顶沿同时满强度的那一点。灯光跟着鼠标走,所以"文字刚好落在光心"
  // 不是假想场景 —— 鼠标停在某段文字上就是这个状态。
  const sheen = rgba(resolve(block, 'glass-sheen'))
  const glowC = rgba(resolve(block, 'glass-glow'))
  const lit = base => {
    let c = base
    if (sheen) c = over(sheen, c)
    if (glowC) c = over(glowC, c)
    return c
  }
  const BASES = [
    ...panes.map(p => ['面板', p]),
    ...cards.map(c => ['卡片', c]),
    ...bare.map(c => ['裸卡片', c]),
    ...panes.map(p => ['光心@面板', lit(p)]),
    ...cards.map(c => ['光心@卡片', lit(c)]),
    ...bare.map(c => ['光心@裸卡片', lit(c)]),
  ]

  // 每个文字 token 只跟它**真实的配对底**核算。第一版做了「所有 tint × 所有文字」的
  // 全交叉,一次报出 15 项,绝大多数是应用里不存在的组合(橙字落在蓝 tint 上、
  // 欢迎页 hero 词落在 warning tint 上)——那是造出来的失败,不是缺陷。全交叉只会
  // 逼着人为了不存在的场景去改真实的值。配对表按组件实际用法列出,**新增配对要同步加**。
  const onBoth = (tint) => BASES.map(([n, b]) => [`${tint}@${n}`, tintOn(tint, b)])
  const PLAIN = BASES.map(([n, b]) => [n, b])
  const HOVER = onBoth('surface-hover')
  const ACTIVE = onBoth('surface-active')
  // 通用文字 + 裸 --accent:两者都会落在导航/页签/图标按钮的按下态上
  // (`bg-surface-active text-accent`、`hover:bg-surface-active hover:text-accent`),也都会落在选中行的 tint 上
  const INK_AND_ACCENT = [...PLAIN, ...HOVER, ...ACTIVE, ...onBoth('accent-soft'), ...onBoth('accent-soft-2')]

  const TEXT_TOKENS = [
    ['text-1', 'text-1', INK_AND_ACCENT],
    ['text-2', 'text-2', INK_AND_ACCENT],
    ['text-3', 'text-3', INK_AND_ACCENT],
    // 裸 --accent 在组件里当文字用(App 导航、左栏页签、图标按钮 hover),必须核算
    ['accent', 'accent', INK_AND_ACCENT],
    // 语义色文字不落按下态:组件里没有 `bg-surface-active text-danger-text` 这种写法。
    // danger-text 也不落 `--surface-hover`:它的 5 处调用全是
    // `text-ink-3 hover:text-danger-text hover:bg-danger-soft` 与
    // `text-danger-text hover:bg-danger-soft`——danger 文字永远和 danger tint 同时出现
    // (DropdownMenu 的普通项用 surface-hover,危险项用 danger-soft,两者互斥)。
    // accent-2-text 落 surface-hover 是真的:TextToSpeech 的试听角标就是
    // `bg-surface-hover ... hover:text-accent-2-text`。
    ['success-text', 'success-text', [...PLAIN, ...HOVER]],
    ['warning-text', 'warning-text', [...PLAIN, ...HOVER]],
    ['danger-text', 'danger-text', [...PLAIN, ...onBoth('danger-soft')]],
    ['accent-2-text', 'accent-2-text', [...PLAIN, ...HOVER, ...onBoth('accent-2-soft')]],
  ]
  for (const [tname, ename, backdrops] of TEXT_TOKENS) {
    const color = rgba(resolve(block, ename))
    if (!color) { fail(`${name}主题:--${ename} 无法解析`); continue }
    const results = backdrops.map(([label, bg]) => [label, contrast(color, bg)])
    const worst = results.reduce((a, b) => (b[1] < a[1] ? b : a))
    if (worst[1] < 4.5) {
      fail(
        `${name}主题:--${tname} 在「${worst[0]}」底上只有 ${worst[1].toFixed(2)}:1,低于 AA 4.5:1` +
          `(常态面板 ${contrast(color, pane).toFixed(2)})。文字色必须在它可能落到的最差底上达标(§5.3)`
      )
    }
  }

  // v4.2:实心填充上的字。暗色主题色是爱马仕橙 `#F37021`,白字在它上面只有 2.97:1,
  // 所以 --on-accent-strong 必须跟 --accent-strong 一起按主题取值,组件里不许写 text-white。
  for (const bgk of ['accent-strong', 'accent-hover']) {
    const f = rgba(resolve(block, 'on-accent-strong'))
    const g = rgba(resolve(block, bgk))
    if (!f || !g) { fail(`${name}主题:--on-accent-strong 或 --${bgk} 无法解析`); continue }
    const r = contrast(f, g)
    if (r < 4.5) {
      fail(`${name}主题:--on-accent-strong 落在 --${bgk} 实心填充上只有 ${r.toFixed(2)}:1(§5.4-主题色)`)
    }
  }

  // v4.2:danger 是一个"承载白字的实心填充"(Button 的 danger 变体、Chip 角标、AudioTagMenu),
  // 所以白字必须达标。v4.1 的浅 #E5484D / 暗 #F2666B 分别只有 3.91 / 3.05,两个都不合格。
  {
    const d = rgba(resolve(block, 'danger'))
    if (!d) fail(`${name}主题:--danger 无法解析`)
    else {
      const r = contrast({ r: 255, g: 255, b: 255, a: 1 }, d)
      if (r < 4.5) {
        fail(`${name}主题:--danger 上的白字只有 ${r.toFixed(2)}:1(§5.4 danger 两主题统一为 #DA3733)`)
      }
      // 并锁住色相,红线本身:B > G 就是"玫红"的成因(v4.1 两个值都差了 5),
      // 在深色画布上尤其明显——用户报的就是这个。
      if (d.b > d.g) {
        fail(`${name}主题:--danger 蓝通道 ${d.b} 高于绿通道 ${d.g},会读成玫红而非正红(§5.4)`)
      }
    }
  }

  // v4.1: 欢迎页词汇轮播的装饰色族。它是装饰,但一样要能看清,不放水。
  // 七个色相必须明暗各一套 -- 只定义浅色会让暗色主题静默回落到继承值。
  // hero 是欢迎页的非交互标题,按 Welcome.tsx:90 它在 `.mat-panel` 里——不落卡片、
  // 不落按下态、不落选中 tint。按实际用法给底,不做全交叉。
  for (let i = 1; i <= 7; i++) {
    const color = rgba(resolve(block, `hero-${i}`))
    if (!color) { fail(`${name}主题:--hero-${i} 缺失(§5.10 要求明暗各一套七个值)`); continue }
    const heroBackdrops = [
      ['面板', pane],
      ['hover@面板', tintOn('surface-hover', pane)],
      ['active@面板', tintOn('surface-active', pane)],
      ['accent-soft@面板', tintOn('accent-soft', pane)],
    ]
    const results = heroBackdrops.map(([label, bg]) => [label, contrast(color, bg)])
    const worst = results.reduce((a, b) => (b[1] < a[1] ? b : a))
    if (worst[1] < 4.5) {
      fail(`${name}主题:--hero-${i} 在「${worst[0]}」底上只有 ${worst[1].toFixed(2)}:1,低于 4.5:1(§5.10)`)
    }
  }
}

// ---------- 7. 12px 交互控件提示 ----------

for (const { path, lines } of sources) {
  lines.forEach((line, i) => {
    if (/\btext-xs\b/.test(line) && /(?:cursor-pointer|rounded-full.*(?:px-|py-))/.test(line) && /<(?:button|Button|Segmented)/.test(line)) {
      warn(`${path}:${i + 1}  疑为 12px 交互控件(§5.12-12 控件文字应为 body/14px)`)
    }
  })
}

// ---------- 8. 图标按钮必须有 hover 文案(v4.1) ----------
// 纯图标按钮光看图标看不出功能,必须有文案。本仓库的统一做法是用
// <Tooltip label="…"> 包一层(aria-label 仍保留,那是给无障碍的,肉眼看不见)。
//
// 找开标签的结尾不能用 indexOf('>'):onClick={e => …} 里的箭头就带 '>',
// 会把标签截断在属性中间,导致**带箭头回调的按钮全被漏掉**(假阴性)。
// 必须跟踪引号与花括号深度。
const endOfOpenTag = s => {
  let depth = 0
  let quote = null
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]
    if (quote) { if (ch === quote && s[i - 1] !== '\\') quote = null; continue }
    if (ch === '"' || ch === "'" || ch === '`') { quote = ch; continue }
    if (ch === '{') depth++
    else if (ch === '}') depth--
    else if (ch === '>' && depth === 0) return i
  }
  return -1
}

for (const { path, lines } of sources) {
  const src = lines.join('\n')
  const re = /<button\b[\s\S]*?<\/button>/g
  let m
  while ((m = re.exec(src))) {
    const b = m[0]
    const tagEnd = endOfOpenTag(b)
    if (tagEnd < 0) continue
    const inner = b.slice(tagEnd + 1, b.lastIndexOf('</button>'))
    if (!/<[A-Za-z]/.test(inner)) continue
    // 花括号里可能出现文字(三元、children 透传、展开),静态判不准就别报
    if (/\{[^}]*["'`]/.test(inner) || /\{[^}]*children/.test(inner) || /\{[^}]*\.\.\./.test(inner)) continue
    // 同一类漏报:{p.name} / {n.label} / {item.label} 会把 props 当文字渲染出来,
    // 但剥掉花括号后看着像"纯图标"。凡是「{标识符.属性…」或「{标识符}」一律跳过。
    if (/\{\s*[a-zA-Z_$][\w$]*\s*[.[]/.test(inner) || /\{\s*[a-zA-Z_$][\w$]*\s*\}/.test(inner)) continue
    const text = inner.replace(/<[^>]*>/g, '').replace(/\{[^}]*\}/g, '').trim()
    if (text) continue
    const before = src.slice(Math.max(0, m.index - 300), m.index)
    const wrapped = before.lastIndexOf('<Tooltip') > before.lastIndexOf('</Tooltip>')
    if (!wrapped && !/\stitle=/.test(b)) {
      const line = src.slice(0, m.index).split('\n').length
      warn(`${path}:${line}  图标按钮缺 hover 文案(§5.9-1:用 <Tooltip label> 包一层)`)
    }
  }
}

// ---------- 9. 词汇轮播:词数与配色数必须一一对应 ----------
// 加了词忘了加色(或加了色没接到词上)静态看不出来:那一个会继承 h1 的 text-ink,
// 轮播到它时颜色"消失",而肉眼很容易把它归因成动画抽帧。
const welcome = read('src/components/Welcome.tsx')
const reelBlock = (welcome.match(/const REEL_WORDS[^=]*=\s*\[([\s\S]*?)\n\]/) || [])[1]
if (!reelBlock) {
  fail('词汇轮播:找不到 REEL_WORDS 定义(改了结构就要同步这条检查)')
} else {
  // v2.1.4 起 REEL_WORDS 存 MessageKey(key:)而非字面量(text:)——两种形态都认,
  // 迁移前后这条检查都有效。
  const words = Math.max((reelBlock.match(/key:\s*'/g) || []).length, (reelBlock.match(/text:\s*'/g) || []).length)
  const hues = [...reelBlock.matchAll(/text-hero-(\d+)/g)].map(m => Number(m[1]))
  if (words !== hues.length) fail(`词汇轮播:${words} 个词但只接了 ${hues.length} 个配色(text-hero-*)`)
  const strict = [...hues].sort((a, b) => a - b)
  for (let i = 0; i < strict.length; i++) {
    if (strict[i] !== i + 1) { fail(`词汇轮播:配色编号应从 hero-1 连续排到 hero-${words},实际是 ${strict.join('/')}`); break }
  }
}

// ---------- 10. 文本指针:两个主题只许颜色不同(v4.3.4) ----------
// 指针是 data URI,而 data URI **没法插值 var()**、指针图片也**继承不到 currentColor**,
// 所以"按主题换色"只能把整张 SVG 写两遍 —— 这是本仓库唯一一处必须复制的设计取值。
// 复制的代价就是会漂移:改了亮色的粗细却忘了暗色,于是两个主题的指针一个粗一个细,
// 而这件事**没有任何测量项会去问**(和"下拉在哪"同类)。所以门禁在这里只看一件事:
// 把两边的颜色抹掉之后,剩下的字符串必须一字不差。
{
  const seen = THEMES.map(t => ({ name: t.name, v: resolve(t.block, 'cursor-text') }))
  const missing = seen.filter(s => !s.v)
  if (missing.length) {
    fail(`文本指针:${missing.map(m => m.name).join(' / ')} 主题没有 --cursor-text`)
  } else {
    // 只保留"形状"部分:去掉两处 %23RRGGBB(填色与描边),其余必须相同。
    const shape = v => v.replace(/%23[0-9a-fA-F]{6}/g, '%23COLOR').replace(/\s+/g, ' ')
    const [a, b] = seen
    if (shape(a.v) !== shape(b.v)) {
      fail(`文本指针:两个主题除了颜色还有别的差异(几何必须完全一致,否则一边粗一边细)\n        浅色 ${shape(a.v)}\n        暗色 ${shape(b.v)}`)
    }
    // 而且两边的颜色必须真的不同 —— 只复制粘贴没改颜色的话,上面那条是绿的。
    const colours = v => (v.match(/%23[0-9a-fA-F]{6}/g) || []).map(c => c.toUpperCase())
    const [ca, cb] = [colours(a.v), colours(b.v)]
    if (ca.length !== 2) fail(`文本指针:浅色应当有"填色 + 描边"两个颜色,解析到 ${ca.length} 个`)
    if (cb.length !== 2) fail(`文本指针:暗色应当有"填色 + 描边"两个颜色,解析到 ${cb.length} 个`)
    if (ca.join() === cb.join()) fail('文本指针:两个主题的颜色一模一样(暗色忘了换成主题橙?)')
    // 填色必须**就是**该主题的 --accent。这是"主题色指针"这句话能被检查的那一半。
    for (const [i, t] of THEMES.entries()) {
      const accent = resolve(t.block, 'accent')
      const fill = (t.block.match(/--cursor-text\s*:[^;]*?fill='%23([0-9a-fA-F]{6})'/) || [])[1]
      if (!fill) { fail(`文本指针:${t.name} 解析不出填色`); continue }
      if (!accent) { fail(`文本指针:${t.name} 解析不出 --accent`); continue }
      if ('#' + fill.toUpperCase() !== accent.toUpperCase()) {
        fail(`文本指针:${t.name} 的填色 #${fill} 不等于该主题的 --accent ${accent}(指针必须用主题色)`)
      }
    }
    // 热点必须落在竖条里,否则指针的"尖"会偏出去,点哪儿和看起来点在哪儿不一致。
    const hot = (a.v.match(/\)\s*(\d+)\s+(\d+)\s*,\s*text/) || []).slice(1, 3).map(Number)
    if (hot.length !== 2) fail('文本指针:解析不出热点坐标(url(...) x y, text)')
    else {
      const rect = (a.v.match(/x='([\d.]+)' y='([\d.]+)' width='([\d.]+)' height='([\d.]+)'/) || []).slice(1).map(Number)
      if (rect.length !== 4) fail('文本指针:解析不出竖条几何')
      else {
        const [x, y, w, h] = rect
        const [hx, hy] = hot
        if (hx < x || hx > x + w || hy < y || hy > y + h) {
          fail(`文本指针:热点 ${hx},${hy} 落在竖条 ${x}..${x + w} x ${y}..${y + h} 之外`)
        }
      }
    }
    // 降级项必须是 text:SVG 万一被平台拒绝,丢的是效果,不能连"这里是文本框"一起丢。
    if (!/,\s*text$/.test(a.v.trim())) fail('文本指针:末尾的降级项必须是 text(图片被拒时不能连 I 形光标一起丢)')
  }
}

// ---------- 报告 ----------
for (const w of warnings) console.log(`WARN  ${w}`)
for (const f of failures) console.log(`FAIL  ${f}`)

const tierSummary = [...iconSizes.entries()]
  .sort((a, b) => a[0] - b[0])
  .map(([size, list]) => `${size}px×${list.length}`)
  .join('  ')

if (failures.length) {
  console.log(`\ndesign:check 失败:${failures.length} 项`)
  process.exit(1)
}
console.log(`图标档位:${tierSummary}`)
console.log(`\ndesign:check 通过(${warnings.length} 条提示)`)
