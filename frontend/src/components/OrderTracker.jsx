import { dateTime } from '../lib/format'
import { cx } from './ui'

const MILESTONES = [
  { value: 'placed', label: 'Placed', icon: '▣' },
  { value: 'confirmed', label: 'Confirmed', icon: '✔' },
  { value: 'dispatched', label: 'Dispatched', icon: '▶' },
  { value: 'in_transit', label: 'In Transit', icon: '⇢' },
  { value: 'delivered', label: 'Delivered', icon: '★' },
]

/** Milestone progress bar: Placed → Confirmed → Dispatched → In Transit → Delivered. */
export default function OrderTracker({ order, compact = false }) {
  const current = order.milestone_index
  const cancelled = order.order_status === 'cancelled'

  if (cancelled) {
    return (
      <div className="border-[3px] border-ink bg-retro-red p-3 text-paper">
        <p className="h-card">✕ Order Cancelled</p>
        <p className="mt-1 text-sm text-paper/85">
          Stock has been returned to the supplier&apos;s lot.
        </p>
      </div>
    )
  }

  const percent = (current / (MILESTONES.length - 1)) * 100

  return (
    <div className={compact ? '' : 'pixel-box p-5'}>
      {!compact && (
        <p className="mb-5 h-card text-slate">
          Live Tracking
        </p>
      )}

      <div className="relative">
        {/* Track */}
        <div className="absolute left-0 right-0 top-4 h-2 border-2 border-ink bg-parchment" />
        <div
          className="absolute left-0 top-4 h-2 border-2 border-ink bg-retro-green transition-[width] duration-500"
          style={{ width: `${Math.max(percent, 1)}%` }}
        />

        <ol className="relative flex justify-between">
          {MILESTONES.map((milestone, index) => {
            const done = index <= current
            const isCurrent = index === current
            return (
              <li key={milestone.value} className="flex flex-col items-center gap-2">
                <span
                  className={cx(
                    'grid h-10 w-10 place-items-center border-[3px] border-ink font-pixel text-[11px] transition-colors',
                    done ? 'bg-retro-green text-ink' : 'bg-paper text-slate/40',
                    isCurrent && 'shadow-pixel-sm ring-2 ring-retro-blue ring-offset-2',
                  )}
                >
                  {milestone.icon}
                </span>
                <span
                  className={cx(
                    'text-center eyebrow',
                    done ? 'text-ink' : 'text-slate/40',
                  )}
                >
                  {milestone.label}
                </span>
              </li>
            )
          })}
        </ol>
      </div>

      {!compact && order.events?.length > 0 && (
        <div className="mt-6 border-t-2 border-dashed border-ink/30 pt-4">
          <p className="mb-3 eyebrow text-slate">
            Timeline
          </p>
          <ul className="space-y-3">
            {[...order.events].reverse().map((event) => (
              <li key={event.id} className="flex gap-3">
                <span className="mt-1 h-3 w-3 shrink-0 border-2 border-ink bg-retro-yellow" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold">{event.status_label}</p>
                  {event.note && <p className="text-sm text-slate/80">{event.note}</p>}
                  <p className="mt-0.5 eyebrow text-slate/60">
                    {dateTime(event.created_at)}
                    {event.created_by && ` — ${event.created_by}`}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
