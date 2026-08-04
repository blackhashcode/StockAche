import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import PixelImage from '../components/PixelImage'
import { Button, Card, ErrorBanner, Loader, SectionTitle, Stat, Tag } from '../components/ui'
import { useAuth } from '../context/AuthContext'
import { api } from '../lib/api'
import { bdt, pcs, shortDate, statusColor } from '../lib/format'

const VERIFICATION_COPY = {
  unsubmitted: {
    tone: 'bg-retro-yellow',
    title: 'Get verified',
    body: 'Add your trade licence to your profile to earn the Verified Supplier badge. Buyers can filter the marketplace to verified sellers only.',
    cta: 'Complete Profile',
  },
  pending: {
    tone: 'bg-retro-blue text-paper',
    title: 'Verification in review',
    body: 'Your trade licence is with our team. The badge appears on your listings once approved.',
    cta: 'View Profile',
  },
  rejected: {
    tone: 'bg-retro-red text-paper',
    title: 'Verification rejected',
    body: 'We could not confirm the trade licence provided. Update the details and resubmit.',
    cta: 'Fix Profile',
  },
}

export default function SupplierDashboard() {
  const { supplierProfile } = useAuth()
  const [stats, setStats] = useState(null)
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [earnings, setEarnings] = useState(null)

  useEffect(() => {
    let cancelled = false
    Promise.all([
      api.supplierDashboard(),
      api.incomingOrders(),
      api.supplierEarnings(),
    ])
      .then(([dashboard, orderList, statement]) => {
        if (cancelled) return
        setStats(dashboard)
        setOrders(orderList.slice(0, 5))
        setEarnings(statement)
        setError(null)
      })
      .catch((err) => !cancelled && setError(err))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [])

  if (loading) return <Loader label="Loading dashboard" />

  const verification = VERIFICATION_COPY[stats?.verification_status]

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="h-page">
            <span className="text-retro-red">▸ </span>Supplier Dashboard
          </h1>
          <p className="mt-2 text-sm text-slate/80">
            {supplierProfile?.business_name}
            {stats?.rating > 0 && ` · ★ ${stats.rating}/5`}
          </p>
        </div>
        <Link to="/supplier/listings/new">
          <Button size="lg">+ New Listing</Button>
        </Link>
      </div>

      <ErrorBanner error={error} onDismiss={() => setError(null)} />

      {verification && (
        <div className={`mt-6 border-[3px] border-ink p-5 shadow-pixel ${verification.tone}`}>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="h-card">
                {verification.title}
              </p>
              <p className="mt-2 max-w-2xl text-sm">{verification.body}</p>
            </div>
            <Link to="/supplier/profile">
              <Button variant="dark" size="sm">
                {verification.cta}
              </Button>
            </Link>
          </div>
        </div>
      )}

      {stats && (
        <>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat
              label="Active Listings"
              value={stats.active_listings}
              sub={
                stats.sold_out_listings > 0
                  ? `${stats.sold_out_listings} sold out — restock to sell`
                  : `${stats.total_listings} total`
              }
              color="bg-retro-blue"
            />
            <Stat
              label="Needs Action"
              value={stats.pending_action}
              sub="Placed or confirmed"
              color="bg-retro-yellow"
            />
            <Stat
              label="In Transit"
              value={stats.in_transit}
              sub={`${stats.delivered} delivered`}
              color="bg-retro-purple"
            />
            <Stat
              label="Net Earnings"
              value={bdt(stats.net_payout_bdt)}
              sub={`After ${(Number(stats.commission_rate) * 100).toFixed(0)}% platform fee`}
              color="bg-retro-green"
            />
          </div>

          {stats.open_cancellation_requests > 0 && (
            <Link to="/supplier/orders" className="mt-6 block">
              <div className="border-[3px] border-ink bg-retro-yellow p-4 shadow-pixel transition-transform hover:-translate-y-0.5">
                <p className="h-card">
                  {stats.open_cancellation_requests} cancellation request
                  {stats.open_cancellation_requests > 1 ? 's' : ''} waiting
                </p>
                <p className="mt-2 text-base">
                  Buyers are waiting on your decision — review them now →
                </p>
              </div>
            </Link>
          )}

          {/* Earnings statement */}
          <div className="mt-8">
            <SectionTitle>Earnings</SectionTitle>
            <Card>
              <div className="grid gap-5 sm:grid-cols-3">
                <div>
                  <p className="eyebrow text-slate">Gross Sales</p>
                  <p className="price mt-1.5 text-2xl">{bdt(stats.revenue_bdt)}</p>
                </div>
                <div>
                  <p className="eyebrow text-slate">
                    Platform Fee ({(Number(stats.commission_rate) * 100).toFixed(0)}%)
                  </p>
                  <p className="price mt-1.5 text-2xl text-slate">
                    −{bdt(stats.commission_bdt)}
                  </p>
                </div>
                <div>
                  <p className="eyebrow text-slate">Net Payout</p>
                  <p className="price mt-1.5 text-2xl text-retro-green">
                    {bdt(stats.net_payout_bdt)}
                  </p>
                </div>
              </div>

              <p className="mt-4 border-2 border-ink bg-parchment p-3 text-sm text-slate/80">
                The platform fee is charged on the goods value only. Delivery and express
                charges pass through to you in full.
              </p>

              {earnings?.months?.length > 0 && (
                <div className="mt-5 overflow-x-auto">
                  <table className="w-full min-w-[34rem] border-collapse text-left">
                    <thead>
                      <tr className="border-b-[3px] border-ink">
                        <th className="pb-2 pr-4 eyebrow text-slate">Month</th>
                        <th className="pb-2 pr-4 eyebrow text-right text-slate">Orders</th>
                        <th className="pb-2 pr-4 eyebrow text-right text-slate">Gross</th>
                        <th className="pb-2 pr-4 eyebrow text-right text-slate">Fee</th>
                        <th className="pb-2 eyebrow text-right text-slate">Net</th>
                      </tr>
                    </thead>
                    <tbody>
                      {earnings.months.map((month) => (
                        <tr key={month.month} className="border-b-2 border-dashed border-ink/25">
                          <td className="py-3 pr-4 text-sm font-semibold">{month.label}</td>
                          <td className="py-3 pr-4 text-right font-num text-sm">
                            {month.orders}
                          </td>
                          <td className="py-3 pr-4 text-right font-num text-sm">
                            {bdt(month.gross_bdt)}
                          </td>
                          <td className="py-3 pr-4 text-right font-num text-sm text-slate/70">
                            −{bdt(month.commission_bdt)}
                          </td>
                          <td className="py-3 text-right font-num text-sm font-bold text-retro-green">
                            {bdt(month.net_payout_bdt)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </div>

          <div className="mt-8 grid gap-6 lg:grid-cols-[1.3fr_1fr]">
            {/* Incoming orders */}
            <section>
              <SectionTitle
                right={
                  <Link to="/supplier/orders">
                    <Button size="sm" variant="dark">
                      All Orders →
                    </Button>
                  </Link>
                }
              >
                Incoming Orders
              </SectionTitle>

              {orders.length === 0 ? (
                <Card className="text-center">
                  <p className="text-sm text-slate/80">
                    No orders yet. Listings with clear photos and honest MOQs sell fastest.
                  </p>
                </Card>
              ) : (
                <div className="space-y-3">
                  {orders.map((order) => (
                    <Link
                      key={order.id}
                      to={`/supplier/orders?focus=${order.id}`}
                      className="flex items-center gap-3 border-[3px] border-ink bg-paper p-3 shadow-pixel-sm transition-transform duration-100 hover:-translate-y-0.5"
                    >
                      <PixelImage
                        src={order.product.thumbnail}
                        alt={order.product.title}
                        seed={order.product.id}
                        className="h-12 w-12 shrink-0 border-2 border-ink"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold">{order.product.title}</p>
                        <p className="mt-0.5 text-xs text-slate/70">
                          {order.buyer_business_name} · {pcs(order.ordered_quantity)} ·{' '}
                          {shortDate(order.created_at)}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="price text-xl">
                          {bdt(order.total_price)}
                        </p>
                        <Tag color={statusColor(order.order_status)} className="mt-1">
                          {order.status_label}
                        </Tag>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </section>

            {/* Low stock */}
            <section>
              <SectionTitle
                right={
                  <Link to="/supplier/listings">
                    <Button size="sm" variant="dark">
                      Manage →
                    </Button>
                  </Link>
                }
              >
                Stock Levels
              </SectionTitle>

              {stats.low_stock.length === 0 ? (
                <Card className="text-center">
                  <p className="text-sm text-slate/80">No active listings yet.</p>
                  <Link to="/supplier/listings/new" className="mt-3 inline-block">
                    <Button size="sm">Create your first lot</Button>
                  </Link>
                </Card>
              ) : (
                <Card className="space-y-4">
                  {stats.low_stock.map((product) => {
                    const ratio = Math.min(
                      100,
                      (product.available_quantity / Math.max(product.moq * 10, 1)) * 100,
                    )
                    const critical = product.available_quantity < product.moq * 2
                    return (
                      <div key={product.id}>
                        <div className="flex items-baseline justify-between gap-3">
                          <Link
                            to={`/supplier/listings/${product.id}/edit`}
                            className="truncate text-sm font-medium hover:text-retro-red"
                          >
                            {product.title}
                          </Link>
                          <span className="shrink-0 price text-lg">
                            {product.available_quantity}
                          </span>
                        </div>
                        <div className="mt-1.5 h-3 border-2 border-ink bg-parchment">
                          <div
                            className={`h-full ${critical ? 'bg-retro-red' : 'bg-retro-green'}`}
                            style={{ width: `${Math.max(ratio, 3)}%` }}
                          />
                        </div>
                        {critical && (
                          <p className="mt-1 eyebrow text-retro-red">
                            Low stock — under 2× MOQ
                          </p>
                        )}
                      </div>
                    )
                  })}
                  <p className="border-t-2 border-dashed border-ink/25 pt-3 text-xs text-slate/70">
                    {pcs(stats.units_in_stock)} across all listings
                  </p>
                </Card>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  )
}
