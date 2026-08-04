import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import PixelImage from '../components/PixelImage'
import {
  Button,
  Card,
  EmptyState,
  ErrorBanner,
  Loader,
  Modal,
  Tag,
} from '../components/ui'
import { useToast } from '../context/ToastContext'
import { api } from '../lib/api'
import { bdt, pcs, shortDate } from '../lib/format'


export default function SupplierListings() {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [busy, setBusy] = useState(false)
  const toast = useToast()

  const load = () => {
    setLoading(true)
    api
      .myProducts()
      .then((data) => {
        setProducts(data)
        setError(null)
      })
      .catch(setError)
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  const toggleActive = async (product) => {
    try {
      const updated = await api.updateProduct(product.id, { is_active: !product.is_active })
      setProducts((list) => list.map((p) => (p.id === updated.id ? updated : p)))
      toast.success(updated.is_active ? 'Listing is live again.' : 'Listing paused.')
    } catch (err) {
      setError(err)
    }
  }

  const remove = async () => {
    setBusy(true)
    try {
      await api.deleteProduct(confirmDelete.id)
      toast.success('Listing removed.')
      setConfirmDelete(null)
      load()
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <Loader label="Loading listings" />

  const soldOutCount = products.filter((p) => p.is_active && p.is_sold_out).length

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="h-page">
            <span className="text-retro-red">▸ </span>My Listings
          </h1>
          <p className="mt-2 text-base text-slate/80">
            {products.length} lot{products.length === 1 ? '' : 's'} ·{' '}
            {products.filter((p) => p.is_active && !p.is_sold_out).length} selling
            {soldOutCount > 0 && (
              <span className="font-semibold text-retro-red">
                {' '}
                · {soldOutCount} sold out
              </span>
            )}
          </p>
        </div>
        <Link to="/supplier/listings/new">
          <Button size="lg">+ New Listing</Button>
        </Link>
      </div>

      <div className="mt-6">
        <ErrorBanner error={error} onDismiss={() => setError(null)} />

        {products.length === 0 ? (
          <EmptyState
            icon="▦"
            title="No stocklots listed yet"
            message="Add your first lot with photos, GSM, composition and MOQ. Buyers filter on all of it."
            action={
              <Link to="/supplier/listings/new" className="mt-2">
                <Button>Create Listing</Button>
              </Link>
            }
          />
        ) : (
          <div className="space-y-4">
            {products.map((product) => (
              <Card key={product.id}>
                <div className="flex flex-wrap items-start gap-4">
                  <PixelImage
                    src={product.thumbnail}
                    alt={product.title}
                    seed={product.id}
                    className="h-24 w-24 shrink-0 border-[3px] border-ink"
                  />

                  <div className="min-w-[14rem] flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {/* Sold out and paused are different things: one is
                          stock, the other is the supplier's own choice. */}
                      {!product.is_active ? (
                        <Tag color="bg-retro-grey">Paused</Tag>
                      ) : product.is_sold_out ? (
                        <Tag color="bg-retro-red text-paper">Sold Out</Tag>
                      ) : (
                        <Tag color="bg-retro-green">Live</Tag>
                      )}
                      <Tag color="bg-retro-yellow">{product.category_label}</Tag>
                      <Tag color="bg-ink text-paper">{product.gsm} GSM</Tag>
                    </div>
                    <h2 className="mt-2 text-base font-bold leading-snug">{product.title}</h2>
                    <p className="mt-1 text-sm text-slate/70">
                      {product.fabric_composition} · listed {shortDate(product.created_at)}
                    </p>

                    <div className="mt-3 grid max-w-md grid-cols-3 gap-3">
                      {[
                        ['Unit', bdt(product.unit_price_bdt), false],
                        ['MOQ', `${product.moq}`, false],
                        [
                          'In stock',
                          `${product.available_quantity}`,
                          product.is_sold_out,
                        ],
                      ].map(([label, value, alert]) => (
                        <div
                          key={label}
                          className={`border-2 border-ink p-2 ${
                            alert ? 'bg-retro-red text-paper' : 'bg-parchment'
                          }`}
                        >
                          <p className={`eyebrow ${alert ? 'text-paper/80' : 'text-slate'}`}>
                            {label}
                          </p>
                          <p className="price text-xl">{value}</p>
                        </div>
                      ))}
                    </div>

                    {product.is_active && product.is_sold_out && (
                      <div className="mt-3 border-2 border-ink bg-retro-yellow p-3">
                        <p className="text-sm">
                          <strong>Sold out.</strong> Buyers can still see this lot, marked
                          sold out. Edit it and raise the available quantity to at least{' '}
                          {pcs(product.moq)} to start selling again.
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="flex shrink-0 flex-col gap-2">
                    <Link to={`/supplier/listings/${product.id}/edit`}>
                      <Button size="sm" variant="dark" className="w-full">
                        Edit
                      </Button>
                    </Link>
                    <Button
                      size="sm"
                      variant={product.is_active ? 'ghost' : 'success'}
                      onClick={() => toggleActive(product)}
                    >
                      {product.is_active ? 'Pause' : 'Publish'}
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => setConfirmDelete(product)}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Modal
        open={Boolean(confirmDelete)}
        onClose={() => setConfirmDelete(null)}
        title="Delete listing?"
      >
        <p className="text-sm text-slate/85">
          <strong>{confirmDelete?.title}</strong> will be removed from the marketplace. If it
          already has orders it is paused instead of deleted, so order history stays intact.
        </p>
        <div className="mt-5 flex gap-3">
          <Button variant="ghost" className="flex-1" onClick={() => setConfirmDelete(null)}>
            Keep it
          </Button>
          <Button variant="danger" className="flex-1" loading={busy} onClick={remove}>
            Delete
          </Button>
        </div>
      </Modal>
    </div>
  )
}
