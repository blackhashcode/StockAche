import { useState } from 'react'

import { cx } from './ui'

const SWATCHES = [
  'bg-retro-red',
  'bg-retro-blue',
  'bg-retro-green',
  'bg-retro-purple',
  'bg-retro-orange',
  'bg-retro-teal',
]

/** Deterministic pixel-block placeholder, used when there is no image or it 404s. */
function Placeholder({ seed = '', label = 'NO IMAGE' }) {
  const hash = [...String(seed)].reduce((acc, ch) => acc + ch.charCodeAt(0), 0)
  return (
    <div className="relative flex h-full w-full flex-col items-center justify-center gap-2 bg-parchment">
      <div className="grid grid-cols-4 gap-1">
        {Array.from({ length: 16 }).map((_, i) => (
          <span
            key={i}
            className={cx(
              'h-3 w-3 border border-ink/40',
              (hash + i * 7) % 3 === 0 ? SWATCHES[(hash + i) % SWATCHES.length] : 'bg-paper',
            )}
          />
        ))}
      </div>
      <span className="eyebrow text-slate/60">
        {label}
      </span>
    </div>
  )
}

export default function PixelImage({ src, alt, seed, className, label }) {
  const [failed, setFailed] = useState(false)

  return (
    <div className={cx('relative overflow-hidden bg-parchment', className)}>
      {src && !failed ? (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          onError={() => setFailed(true)}
          className="h-full w-full object-cover"
          style={{ imageRendering: 'auto' }}
        />
      ) : (
        <Placeholder seed={seed || alt} label={label} />
      )}
    </div>
  )
}
