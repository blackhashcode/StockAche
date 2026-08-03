import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import OrderTracker from '../components/OrderTracker'
import PixelImage from '../components/PixelImage'
import {
  Button,
  Card,
  EmptyState,
  ErrorBanner,
  Field,
  Input,
  Loader,
  Modal,
  Tag,
  cx,
} from '../components/ui'
import { useToast } from '../context/ToastContext'
import { api } from '../lib/api'
import { bdt, dateTime, paymentColor, pcs, statusColor } from '../lib/format'

const TABS = [
  { value: 'placed,confirmed', label: 'Needs Action' },
  { value: 'dispatched,in_transit', label: 'On The Road' },
  { value: 'delivered', label: 'Delivered' },
  { value: '', label: 'All' },
]

/** Label + default note for each forward transition. */
const ACTIONS = {
  confirmed: {
    label: '✔ Confirm Order',
    variant: 'success',
    note: 'Stock reserved, packing started.',
  },
  dispatched: {
    label: '▶ Mark Dispatched',
    variant: 'info',
    note: 'Dispatched via truck from the warehouse.',
  },
  in_transit: {
    label: '⇢ Mark In Transit',
    variant: 'info',
    note: 'On the highway, expected within 24 hours.',
  },
  delivered: {
    label: '★ Mark Delivered',
    variant: 'success',
    note: 'Handed over to the buyer.',
  },
  cancelled: { label: '✕ Cancel Order', variant: 'danger', note: '' },
}

function DispatchModal({ order, action, onClose, onConfirm, busy }) {
  const [note, setNote] = useState('')

  useEffect(() => {
    setNote(action ? ACTIONS[action]?.note || '' : '')
  }, [action])

  if (!order || !action) return null
  const config = ACTIONS[action]

  return (
    <Modal open onClose={onClose} title={config.label.replace(/^[^\s]+\s/, '')}>
      <p className="text-sm text-slate/85">
        Order <strong>{order.reference}</strong> · {order.buyer_business_name}
      </p>

      {action === 'cancelled' && (
        <p className="mt-3 border-2 border-ink bg-retro-red p-3 text-sm text-paper">
          ⚠ {pcs(order.ordered_quantity)} goes back into your lot and, if the buyer already
          paid, the order is marked refunded.
        </p>
      )}

      <div className="mt-4">
        <Field
          label="Note for the buyer"
          hint="Shown on their tracking timeline."
        >
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Truck DM-TA-11-2345, driver 01711-000000"
            maxLength={300}
          />
        </Field>
      </div>

      <div className="mt-5 flex gap-3">
        <Button variant="ghost" className="flex-1" onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button
          variant={config.variant}
          className="flex-1"
          loading={busy}
          onClick={() => onConfirm(action, note)}
        >
          Confirm
        </Button>
      </div>
    </Modal>
  )
}

