import { createContext, useCallback, useContext, useMemo, useState } from 'react'

const ToastContext = createContext(null)

const TONES = {
  success: 'bg-retro-green text-ink',
  error: 'bg-retro-red text-paper',
  info: 'bg-retro-blue text-paper',
  warn: 'bg-retro-yellow text-ink',
}

const ICONS = { success: '✔', error: '✕', info: 'i', warn: '!' }

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const dismiss = useCallback((id) => {
    setToasts((current) => current.filter((t) => t.id !== id))
  }, [])

  const push = useCallback(
    (message, tone = 'info', ttl = 4000) => {
      const id = crypto.randomUUID()
      setToasts((current) => [...current, { id, message, tone }])
      setTimeout(() => dismiss(id), ttl)
      return id
    },
    [dismiss],
  )

  const value = useMemo(
    () => ({
      push,
      success: (m) => push(m, 'success'),
      error: (m) => push(m, 'error', 6000),
      info: (m) => push(m, 'info'),
      warn: (m) => push(m, 'warn'),
    }),
    [push],
  )

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[min(22rem,calc(100vw-2rem))] flex-col gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto flex animate-pop-in items-start gap-3 border-[3px] border-ink p-3 shadow-pixel ${TONES[toast.tone]}`}
          >
            <span className="grid h-7 w-7 shrink-0 place-items-center border-2 border-ink bg-paper text-sm font-bold text-ink">
              {ICONS[toast.tone]}
            </span>
            <p className="flex-1 text-base leading-snug">{toast.message}</p>
            <button
              onClick={() => dismiss(toast.id)}
              className="font-pixel text-pixel-xs leading-none opacity-70 hover:opacity-100"
              aria-label="Dismiss notification"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) throw new Error('useToast must be used inside <ToastProvider>')
  return context
}
