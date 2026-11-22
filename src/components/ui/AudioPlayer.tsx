import { useEffect, useRef, useState } from 'react'
import { Play, Square, Download } from 'lucide-react'
import { downloadUrl } from '../../services/storage'
import { downloadHistoryAudio, releaseAudioSrc } from '../../services/historyService'
import { useToast } from '../Toast'
import { Tooltip } from './Tooltip'

interface AudioPlayerProps {
  src: string
  downloadName?: string
  // 历史回放场景:src 是 asset URL,而 asset 不在 CSP connect-src 内,前端 fetch 会被拦。
  // 传入记录 id 后,下载改走 Rust 读盘(export_history_audio),前端不碰文件路径。
  historyId?: string
  meta?: React.ReactNode
}

function fmt(sec: number): string {
  if (!isFinite(sec) || sec < 0) sec = 0
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

// 自定义播放器(M2 卡片):替代原生 <audio controls>
export function AudioPlayer({ src, downloadName = 'yizivoice_output.wav', historyId, meta }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const { showToast } = useToast()
  const [playing, setPlaying] = useState(false)
  const [current, setCurrent] = useState(0)
  const [duration, setDuration] = useState(0)

  // src 可能是 data:/asset:/blob:。cleanup 只读关闭时的 src 值,不要读 el.src ——
  // React 会在 cleanup 前先把 DOM 换成新 src,读 el.src 会误 revoke 新地址。
  // data:/asset: 由 releaseAudioSrc 内部忽略;blob: 仅在真正换源/卸载时释放。
  useEffect(() => {
    return () => releaseAudioSrc(src)
  }, [src])

  const toggle = () => {
    const el = audioRef.current
    if (!el) return
    if (el.paused) {
      void el.play().catch(() => {
        showToast('音频播放失败，请尝试下载后播放', 'error')
        setPlaying(false)
      })
    } else {
      el.pause()
    }
  }

  const seek = (t: number) => {
    const el = audioRef.current
    if (el) el.currentTime = t
  }

  return (
    <div className="mat-card px-3 py-2.5 flex items-center gap-3">
      <Tooltip label={playing ? '暂停' : '播放'} className="shrink-0">
        <button
          type="button"
          aria-label={playing ? '暂停' : '播放'}
          onClick={toggle}
          className="w-9 h-9 shrink-0 rounded-full bg-accent-strong text-accent-on grid place-items-center cursor-pointer transition-all duration-100 ease-out hover:bg-accent-hover"
        >
          {playing ? <Square size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" className="ml-0.5" />}
        </button>
      </Tooltip>

      <input
        type="range"
        className="seek-range flex-1 min-w-[80px]"
        min={0}
        max={duration || 0}
        step={0.1}
        value={Math.min(current, duration || 0)}
        onChange={e => seek(parseFloat(e.target.value))}
      />

      <span className="text-xs tabular-nums text-ink-3 shrink-0 w-[84px] text-right">
        {fmt(current)} / {fmt(duration)}
      </span>

      {meta}

      <button
        type="button"
        title="下载音频"
        aria-label="下载音频"
        onClick={() => void (historyId ? downloadHistoryAudio(historyId, downloadName) : downloadUrl(src, downloadName))}
        className="w-8 h-8 shrink-0 rounded-sm grid place-items-center text-ink-3 hover:text-accent hover:bg-surface-hover cursor-pointer transition-colors"
      >
        <Download size={16} />
      </button>

      <audio
        ref={audioRef}
        src={src}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onTimeUpdate={e => setCurrent(e.currentTarget.currentTime)}
        onLoadedMetadata={e => setDuration(e.currentTarget.duration)}
      />
    </div>
  )
}