function OrderCard({ order, onAction, highlighted }) {
  const [expanded, setExpanded] = useState(highlighted)

  return (
    <Card
      className={cx(
        'transition-transform duration-100',
        highlighted && 'ring-4 ring-retro-blue ring-offset-2',
      )}
    >
      <div className="flex flex-wrap items-start gap-4">
        <PixelImage
          src={order.product.thumbnail}
          alt={order.product.title}
          seed={order.product.id}
          className="h-20 w-20 shrink-0 border-[3px] border-ink"
        />

        <div className="min-w-[14rem] flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-pixel text-[9px] uppercase tracking-wider text-retro-navy">
              {order.reference}
            </span>
            <Tag color={statusColor(order.order_status)}>{order.status_label}</Tag>
            <Tag color={paymentColor(order.payment_status)}>{order.payment_status_label}</Tag>
          </div>

          <p className="mt-2 text-sm font-bold leading-snug">{order.product.title}</p>
          <p className="mt-1 text-xs text-slate/70">
            {order.buyer_business_name} · {pcs(order.ordered_quantity)} ·{' '}
            {dateTime(order.created_at)}
          </p>
          <p className="mt-1 text-xs text-slate/70">
            → {order.contact_person}, {order.contact_phone}
            {order.delivery_district && ` · ${order.delivery_district}`}
          </p>
        </div>

        <div className="text-right">
          <p className="font-term text-3xl leading-none text-retro-red">
            {bdt(order.total_price)}
          </p>
          <p className="mt-1 text-xs text-slate/70">
            {bdt(order.unit_price_bdt)} × {order.ordered_quantity}
          </p>
        </div>
      </div>

      {/* Dispatch controller */}
      {order.next_statuses.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2 border-t-2 border-dashed border-ink/25 pt-4">
          {order.next_statuses.map((next) => (
            <Button
              key={next}
              size="sm"
              variant={ACTIONS[next]?.variant || 'dark'}
              onClick={() => onAction(order, next)}
            >
              {ACTIONS[next]?.label || next}
            </Button>
          ))}
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3 border-t-2 border-dashed border-ink/25 pt-4">
        <button
          onClick={() => setExpanded((v) => !v)}
          className="font-pixel text-[9px] uppercase tracking-wider text-slate hover:text-retro-red"
        >
          {expanded ? '▾ Hide details' : '▸ Show tracking & address'}
        </button>
        <Link
          to={`/orders/${order.id}`}
          className="ml-auto font-pixel text-[9px] uppercase tracking-wider text-retro-navy hover:text-retro-red"
        >
          Full order →
        </Link>
      </div>

      {expanded && (
        <div className="mt-4 space-y-4">
          <OrderTracker order={order} compact />
          <div className="border-[3px] border-ink bg-parchment p-3">
            <p className="font-pixel text-[8px] uppercase tracking-wider text-slate">
              Deliver to
            </p>
            <p className="mt-1 whitespace-pre-line text-sm">{order.delivery_address}</p>
            {order.notes && (
              <p className="mt-2 text-sm text-slate/80">
                <span className="font-pixel text-[8px] uppercase">Buyer note: </span>
                {order.notes}
              </p>
            )}
          </div>
        </div>
      )}
    </Card>
  )
}

export default function SupplierOrders() {
  const [searchParams] = useSearchParams()
  const focusId = searchParams.get('focus')

  const [tab, setTab] = useState('placed,confirmed')
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [pending, setPending] = useState({ order: null, action: null })
  const [busy, setBusy] = useState(false)
  const toast = useToast()

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    api
      .incomingOrders(tab ? { status: tab } : {})
      .then((data) => {
        if (cancelled) return
        setOrders(data)
        setError(null)
      })
      .catch((err) => !cancelled && setError(err))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [tab])

  const applyAction = async (status, note) => {
    setBusy(true)
    try {
      const updated = await api.updateOrderStatus(pending.order.id, status, note)
      setOrders((list) => list.map((o) => (o.id === updated.id ? updated : o)))
      toast.success(`${updated.reference} → ${updated.status_label}`)
      setPending({ order: null, action: null })
    } catch (err) {
      setError(err)
      setPending({ order: null, action: null })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="font-pixel text-lg uppercase">
        <span className="text-retro-red">▸ </span>Incoming Orders
      </h1>
      <p className="mt-2 text-sm text-slate/80">
        Move each order along the track — the buyer sees it update live.
      </p>

      <div className="mt-6 flex flex-wrap gap-2">
        {TABS.map((option) => (
          <button
            key={option.label}
            onClick={() => setTab(option.value)}
            className={cx(
              'border-[3px] border-ink px-3 py-2 font-pixel text-[9px] uppercase tracking-wider transition-transform duration-75',
              tab === option.value
                ? 'translate-x-[2px] translate-y-[2px] bg-ink text-paper shadow-none'
                : 'bg-paper shadow-pixel-sm hover:bg-retro-yellow',
            )}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="mt-6">
        <ErrorBanner error={error} onDismiss={() => setError(null)} />

        {loading ? (
          <Loader label="Loading orders" />
        ) : orders.length === 0 ? (
          <EmptyState
            icon="▤"
            title="Nothing in this queue"
            message="New orders land here the moment a buyer checks out."
          />
        ) : (
          <div className="space-y-5">
            {orders.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                highlighted={order.id === focusId}
                onAction={(o, action) => setPending({ order: o, action })}
              />
            ))}
          </div>
        )}
      </div>

      <DispatchModal
        order={pending.order}
        action={pending.action}
        busy={busy}
        onClose={() => setPending({ order: null, action: null })}
        onConfirm={applyAction}
      />
    </div>
  )
}
