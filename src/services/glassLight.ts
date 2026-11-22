// Pointer-tracked specular light for the liquid-glass materials.
//
// Why this needs JavaScript: a highlight that follows the cursor cannot be expressed
// in CSS, because CSS has no access to the pointer position. The obvious alternative
// -- an overlay element translated to the cursor -- would need `overflow: hidden` on
// every card, and cards host dropdowns and tooltips that must be allowed to escape.
// Writing two custom properties and letting a radial-gradient read them keeps the
// light inside the box with no clipping, no extra DOM and no layout impact.
//
// Cost control, in order of how much each one is worth:
//
// 1. Measure the element's rect ONCE per entry, not per event. Written naively --
//    `getBoundingClientRect()` inside the move handler -- every event forces a
//    synchronous style flush, because the previous frame's write already dirtied the
//    element's style (custom properties inherit, so the whole subtree is dirty). The
//    event fires far faster than frames, so that is several forced recalcs per frame
//    for a number that has not moved. Measured over CDP: 8 events/frame cost 38.9ms
//    per frame that way. The cache is refreshed on scroll and resize, which are the
//    only things that move an element under a stationary pointer.
// 2. Coalesce the write into a rAF, so a burst of events produces one style write.
// 3. Skip the write when the position has not actually changed.
//
// The light is deliberately NOT on .mat-panel. Measured over CDP it costs one
// backdrop-filter re-raster per frame, and on a panel that price would be permanent --
// the cursor rests over a panel essentially all the time, so the light would be visible
// and repainting continuously. Cards are discrete surfaces you point AT, so the cost is
// occasional, and that is also the reading the effect wants. See index.css for the
// measurements (which come from a machine with no GPU, so only the relationships hold).
const TRACKED = '.mat-card, .mat-overlay'

// Text-entry controls never get the light, and this is a correctness rule rather than a
// taste one. The light is painted by ::before at inset:0, i.e. ABOVE the element's own
// contents -- and it is at full strength exactly at the cursor. Over a textarea that puts
// a bright patch over the caret and over the I-beam cursor itself, which is the one place
// in the app where the pointer's own glyph is the thing you are aiming with. The user hit
// this immediately ("鼠标的编辑指针都看不到了") while editing a prompt.
//
// So the light is not dimmed there, it is PARKED: --glass-x/-y go back off-box. Dimming
// would not do, because the surface genuinely is still hovered and the gradient would
// still be centred on the cursor.
//
// The list is "where the browser shows an I-beam", so checkbox/radio/range/button-ish
// inputs are excluded from it: aiming at a checkbox is not a text task and those do not
// want a cursor kept visible. contenteditable is included because it is a text field that
// happens not to be an <input>.
const TEXT_ENTRY = [
  'textarea',
  '[contenteditable=""]',
  '[contenteditable="true"]',
  'input:not([type="button"]):not([type="submit"]):not([type="reset"])' +
    ':not([type="checkbox"]):not([type="radio"]):not([type="range"])' +
    ':not([type="file"]):not([type="color"])',
].join(', ')

// The reach of the light has to be relative to the thing it lands on, not a fixed 300px.
// Measured by reading rendered pixels: on a 190x150 welcome card a 300px radius covers
// the whole card, so the light stops reading as a spot that follows the cursor and
// becomes an overall tint change -- the corners landed within 11 levels of the centre.
// Capping the radius at ~70% of the shorter side guarantees a visible falloff INSIDE
// every element, whatever its size. The 60px floor keeps a small tooltip (125x26) from
// getting a 18px pinpoint, where the gradient would be gone before the edges are.
//
// The theme token stays the UPPER bound, so it keeps meaning something: the fit only
// ever shrinks the reach, never grows it. Read from <html>, never from the element --
// the element carries the fitted value inline, so reading it back would feed the fit
// its own output and the light would shrink a little more on every re-entry.
const REACH_RATIO = 0.7
const REACH_MIN = 60
const REACH_VAR = '--glass-light'

export function installGlassLight(): () => void {
  let frame = 0
  let pending: { el: HTMLElement; x: number; y: number } | null = null
  let last: HTMLElement | null = null
  let rect: DOMRect | null = null
  let wrote = { x: NaN, y: NaN }

  // The rim light is always on -- it lives on the shared ::after, which cannot be
  // hover-gated -- so a stale position would leave a bright arc parked on a card the
  // cursor has already left. Park left elements back off-box instead.
  const park = (el: HTMLElement) => {
    el.style.setProperty('--glass-x', '-9999px')
    el.style.setProperty('--glass-y', '-9999px')
  }

  // Fit the light to the element. Done on entry, next to the rect read, so it costs
  // nothing per frame -- and it is a style WRITE, so it is batched into the same rAF as
  // the position rather than forced synchronously here.
  const fit = (el: HTMLElement, r: DOMRect) => {
    const base = parseFloat(getComputedStyle(document.documentElement).getPropertyValue(REACH_VAR)) || 300
    const reach = Math.min(base, Math.max(REACH_MIN, REACH_RATIO * Math.min(r.width, r.height)))
    el.style.setProperty(REACH_VAR, `${Math.round(reach)}px`)
  }

  const remeasure = () => {
    if (!last) return
    rect = last.getBoundingClientRect()
    fit(last, rect)
  }

  const flush = () => {
    frame = 0
    if (!pending) return
    const { el, x, y } = pending
    pending = null
    if (x === wrote.x && y === wrote.y) return
    wrote = { x, y }
    el.style.setProperty('--glass-x', `${x.toFixed(1)}px`)
    el.style.setProperty('--glass-y', `${y.toFixed(1)}px`)
  }

  const onMove = (e: PointerEvent) => {
    // Touch has no hover state to light up.
    if (e.pointerType === 'touch') return
    const target = e.target
    if (!(target instanceof Element)) return
    // Over a text field: put the light away and forget the element, so that stepping back
    // out onto the card re-measures and re-fits instead of reusing a stale rect. Dropping
    // `last` is also what makes the park stick -- the field can be typed in for minutes
    // with no further pointer moves, and nothing must relight the surface meanwhile.
    if (target.closest(TEXT_ENTRY)) {
      if (last) park(last)
      last = null
      rect = null
      return
    }
    const el = target.closest(TRACKED)
    if (!(el instanceof HTMLElement)) return
    if (el !== last) {
      if (last) park(last)
      last = el
      rect = el.getBoundingClientRect()
      fit(el, rect)
      wrote = { x: NaN, y: NaN }
    }
    if (!rect) return
    pending = { el, x: e.clientX - rect.left, y: e.clientY - rect.top }
    if (!frame) frame = requestAnimationFrame(flush)
  }

  document.addEventListener('pointermove', onMove, { passive: true })
  // `capture` because scroll does not bubble out of scroll containers.
  document.addEventListener('scroll', remeasure, { capture: true, passive: true })
  window.addEventListener('resize', remeasure)
  return () => {
    document.removeEventListener('pointermove', onMove)
    document.removeEventListener('scroll', remeasure, { capture: true })
    window.removeEventListener('resize', remeasure)
    if (frame) cancelAnimationFrame(frame)
    if (last) park(last)
    last = null
    rect = null
  }
}
