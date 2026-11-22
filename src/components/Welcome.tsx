import { useEffect, useState } from 'react'
import { AudioLines, Mic, ScanFace } from 'lucide-react'
import type { Tool } from '../App'
import { WordReel, type ReelWord } from './ui/WordReel'
import { useI18n, type MessageKey } from '../i18n/react'

const ACTIONS: { tool: Tool; labelKey: MessageKey; descKey: MessageKey; icon: typeof Mic }[] = [
  { tool: 'clone', labelKey: 'nav.clone', descKey: 'ui.welcomeCloneDesc', icon: ScanFace },
  { tool: 'tts', labelKey: 'nav.tts', descKey: 'ui.welcomeTtsDesc', icon: AudioLines },
  { tool: 'asr', labelKey: 'nav.asr', descKey: 'ui.welcomeAsrDesc', icon: Mic },
]

// The hero cycles through seven capabilities, one hue each. Order matters: it reads
// as a tour of what the tool does. Colours come from the decorative --hero-* family,
// NOT the semantic one - see the invariant in DESIGN.md 5.10.
// The hue ASSIGNMENT is also ordered on purpose: neighbours are permuted to maximise
// the worst-case colour difference, so each flip reads as a change and not as a step
// along a gradient. Do not "tidy" this back into hue order - see DESIGN.md 5.10-一.
const REEL_WORDS: { key: MessageKey; className: string }[] = [
  { key: 'ui.reelCreate', className: 'text-hero-1' },
  { key: 'ui.reelClone', className: 'text-hero-2' },
  { key: 'ui.reelGenerate', className: 'text-hero-3' },
  { key: 'ui.reelPerform', className: 'text-hero-4' },
  { key: 'ui.reelRecite', className: 'text-hero-5' },
  { key: 'ui.reelRecognize', className: 'text-hero-6' },
  { key: 'ui.reelImitate', className: 'text-hero-7' },
]

const REEL_INTERVAL_MS = 2000

/** Track the OS "reduce motion" setting so the reel can hold still entirely. */
function usePrefersReducedMotion() {
  const [still, setStill] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const apply = () => setStill(mq.matches)
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [])
  return still
}

