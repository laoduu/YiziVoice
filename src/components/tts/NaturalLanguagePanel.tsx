import { useState } from 'react'
import { Trash2, Sparkles, Loader2, Wand2 } from 'lucide-react'
import { Textarea } from '../ui/Input'
import { useToast } from '../Toast'
import { textGenerate, getApiErrorMessage } from '../../services/mimoApi'

export type NlMode = 'paragraph' | 'director'

export interface NaturalLanguageState {
  nlMode: NlMode
  setNlMode: (v: NlMode) => void
  nlParagraph: string
  setNlParagraph: (v: string) => void
  nlRole: string
  setNlRole: (v: string) => void
  nlScene: string
  setNlScene: (v: string) => void
  nlDirection: string
  setNlDirection: (v: string) => void
  setText: (v: string) => void
  text: string   // 朗读文本现状:示例 chip 据此决定要不要覆盖
}

export function useNaturalLanguageState(): NaturalLanguageState {
  const [nlMode, setNlMode] = useState<NlMode>('paragraph')
  const [nlParagraph, setNlParagraph] = useState('')
  const [nlRole, setNlRole] = useState('')
  const [nlScene, setNlScene] = useState('')
  const [nlDirection, setNlDirection] = useState('')
  return {
    nlMode, setNlMode,
    nlParagraph, setNlParagraph,
    nlRole, setNlRole,
    nlScene, setNlScene,
    nlDirection, setNlDirection,
    setText: () => {},
    text: '',
  }
}

const PARAGRAPH_PLACEHOLDER = '描述想要的语气、语速、情绪、年龄感…\n例：用轻快上扬的语调向领导报喜，整体节奏明快，关键数字加重\n也可以输入核心关键字，点击「AI 生成风格描述」'
const DIRECTOR_PLACEHOLDERS = {
  role: '谁在说话？身份、年龄、性格、说话习惯，如：沉稳老练、惜字如金的门阀大当家\n也可以输入核心关键字，点击「AI 生成风格描述」',
  scene: '在哪、和谁、什么情境？越具体越好，如：祠堂议事厅内，列祖列宗牌位之前，家族晚辈环伺\n也可以输入核心关键字，点击「AI 生成风格描述」',
  direction: '怎么说话？语速、停顿、重音、情绪起伏，如：语气威严但带一丝疲惫，关键处停顿加重\n也可以输入核心关键字，点击「AI 生成风格描述」',
}

// —— 示例数据 ——
interface ParagraphExample {
  label: string
  paragraph: string
  text: string
}
interface DirectorExample {
  label: string
  role: string
  scene: string
  direction: string
  text: string
}

const PARAGRAPH_EXAMPLES: ParagraphExample[] = [
  {
    label: '考试少年',
    paragraph: '用轻快上扬的语调向领导报喜，语速稍快，带着查到成绩后压抑不住的激动与小骄傲，声音明亮有活力。\n看着刚解决的难题成果忍不住得意忘形地惊呼，声音高亢明亮，语速偏快，语气中带着满满的自信与难以置信。\n用明亮活泼的青少年嗓音，带着恶作剧得逞后的得意与戏谑，语速偏快且咬字轻巧，在强调赌注时语气微微上扬。',
    text: '嘿嘿，怎么样，我就说我能赢吧，这下你可输定啦！',
  },
]

const DIRECTOR_EXAMPLES: DirectorExample[] = [
  {
    label: '公关总监',
    role: '现代科技企业公关总监，身材圆润相貌平平。用四两拨千斤的幽默把尖锐化为无形。',
    scene: '产品发布会大屏幕突发故障蓝屏，台下百家媒体窃窃私语。她拿着麦克风从后台从容走上舞台。',
    direction: '气息极深胸腔共鸣丰厚，温暖踏实的包裹感。从容不迫中低音，语速适中停顿精准，像喜剧演员抛梗前的留白。咬字圆滑不露锋芒，句末放出一点气声营造亲昵感。声音底色里含着微笑发力的独特共鸣。自我调侃时不慌不忙。',
    text: '大家别慌，大屏幕没坏，它只是被我的颜值震惊得闭上了眼睛。真的，刚才我在后台一探头，它可能觉得屏幕反光照出了我的脸，系统直接触发了最高级别的自我防御机制。不过没关系，既然它罢工了，那就只能由我这个全场长得最安全的人，来给大家讲讲咱们这款新一代安全芯片到底有多靠谱。',
  },
  {
    label: '骄傲明星',
    role: '27岁跌入谷底但拒不认输的顶级流量女星。极度自恋，行事张扬，表面跋扈实则护短真性情。',
    scene: '独立化妆间，当面撕毁经纪公司送来的带侮辱意味的解约合同，并对门外偷听的狗仔和落井下石的助理喊话。',
    direction: '极具攻击性的都市千金腔。全实声明亮穿透力强。咬字锋利脆快狠。句首起调极高，带居高临下的傲慢，句尾因情绪激动砸下重音（尤其四声），字音切得极干脆。情绪翻书般切换，前一秒咬牙切齿，后一秒理直气壮娇纵。提到食物时语速突然放慢，重音在食物名词上，带贪婪鲜活感。',
    text: '你以为断了我的代言，就能让我跪着求你？睁大你的眼睛看看清楚，我是谁。我是沈若星，就算站在泥地里，镜头也只能对准我！把那份解约书拿走，别脏了我的眼。顺便告诉外面那群等着看笑话的狗仔，姑奶奶我现在要去吃炸鸡喝啤酒了，让他们带好闪光灯，给我拍得好看点！',
  },
]

