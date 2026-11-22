export interface ReelWord {
  text: string
  /** Decorative hue class from the --hero-* family (DESIGN.md 5.10). */
  className: string
}

/**
 * Welcome-hero word reel. Lays every word out in a column, one per row, and slides
 * the column up by exactly one row per step -- that slide IS the "flip up".
 *
 * Two things are load-bearing:
 *   1. A clone of the first word is appended. Without it, looping from the last word
 *      back to the first would visibly rewind the column through all seven words.
 *      `index === words.length` therefore means "showing the clone"; the parent
 *      snaps back to 0 on the transition end.
 *   2. Every word is two CJK glyphs wide, so the slot never resizes and the sentence
 *      around it cannot reflow mid-animation.
 *
 * Purely presentational: the parent owns the index and the timer, because it also
 * has to build the accessible name and honour prefers-reduced-motion.
 */
export function WordReel({
  words,
  index,
  instant,
  onSlideEnd,
}: {
  words: ReelWord[]
  index: number
  /** Render the current position without animating (used for the loop snap-back). */
  instant?: boolean
  /**
   * Fires when a slide finishes, with how long it took in ms. The caller needs that
   * number to shorten the hold after a wrap, so it does not have to duplicate the
   * CSS duration as a constant.
   */
  onSlideEnd?: (elapsedMs: number) => void
}) {
  const items = [...words, words[0]]

  return (
    <span className="word-reel" aria-hidden="true">
      <span
        className="word-reel-track"
        style={{
          // Multiply the row height rather than using translateY(-N * 100%): a
          // percentage resolves against the track's own height, which is every row
          // stacked, so -100% would scroll the whole column off screen.
          transform: `translateY(calc(var(--reel-item-h) * ${-index}))`,
          transition: instant ? 'none' : undefined,
        }}
        onTransitionEnd={e => onSlideEnd?.(e.elapsedTime * 1000)}
      >
        {items.map((w, i) => (
          <span key={`${w.text}-${i}`} className={`word-reel-item ${w.className}`}>
            {w.text}
          </span>
        ))}
      </span>
    </span>
  )
}