// 欢迎页(豆包式):居中欢迎语 + 三个功能入口,可横向滑动
export function Welcome({ onSelect }: { onSelect: (t: Tool) => void }) {
  const { t: tr } = useI18n()
  const still = usePrefersReducedMotion()
  const [reelIndex, setReelIndex] = useState(0)
  const [reelInstant, setReelInstant] = useState(false)
  const [reelHoldMs, setReelHoldMs] = useState(REEL_INTERVAL_MS)

  // Step one word at a time. Landing on words.length means the clone of the first
  // word is on screen, so hold and let the transition end finish the loop.
  useEffect(() => {
    if (still || reelIndex >= REEL_WORDS.length) return
    const t = window.setTimeout(() => {
      setReelIndex(v => v + 1)
      setReelHoldMs(REEL_INTERVAL_MS)
    }, reelHoldMs)
    return () => window.clearTimeout(t)
  }, [reelIndex, reelHoldMs, still])

  // Re-arm the transition one frame after the snap-back. Without this the track would
  // stay transition-less and every later step would jump instead of slide.
  useEffect(() => {
    if (!reelInstant) return
    let second = 0
    const first = window.requestAnimationFrame(() => {
      second = window.requestAnimationFrame(() => setReelInstant(false))
    })
    return () => {
      window.cancelAnimationFrame(first)
      window.cancelAnimationFrame(second)
    }
  }, [reelInstant])

  const handleSlideEnd = (elapsedMs: number) => {
    if (reelIndex < REEL_WORDS.length) return
    // The clone of word 0 has already been on screen for the whole slide, so shorten
    // the hold that follows by exactly that much. Without it 创造 stays up ~600ms
    // longer than every other word and the rhythm hitches once per cycle.
    setReelHoldMs(Math.max(300, REEL_INTERVAL_MS - elapsedMs))
    setReelIndex(0)
    setReelInstant(true)
  }

  // The reel is aria-hidden, so the heading carries the sentence as its accessible
  // name. Without this a screen reader would announce all seven words in a row.
  const currentWord = tr(REEL_WORDS[reelIndex % REEL_WORDS.length].key)

  return (
    <div className="mat-panel h-full flex flex-col items-center justify-center gap-10 mat-clip">
      <div className="text-center px-6">
        <h1
          className="text-3xl font-semibold text-ink tracking-[-0.01em]"
          aria-label={tr('ui.welcomeHeroAria', { word: currentWord })}
        >
          <span aria-hidden="true">{tr('ui.welcomeHeroPrefix')}</span>
          <WordReel
            words={REEL_WORDS.map(w => ({ text: tr(w.key), className: w.className }))}
            index={still ? 0 : reelIndex}
            instant={reelInstant}
            onSlideEnd={handleSlideEnd}
          />
          <span aria-hidden="true">{tr('ui.welcomeHeroSuffix')}</span>
        </h1>
        <p className="text-sm text-ink-2 mt-2.5">{tr('ui.welcomeTagline')}</p>
      </div>

      {/* The padding here is not spacing -- it is ROOM FOR THE SHADOW, and the negative
          margins pull it straight back so it costs no layout at all (the cards do not
          move a pixel; verified by measuring the card's rect before and after).
          Why it is needed: `overflow-x-auto` makes this row a scroll container, and a
          scroll container clips BOTH axes -- `overflow-y: visible` next to a non-visible
          `overflow-x` computes to `auto` per spec, so there is no way to clip one axis and
          not the other. `hover:shadow-lg` is `0 16px 44px` plus a 2px contact layer, which
          needs 44px to each side, 28px above and 60px below, while the row had
          `px-6 py-1` = 24px and 4px. The shadow was cut off in a straight line. Measured:
          with 24px of room the pixels 30-46px to the left of a hovered card were pure
          scene (246,250,255); with the room below they are (241,245,251) and
          (244,248,253) -- real shadow that was being thrown away.
          The numbers are the shadow token's own reach, sized for whichever theme reaches
          FARTHER, not for the average: light's `--shadow-lg` is `0 16px 44px` (44 sides /
          28 up / 60 down) but dark's is still `0 24px 64px` (64 / 40 / 88). So the padding
          is the dark numbers. Taking the light ones would have quietly re-clipped dark --
          the two themes do not share a hover shadow. If `--shadow-lg` grows in EITHER
          theme, these have to grow with it, and the assertion in the pixel probe only
          checks padding against margin BALANCE, not that the reach still fits, so
          re-measure the profile beside a hovered card after touching the token. */}
      <div className="flex items-stretch gap-3 max-w-full overflow-x-auto px-16 pt-10 pb-24 -mx-16 -mt-10 -mb-24">
        {ACTIONS.map(a => (
          <button
            key={a.tool}
            type="button"
            onClick={() => onSelect(a.tool)}
            className="mat-card group w-[190px] shrink-0 p-4 text-center cursor-pointer transition-shadow duration-200 ease-out hover:shadow-lg"
          >
            {/* The hover feedback is light and shadow, never movement.
                v4.3.1 had `hover:-translate-y-0.5` here, and it read as the card and its
                own contents coming apart: a transform that runs over 100ms passes through
                fractional offsets, so the label and the icon are re-rasterised at a new
                subpixel position every frame while the card's own edges settle last. The
                card appears to slide out from under its text. Lift is a shadow idea --
                so the shadow now carries it (`--shadow-lg` is `0 16px 44px` plus a tight
                contact layer, against `--shadow-card`'s `0 6px 18px` at rest) and the card
                itself never moves. Its own pointer light does the rest. */}
            <a.icon
              size={36}
              className="text-accent mx-auto mb-3 transition-transform duration-300 ease-out group-hover:scale-110 group-hover:-rotate-6"
            />
            <p className="text-xl font-semibold text-accent tracking-[-0.01em]">{tr(a.labelKey)}</p>
            <p className="text-sm text-ink-2 mt-0.5">{tr(a.descKey)}</p>
          </button>
        ))}
      </div>
    </div>
  )
}
