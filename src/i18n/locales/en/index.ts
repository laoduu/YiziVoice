// en catalog — merged from fragments. core.ts types this against zh-CN keys,
// so a missing translation surfaces as a compile error in the fragment files
// (`Record<MessageKey, string>` on each fragment would be too strict while
// keys are being added in parallel; the aggregate is checked in core.ts).
import { common } from './common'
import { tts } from './tts'
import { clone } from './clone'
import { asr } from './asr'
import { settings } from './settings'
import { tutorial } from './tutorial'
import { about } from './about'
import { history } from './history'
import { ui } from './ui'
import { errors } from './errors'
import { services } from './services'
import { update } from './update'

export const en: Record<string, string> = {
  ...common,
  ...tts,
  ...clone,
  ...asr,
  ...settings,
  ...tutorial,
  ...about,
  ...history,
  ...ui,
  ...errors,
  ...services,
  ...update,
}
