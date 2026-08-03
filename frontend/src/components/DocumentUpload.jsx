import { useRef, useState } from 'react'

import { useToast } from '../context/ToastContext'
import { api } from '../lib/api'
import PixelImage from './PixelImage'
import { cx } from './ui'

/**
 * Single-document uploader for identity papers (NID, trade licence).
 *
 * Uploads into the private `documents` folder rather than the listing folder,
 * so these never appear anywhere near the public marketplace feed.
 */
export default function DocumentUpload({
  value,
  onChange,
  label,
  hint,
  required,
  accentColor = 'bg-retro-blue',
}) {
  const inputRef = useRef(null)
  const [busy, setBusy] = useState(false)
  const toast = useToast()

  const handleFile = async (file) => {
    if (!file) return
    setBusy(true)
    try {
      const { url } = await api.upload(file, 'documents')
      onChange(url)
      toast.success(`${label} uploaded.`)
    } catch (err) {
      toast.error(`${label}: ${err.fieldMessages?.[0] || err.message}`)
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div>
      <p className="pixel-label">
        {label}
        {required && <span className="text-retro-red"> *</span>}
      </p>

      {value ? (
        <div className="relative border-[3px] border-ink shadow-pixel-sm">
          <PixelImage src={value} alt={label} className="aspect-[16/10] w-full" />
          <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 border-t-[3px] border-ink bg-paper px-3 py-2">
            <span className="flex items-center gap-2 text-sm font-semibold">
              <span className={cx('h-3 w-3 border-2 border-ink', accentColor)} />
              Uploaded
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="text-sm font-semibold underline underline-offset-2 hover:text-retro-navy"
              >
                Replace
              </button>
              <button
                type="button"
                onClick={() => onChange('')}
                className="text-sm font-semibold text-retro-red underline underline-offset-2 hover:text-ink"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className={cx(
            'flex aspect-[16/10] w-full flex-col items-center justify-center gap-2 border-[3px] border-dashed border-ink bg-parchment px-4 text-center transition-colors hover:bg-retro-yellow',
            busy && 'cursor-wait opacity-60',
          )}
        >
          {busy ? (
            <span className="animate-blink text-lg">▮▮▮</span>
          ) : (
            <>
              <span className="text-3xl">▤</span>
              <span className="text-sm font-semibold uppercase tracking-[0.08em]">
                Tap to upload a photo
              </span>
              <span className="text-sm text-slate/75">JPG or PNG, up to 5 MB</span>
            </>
          )}
        </button>
      )}

      {hint && <p className="mt-2 text-sm text-slate/70">{hint}</p>}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
    </div>
  )
}
