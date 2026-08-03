/**
 * The 8-bit component kit. Everything in the app is built from these so the
 * chunky-border / hard-shadow language stays consistent.
 */
import { forwardRef } from 'react'

const cx = (...parts) => parts.filter(Boolean).join(' ')

const VARIANTS = {
  primary: 'bg-retro-red text-paper hover:bg-[#f04a53]',
  secondary: 'bg-retro-yellow text-ink hover:bg-retro-gold',
  success: 'bg-retro-green text-ink hover:bg-[#72d95b]',
  info: 'bg-retro-blue text-paper hover:bg-[#22aae8]',
  dark: 'bg-ink text-paper hover:bg-slate',
  ghost: 'bg-paper text-ink hover:bg-parchment',
  danger: 'bg-retro-red text-paper hover:bg-[#f04a53]',
}

// Press Start 2P runs small for its point size, so these sit a step above what
// the same numbers would mean in a normal typeface.
// Press Start 2P runs small for its point size, so nothing drops below 11px —
// the size at which its glyphs stop resolving cleanly.
const SIZES = {
  sm: 'px-3.5 py-2.5 text-pixel-xs',
  md: 'px-5 py-3.5 text-pixel-xs',
  lg: 'px-6 py-4 text-pixel-sm',
}

export const Button = forwardRef(function Button(
  { variant = 'primary', size = 'md', className, loading, children, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      className={cx('pixel-btn', VARIANTS[variant], SIZES[size], className)}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading ? <span className="animate-blink">▮</span> : children}
    </button>
  )
})

export function Card({ className, children, ...props }) {
  return (
    <div className={cx('pixel-box p-5', className)} {...props}>
      {children}
    </div>
  )
}

export function Tag({ color = 'bg-retro-grey', className, children }) {
  return <span className={cx('pixel-tag', color, className)}>{children}</span>
}

export function Field({ label, hint, error, required, children }) {
  return (
    <label className="block">
      {label && (
        <span className="pixel-label">
          {label}
          {required && <span className="text-retro-red"> *</span>}
        </span>
      )}
      {children}
      {hint && !error && <p className="mt-1.5 text-xs text-slate/70">{hint}</p>}
      {error && (
        <p className="mt-1.5 eyebrow text-retro-red">{error}</p>
      )}
    </label>
  )
}

export const Input = forwardRef(function Input({ className, ...props }, ref) {
  return <input ref={ref} className={cx('pixel-input', className)} {...props} />
})

export const Textarea = forwardRef(function Textarea({ className, ...props }, ref) {
  return <textarea ref={ref} className={cx('pixel-input', className)} rows={4} {...props} />
})

export const Select = forwardRef(function Select({ className, children, ...props }, ref) {
  return (
    <select ref={ref} className={cx('pixel-input cursor-pointer', className)} {...props}>
      {children}
    </select>
  )
})

/** Section heading with the recurring ▸ marker. */
export function SectionTitle({ children, right, className }) {
  return (
    <div className={cx('mb-4 flex items-end justify-between gap-4', className)}>
      <h2 className="h-section text-ink">
        <span className="text-retro-red">▸ </span>
        {children}
      </h2>
      {right}
    </div>
  )
}

export function Loader({ label = 'Loading' }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16">
      <div className="flex gap-1.5">
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className="h-4 w-4 border-2 border-ink bg-retro-yellow"
            style={{ animation: `blink 0.8s steps(1) ${i * 0.15}s infinite` }}
          />
        ))}
      </div>
      <p className="h-card text-slate">
        {label}
        <span className="animate-blink">...</span>
      </p>
    </div>
  )
}

export function EmptyState({ icon = '▨', title, message, action }) {
  return (
    <div className="pixel-box flex flex-col items-center gap-3 px-6 py-14 text-center">
      <div className="grid h-16 w-16 place-items-center border-[3px] border-ink bg-parchment text-3xl">
        {icon}
      </div>
      <h3 className="h-section">{title}</h3>
      {message && <p className="max-w-md text-base text-slate/80">{message}</p>}
      {action}
    </div>
  )
}

export function ErrorBanner({ error, onDismiss }) {
  if (!error) return null
  const lines = error.fieldMessages?.length ? error.fieldMessages : [error.message]
  return (
    <div className="mb-4 border-[3px] border-ink bg-retro-red p-4 text-paper shadow-pixel">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="h-card">! Error</p>
          <ul className="mt-2 space-y-1 text-sm">
            {lines.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        </div>
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="font-pixel text-xs leading-none hover:text-retro-yellow"
            aria-label="Dismiss"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  )
}

/** Simple pixel-framed modal. */
export function Modal({ open, onClose, title, children, maxWidth = 'max-w-lg' }) {
  if (!open) return null
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/70 p-4"
      onClick={onClose}
    >
      <div
        className={cx('pixel-box-lg w-full animate-pop-in', maxWidth)}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b-[3px] border-ink bg-ink px-5 py-3">
          <h3 className="h-card text-paper">
            {title}
          </h3>
          <button
            onClick={onClose}
            className="font-pixel text-xs text-paper hover:text-retro-yellow"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}

/** Small stat readout used across both dashboards. */
export function Stat({ label, value, sub, color = 'bg-retro-yellow' }) {
  return (
    <div className="pixel-box p-4">
      <div className={cx('mb-3 h-2 w-10 border-2 border-ink', color)} />
      <p className="stat-value">{value}</p>
      <p className="mt-2 eyebrow text-slate">{label}</p>
      {sub && <p className="mt-1 text-sm text-slate/70">{sub}</p>}
    </div>
  )
}

/** Labelled money row, right-aligned, used in every cost breakdown. */
export function MoneyRow({ label, value, muted, strong, accent }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className={cx('text-sm', muted ? 'text-slate/70' : 'text-slate')}>
        {label}
      </span>
      <span
        className={cx(
          'price',
          strong ? 'text-xl' : 'text-base',
          accent ? 'text-retro-red' : 'text-ink',
        )}
      >
        {value}
      </span>
    </div>
  )
}

/** Checkbox styled to match the chunky border language. */
export function Checkbox({ checked, onChange, label, hint, disabled }) {
  return (
    <label
      className={cx(
        'flex cursor-pointer items-start gap-3 border-[3px] border-ink bg-parchment p-3.5',
        disabled && 'cursor-not-allowed opacity-60',
      )}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        className="mt-0.5 h-5 w-5 shrink-0 accent-retro-green"
      />
      <span className="min-w-0">
        <span className="block text-sm font-semibold uppercase tracking-[0.08em]">
          {label}
        </span>
        {hint && <span className="mt-1 block text-sm text-slate/75">{hint}</span>}
      </span>
    </label>
  )
}

export { cx }
