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
    body: 'Add your trade licence number to your profile to earn the Verified Supplier badge. Buyers can filter for verified sellers only.',
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

  useEffect(() => {
    let cancelled = false
    Promise.all([api.supplierDashboard(), api.incomingOrders()])
      .then(([dashboard, orderList]) => {
        if (cancelled) return
        setStats(dashboard)
        setOrders(orderList.slice(0, 5))
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
          <h1 className="font-pixel text-lg uppercase">
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
              <p className="font-pixel text-[10px] uppercase tracking-wider">
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
              sub={`${stats.total_listings} total`}
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
              label="Revenue"
              value={bdt(stats.revenue_bdt)}
              sub="Paid orders"
              color="bg-retro-green"
            />
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
                        <p className="font-term text-xl leading-none">
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
                          <span className="shrink-0 font-term text-lg">
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
                          <p className="mt-1 font-pixel text-[7px] uppercase text-retro-red">
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
