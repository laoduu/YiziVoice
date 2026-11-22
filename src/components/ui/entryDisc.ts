// 采集入口的两个圆钮是「二选一」，所以必须同一套：尺寸 / 图标色 / 底色 / hover 都来自这里，
// 唯一的例外是「正在录音」这个**状态**（换红底）。旧版左边是实心品牌色圆、右边是几乎看不见的
// 描边圆 —— 那是「录音是唯一动作」时代的层级残留，二选一里它只是在替用户往一边推。
// ⚠️ 底色不要写成「基础类 + 覆盖类」：两个 bg-* 谁赢由 Tailwind 的生成顺序决定，不由类名先后
// 决定，所以底色只能由状态各给一份，绝不叠加。
//
// v2.1: 音色克隆「提交音色样本」与音转文「获取音频」是同一个控件、同一个含义，取值收在这里
// （同类控件跨页面必须同值；下一个页面要用也引这份，不要再复制一遍）。
export const ENTRY_DISC =
  'w-[64px] h-[64px] rounded-full grid place-items-center cursor-pointer transition-colors duration-100 ease-out disabled:cursor-default disabled:opacity-50'
export const ENTRY_DISC_IDLE = 'bg-accent-soft text-accent hover:bg-surface-hover'
export const ENTRY_DISC_RECORDING = 'bg-danger text-accent-on recording-pulse'