// —— AI 生成风格指令:系统 prompt 与 few-shot 模板 ——

const PARAGRAPH_SYSTEM_PROMPT = `你是 MiMo,小米公司开发的 AI 助手。你的任务是根据用户提供的简短关键字,生成一段用于语音合成的「风格指令」段落。

严格只返回 JSON,不要任何解释、注释、Markdown 代码块。

JSON 格式:
{"paragraph": string}

要求:
- paragraph 字段是 2-4 句中文,每句描述一个音色/语速/情绪/节奏/年龄/气质等维度。
- 用第三人称,聚焦「这个声音听起来像什么、怎么说话」。
- 模仿以下参考示例的语体、长度、专业度与画面感:

参考示例(关键字「考试少年」):
"""
${PARAGRAPH_EXAMPLES[0].paragraph}
"""

不要生成任何播报文本,只输出风格指令 paragraph 字段。`

const DIRECTOR_SYSTEM_PROMPT = `你是 MiMo,小米公司开发的 AI 助手。你的任务是根据用户提供的简短关键字,生成用于语音合成「导演模式」的三个维度描述。

严格只返回 JSON,不要任何解释、注释、Markdown 代码块。

JSON 格式:
{"role": string, "scene": string, "direction": string}

要求:
- role:1-2 句中文,描述人物身份、年龄、性格底色、外形气质或说话习惯。第三人称。
- scene:1-2 句中文,描述此刻的具体场景、与谁对话、情绪处在什么位置。越具体越好。
- direction:2-4 句中文,像导演给演员下达的演绎要领:语速、气息、停顿、重音、共鸣位置、情绪起伏。
- 模仿以下参考示例的语体、专业度与画面感:

参考示例 1(关键字「公关总监」):
role: ${DIRECTOR_EXAMPLES[0].role}
scene: ${DIRECTOR_EXAMPLES[0].scene}
direction: ${DIRECTOR_EXAMPLES[0].direction}

参考示例 2(关键字「骄傲明星」):
role: ${DIRECTOR_EXAMPLES[1].role}
scene: ${DIRECTOR_EXAMPLES[1].scene}
direction: ${DIRECTOR_EXAMPLES[1].direction}

不要生成任何播报文本,只输出三个风格描述字段。`

interface ParagraphResult { paragraph: string }
interface DirectorResult { role: string; scene: string; direction: string }

