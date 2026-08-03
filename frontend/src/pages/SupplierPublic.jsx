import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import ProductCard, { VerifiedBadge } from '../components/ProductCard'
import { Button, Card, EmptyState, ErrorBanner, Loader, SectionTitle } from '../components/ui'
import { api } from '../lib/api'
import { shortDate } from '../lib/format'

export default function SupplierPublic() {
  const { id } = useParams()
  const [supplier, setSupplier] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    api
      .supplierPublic(id)
      .then((data) => !cancelled && (setSupplier(data), setError(null)))
      .catch((err) => !cancelled && setError(err))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [id])

  if (loading) return <Loader label="Loading supplier" />
  if (!supplier) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12">
        <ErrorBanner error={error} />
        <Link to="/marketplace">
          <Button variant="dark">← Back to Marketplace</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <Link
        to="/marketplace"
        className="mb-6 inline-block font-pixel text-[9px] uppercase tracking-wider text-slate hover:text-retro-red"
      >
        ← Back to feed
      </Link>

      <Card className="border-t-8 border-t-retro-purple">
        <div className="flex flex-wrap items-start gap-5">
          <div className="grid h-20 w-20 shrink-0 place-items-center border-[3px] border-ink bg-retro-purple font-pixel text-2xl text-paper">
            {supplier.business_name[0]}
          </div>

          <div className="min-w-[14rem] flex-1">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-bold leading-tight">{supplier.business_name}</h1>
              <VerifiedBadge verified={supplier.is_verified} />
            </div>
            <p className="mt-2 text-sm text-slate/70">
              {supplier.district || 'Bangladesh'} · On StockAche since{' '}
              {shortDate(supplier.created_at)}
            </p>
            {supplier.about && (
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate/85">
                {supplier.about}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="border-[3px] border-ink bg-parchment p-3 text-center">
              <p className="font-term text-3xl leading-none">
                {supplier.rating > 0 ? supplier.rating : '—'}
              </p>
              <p className="mt-1 font-pixel text-[7px] uppercase text-slate">Rating</p>
            </div>
            <div className="border-[3px] border-ink bg-parchment p-3 text-center">
              <p className="font-term text-3xl leading-none">{supplier.listings.length}</p>
              <p className="mt-1 font-pixel text-[7px] uppercase text-slate">Live Lots</p>
            </div>
          </div>
        </div>

        {!supplier.is_verified && (
          <p className="mt-5 border-2 border-ink bg-retro-yellow p-3 text-sm">
            ⚠ This supplier has not completed trade-licence verification. Cash on delivery is
            the safer choice until they do.
          </p>
        )}
      </Card>

      <div className="mt-10">
        <SectionTitle>Live Stocklots</SectionTitle>
        {supplier.listings.length === 0 ? (
          <EmptyState
            icon="▦"
            title="No live lots right now"
            message="This supplier has no active listings. Check back soon."
          />
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {supplier.listings.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
