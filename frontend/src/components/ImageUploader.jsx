import { useRef, useState } from 'react'

import { useToast } from '../context/ToastContext'
import { api } from '../lib/api'
import PixelImage from './PixelImage'
import { Button, cx } from './ui'

/**
 * Uploads straight into Supabase Storage through the Django proxy and hands
 * back the public URLs.
 */
export default function ImageUploader({ value = [], onChange, max = 6, folder = 'listings' }) {
  const inputRef = useRef(null)
  const [busy, setBusy] = useState(false)
  const toast = useToast()

  const handleFiles = async (fileList) => {
    const files = Array.from(fileList || [])
    if (!files.length) return

    const room = max - value.length
    if (room <= 0) {
      toast.warn(`You can attach at most ${max} photos.`)
      return
    }

    setBusy(true)
    const uploaded = []
    for (const file of files.slice(0, room)) {
      try {
        const { url } = await api.upload(file, folder)
        uploaded.push(url)
      } catch (err) {
        toast.error(`${file.name}: ${err.fieldMessages?.[0] || err.message}`)
      }
    }
    if (uploaded.length) {
      onChange([...value, ...uploaded])
      toast.success(`${uploaded.length} photo${uploaded.length > 1 ? 's' : ''} uploaded.`)
    }
    setBusy(false)
    if (inputRef.current) inputRef.current.value = ''
  }

  const remove = (url) => onChange(value.filter((u) => u !== url))

  return (
    <div>
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
        {value.map((url, index) => (
          <div key={url} className="relative border-[3px] border-ink shadow-pixel-sm">
            <PixelImage src={url} alt={`Photo ${index + 1}`} className="aspect-square w-full" />
            {index === 0 && (
              <span className="absolute left-0 top-0 border-b-2 border-r-2 border-ink bg-retro-yellow px-1.5 py-0.5 font-pixel text-[7px] uppercase">
                Cover
              </span>
            )}
            <button
              type="button"
              onClick={() => remove(url)}
              className="absolute -right-2 -top-2 grid h-6 w-6 place-items-center border-2 border-ink bg-retro-red font-pixel text-[9px] text-paper hover:bg-ink"
              aria-label="Remove photo"
            >
              ✕
            </button>
          </div>
        ))}

        {value.length < max && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className={cx(
              'grid aspect-square place-items-center border-[3px] border-dashed border-ink bg-parchment font-pixel text-[8px] uppercase tracking-wider text-slate transition-colors hover:bg-retro-yellow',
              busy && 'cursor-wait opacity-60',
            )}
          >
            {busy ? <span className="animate-blink">▮▮▮</span> : <span>+ Add</span>}
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />

      <p className="mt-2 text-xs text-slate/70">
        JPG / PNG / WEBP, up to 5 MB each. The first photo is used as the listing cover.
      </p>

      {value.length > 0 && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="mt-3"
          onClick={() => onChange([])}
        >
          Clear all
        </Button>
      )}
    </div>
  )
}
