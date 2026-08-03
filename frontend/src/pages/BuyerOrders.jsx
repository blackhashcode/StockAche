import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import OrderTracker from '../components/OrderTracker'
import PixelImage from '../components/PixelImage'
import { Button, Card, EmptyState, ErrorBanner, Loader, Stat, Tag, cx } from '../components/ui'
import { api } from '../lib/api'
import { bdt, pcs, shortDate, paymentColor, statusColor } from '../lib/format'

const TABS = [
  { value: '', label: 'All' },
  { value: 'placed,confirmed', label: 'Awaiting' },
  { value: 'dispatched,in_transit', label: 'In Transit' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'cancelled', label: 'Cancelled' },
]

function OrderRow({ order }) {
  return (
    <Card className="transition-transform duration-100 hover:-translate-y-0.5">
      <div className="flex flex-wrap items-start gap-4">
        <PixelImage
          src={order.product.thumbnail}
          alt={order.product.title}
          seed={order.product.id}
          className="h-20 w-20 shrink-0 border-[3px] border-ink"
        />

        <div className="min-w-[12rem] flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-pixel text-[9px] uppercase tracking-wider text-retro-navy">
              {order.reference}
            </span>
            <Tag color={statusColor(order.order_status)}>{order.status_label}</Tag>
            <Tag color={paymentColor(order.payment_status)}>{order.payment_status_label}</Tag>
          </div>
          <Link
            to={`/orders/${order.id}`}
            className="mt-2 block text-sm font-bold leading-snug hover:text-retro-red"
          >
            {order.product.title}
          </Link>
          <p className="mt-1 text-xs text-slate/70">
            {order.product.supplier_name} · {pcs(order.ordered_quantity)} ·{' '}
            {shortDate(order.created_at)}
          </p>
        </div>

        <div className="text-right">
          <p className="font-term text-3xl leading-none text-retro-red">
            {bdt(order.total_price)}
          </p>
          <Link to={`/orders/${order.id}`}>
            <Button size="sm" variant="dark" className="mt-3">
              Track →
            </Button>
          </Link>
        </div>
      </div>

      {order.order_status !== 'cancelled' && (
        <div className="mt-5 border-t-2 border-dashed border-ink/25 pt-4">
          <OrderTracker order={order} compact />
        </div>
      )}
    </Card>
  )
}

export default function BuyerOrders() {
  const [orders, setOrders] = useState([])
  const [stats, setStats] = useState(null)
  const [tab, setTab] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    Promise.all([api.orders(tab ? { status: tab } : {}), api.buyerDashboard()])
      .then(([orderList, dashboard]) => {
        if (cancelled) return
        setOrders(orderList)
        setStats(dashboard)
        setError(null)
      })
      .catch((err) => !cancelled && setError(err))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [tab])

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="font-pixel text-lg uppercase">
        <span className="text-retro-red">▸ </span>My Orders
      </h1>
      <p className="mt-2 text-sm text-slate/80">
        Every lot you&apos;ve bought, with live milestone tracking.
      </p>

      {stats && (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Total Orders" value={stats.total_orders} color="bg-retro-blue" />
          <Stat label="Active" value={stats.active_orders} color="bg-retro-yellow" />
          <Stat label="Pieces Bought" value={Number(stats.units_bought).toLocaleString()} color="bg-retro-purple" />
          <Stat label="Total Spend" value={bdt(stats.total_spend_bdt)} color="bg-retro-green" />
        </div>
      )}

      <div className="mt-8 flex flex-wrap gap-2">
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
            title="No orders here yet"
            message="Once you buy a stocklot it shows up here with its live tracking bar."
            action={
              <Link to="/marketplace" className="mt-2">
                <Button>Browse Stocklots</Button>
              </Link>
            }
          />
        ) : (
          <div className="space-y-5">
            {orders.map((order) => (
              <OrderRow key={order.id} order={order} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
