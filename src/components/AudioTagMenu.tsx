import { useState, useEffect } from 'react'
import { Plus, X, Check } from 'lucide-react'
import { getOpeningTags, getInlineTags, clearTagCache } from '../services/audioTags'
import { saveOpeningTags, saveInlineTags } from '../services/configService'
import type { AudioTagCategory } from '../services/configTypes'
import { Tooltip } from './ui/Tooltip'

interface TagPickerPanelProps {
  type: 'opening' | 'inline'
  onInsert: (tag: string) => void
}

// 标签选择面板(受控展开,内容由父级工具条按钮触发);保留自定义标签增删能力
export function TagPickerPanel({ type, onInsert }: TagPickerPanelProps) {
  const [categories, setCategories] = useState<AudioTagCategory[]>([])
  const [addingCategory, setAddingCategory] = useState<string | null>(null)
  const [newTagValue, setNewTagValue] = useState('')

  useEffect(() => {
    async function loadTags() {
      const cats = type === 'opening' ? await getOpeningTags() : await getInlineTags()
      setCategories(cats)
    }
    loadTags()
  }, [type])

  const handleTagClick = (tag: string) => {
    onInsert(tag)
    setAddingCategory(null)
  }

  const handleAddCustom = async (categoryName: string) => {
    if (!newTagValue.trim()) return
    const newCategories = categories.map(cat =>
      cat.name === categoryName ? { ...cat, tags: [...cat.tags, newTagValue.trim()] } : cat,
    )
    setCategories(newCategories)
    clearTagCache()
    if (type === 'opening') await saveOpeningTags(newCategories)
    else await saveInlineTags(newCategories)
    setNewTagValue('')
    setAddingCategory(null)
  }

  const handleRemoveCustom = async (categoryName: string, tag: string) => {
    const newCategories = categories.map(cat =>
      cat.name === categoryName ? { ...cat, tags: cat.tags.filter(t => t !== tag) } : cat,
    )
    setCategories(newCategories)
    clearTagCache()
    if (type === 'opening') await saveOpeningTags(newCategories)
    else await saveInlineTags(newCategories)
  }

  return (
    <div className="mat-card p-4 max-h-[280px] overflow-y-auto space-y-3 animate-pop-in">
      {categories.map(cat => (
        <div key={cat.name} className="flex items-start gap-2.5">
          <span className="text-xs font-medium whitespace-nowrap pt-1.5 text-ink-2" style={{ minWidth: 60 }}>
            {cat.name}
          </span>
          <div className="flex flex-wrap gap-1.5 flex-1 items-center">
            {cat.tags.map(tag => (
              <span
                key={tag}
                className={`group relative inline-flex items-center rounded-full text-sm transition-all select-none ${
                  cat.builtin
                    ? 'bg-accent-soft text-accent hover:brightness-95'
                    : 'bg-accent-2-soft text-accent-2-text hover:brightness-95'
                }`}
              >
                {/* The tag itself is the control, so it is a real <button> (Tab reaches it and
                    Enter/Space insert it) — it used to be a span with onClick. The delete badge
                    is a *sibling* button: nesting a button inside a button is invalid HTML. */}
                <button
                  type="button"
                  onClick={() => handleTagClick(tag)}
                  className="px-2.5 py-1 rounded-full cursor-pointer"
                >
                  {tag}
                </button>
                {!cat.builtin && (
                  <span className="absolute -top-1.5 -right-1.5 flex">
                    <Tooltip label="删除标签">
                      <button
                        type="button"
                        aria-label={`删除标签 ${tag}`}
                        onClick={() => handleRemoveCustom(cat.name, tag)}
                        className="w-4 h-4 rounded-full bg-danger text-white leading-none grid place-items-center opacity-0 group-hover:opacity-100 group-has-[:focus-visible]:opacity-100 transition-opacity cursor-pointer"
                      >
                        <X size={12} strokeWidth={3} />
                      </button>
                    </Tooltip>
                  </span>
                )}
              </span>
            ))}
            {addingCategory === cat.name ? (
              <span className="inline-flex items-center gap-1">
                <input
                  className="text-sm px-2.5 py-1 rounded-full border border-line bg-surface-2 text-ink outline-none focus:border-accent w-[96px]"
                  placeholder="新标签"
                  value={newTagValue}
                  onChange={e => setNewTagValue(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleAddCustom(cat.name)
                    if (e.key === 'Escape') { setAddingCategory(null); setNewTagValue('') }
                  }}
                  autoFocus
                  onClick={e => e.stopPropagation()}
                />
                <Tooltip label="确认添加">
                  <button
                    type="button"
                    aria-label="确认添加"
                    className="w-6 h-6 rounded-full grid place-items-center bg-accent-strong text-accent-on hover:bg-accent-hover cursor-pointer"
                    onClick={e => { e.stopPropagation(); handleAddCustom(cat.name) }}
                  >
                    <Check size={12} strokeWidth={3} />
                  </button>
                </Tooltip>
              </span>
            ) : (
              <button
                type="button"
                aria-label="添加自定义标签"
                title="添加自定义标签"
                className="inline-flex items-center justify-center w-6 h-6 rounded-full text-sm cursor-pointer transition-all bg-surface-hover text-accent hover:bg-accent-soft"
                onClick={e => {
                  e.stopPropagation()
                  setAddingCategory(cat.name)
                  setNewTagValue('')
                }}
              >
                <Plus size={12} />
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