export function NaturalLanguagePanel(p: NaturalLanguageState) {
  const { showToast } = useToast()

  // An example fills the style description; it must never silently overwrite script text the
  // user already wrote. Empty → fill it (that is the point of an example). Non-empty → keep
  // the user's text and say so, instead of replacing it without a word.
  const applyExampleText = (exampleText: string) => {
    if (!p.text.trim()) p.setText(exampleText)
    else showToast('朗读文本已有内容，示例只填入了风格描述')
  }
  const [aiLoading, setAiLoading] = useState(false)

  const keyword = p.nlMode === 'paragraph' ? p.nlParagraph.trim() : p.nlRole.trim()
  const canAi = keyword.length > 0 && !aiLoading

  const handleAiGenerate = async () => {
    if (!canAi) return
    setAiLoading(true)
    try {
      if (p.nlMode === 'paragraph') {
        const data = await textGenerate<ParagraphResult>({
          system: PARAGRAPH_SYSTEM_PROMPT,
          user: `关键字:${keyword}`,
          maxTokens: 600,
        })
        if (data && typeof data.paragraph === 'string' && data.paragraph.trim()) {
          p.setNlParagraph(data.paragraph.trim())
        } else {
          showToast('AI 返回为空,请换个关键字重试')
        }
      } else {
        const data = await textGenerate<DirectorResult>({
          system: DIRECTOR_SYSTEM_PROMPT,
          user: `关键字:${keyword}`,
          maxTokens: 900,
        })
        if (
          data && typeof data.role === 'string' && typeof data.scene === 'string' &&
          typeof data.direction === 'string'
        ) {
          p.setNlRole(data.role.trim())
          p.setNlScene(data.scene.trim())
          p.setNlDirection(data.direction.trim())
        } else {
          showToast('AI 返回字段缺失,请换个关键字重试')
        }
      }
    } catch (e) {
      showToast(getApiErrorMessage(e))
    } finally {
      setAiLoading(false)
    }
  }

  return (
    <div className="space-y-2.5 animate-pop-in">
      {/* 方式（自由描述 / 导演演绎）由页面顶部那一排统一选择，这里只渲染该方式的输入区 */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 min-w-0 flex-1 min-w-0">
          <span className="text-xs text-ink-3 shrink-0">示例</span>
          {p.nlMode === 'paragraph' ? (
            <ExampleChip label={PARAGRAPH_EXAMPLES[0].label} onClick={() => {
              const ex = PARAGRAPH_EXAMPLES[0]
              p.setNlParagraph(ex.paragraph)
              applyExampleText(ex.text)
            }} />
          ) : (
            <div className="flex items-center gap-1.5 flex-wrap">
              {DIRECTOR_EXAMPLES.map(ex => (
                <ExampleChip key={ex.label} label={ex.label} onClick={() => {
                  p.setNlRole(ex.role)
                  p.setNlScene(ex.scene)
                  p.setNlDirection(ex.direction)
                  applyExampleText(ex.text)
                }} />
              ))}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={handleAiGenerate}
          disabled={!canAi}
          title={keyword ? '根据当前输入的关键字生成详细风格指令' : '请先在下方文本框中输入关键字'}
          className={`inline-flex items-center gap-1 h-[26px] px-2.5 rounded-sm text-sm font-medium border cursor-pointer transition-all whitespace-nowrap ${
            canAi
              ? 'border-accent text-accent hover:bg-accent-soft'
              : 'border-line text-ink-3 opacity-60 cursor-not-allowed'
          }`}
        >
          {aiLoading ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              生成中…
            </>
          ) : (
            <>
              <Wand2 size={14} />
              AI 生成风格描述
            </>
          )}
        </button>
      </div>

      {p.nlMode === 'paragraph' ? (
        <div className="relative">
          <Textarea
            rows={4}
            value={p.nlParagraph}
            onChange={e => p.setNlParagraph(e.target.value)}
            placeholder={PARAGRAPH_PLACEHOLDER}
            className="resize-none pr-14 text-sm placeholder:text-xs"
          />
            <div className="absolute bottom-2 right-2 flex items-center gap-2">
              <span className="text-xs text-ink-3 tabular-nums pointer-events-none">
                {p.nlParagraph.length} 字
              </span>
              {p.nlParagraph && (
                <button
                  type="button"
                  aria-label="清空风格描述"
                  title="清空"
                  onClick={() => p.setNlParagraph('')}
                  className="w-6 h-6 rounded-sm grid place-items-center text-ink-3 hover:text-danger-text hover:bg-danger-soft cursor-pointer transition-colors"
                >
                  <Trash2 size={12} />
                </button>
              )}
            </div>
        </div>
      ) : (
        <div className="space-y-2">
          <DirectorRow
            label="角色"
            value={p.nlRole}
            onChange={p.setNlRole}
            placeholder={DIRECTOR_PLACEHOLDERS.role}
          />
          <DirectorRow
            label="场景"
            value={p.nlScene}
            onChange={p.setNlScene}
            placeholder={DIRECTOR_PLACEHOLDERS.scene}
          />
          <DirectorRow
            label="指导"
            value={p.nlDirection}
            onChange={p.setNlDirection}
            placeholder={DIRECTOR_PLACEHOLDERS.direction}
          />
        </div>
      )}
    </div>
  )
}

function ExampleChip({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center h-[26px] px-2.5 rounded-full text-sm font-medium border border-line bg-surface-hover text-ink-2 hover:bg-accent-soft hover:text-accent hover:border-accent cursor-pointer transition-all whitespace-nowrap"
    >
      {label}
    </button>
  )
}

function DirectorRow({
  label, value, onChange, placeholder,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder: string
}) {
  return (
    <div className="flex items-start gap-2">
      <span
        className="text-xs font-medium whitespace-nowrap pt-1.5 text-ink-2"
        style={{ minWidth: 60 }}
      >
        {label}
      </span>
      <div className="flex-1 relative">
        <Textarea
          rows={2}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className="resize-none pr-9 text-sm placeholder:text-xs"
        />
        {value && (
          <button
            type="button"
            aria-label={`清空${label}`}
            title="清空"
            onClick={() => onChange('')}
            className="absolute top-1.5 right-1.5 w-6 h-6 rounded-sm grid place-items-center text-ink-3 hover:text-danger-text hover:bg-danger-soft cursor-pointer transition-colors"
          >
            <Trash2 size={12} />
          </button>
        )}
      </div>
    </div>
  )
}
