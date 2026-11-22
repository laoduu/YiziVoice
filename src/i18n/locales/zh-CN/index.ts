// zh-CN catalog — key source of truth. Fragment files are merged here;
// `MessageKey = keyof typeof zhCN` in core.ts derives from this object.
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

export const zhCN = {
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
} as const
