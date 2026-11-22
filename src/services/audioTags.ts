import { loadOpeningTags, loadInlineTags } from './configService'
import type { AudioTagCategory } from './configTypes'

export type { AudioTagCategory } from './configTypes'

// 缓存标签数据
let cachedOpeningTags: AudioTagCategory[] | null = null
let cachedInlineTags: AudioTagCategory[] | null = null

export async function getOpeningTags(): Promise<AudioTagCategory[]> {
  if (cachedOpeningTags) return cachedOpeningTags
  const config = await loadOpeningTags()
  cachedOpeningTags = config.categories
  return cachedOpeningTags
}

export async function getInlineTags(): Promise<AudioTagCategory[]> {
  if (cachedInlineTags) return cachedInlineTags
  const config = await loadInlineTags()
  cachedInlineTags = config.categories
  return cachedInlineTags
}

export function clearTagCache(): void {
  cachedOpeningTags = null
  cachedInlineTags = null
}
