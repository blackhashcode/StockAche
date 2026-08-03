import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import OrderTracker from '../components/OrderTracker'
import PixelImage from '../components/PixelImage'
import {
  Button,
  Card,
  ErrorBanner,
  Field,
  Loader,
  Modal,
  Tag,
  Textarea,
  cx,
} from '../components/ui'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { api } from '../lib/api'
import { bdt, dateTime, paymentColor, pcs, statusColor } from '../lib/format'

function ReviewModal({ open, onClose, onSubmit, busy }) {
  const [rating, setRating] = useState(5)
  const [review, setReview] = useState('')

  return (
    <Modal open={open} onClose={onClose} title="Rate this supplier">
      <p className="text-sm text-slate/85">
        Your rating shows on the supplier&apos;s public page and helps other SME buyers.
      </p>

      <div className="mt-5 flex justify-center gap-2">
        {[1, 2, 3, 4, 5].map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setRating(value)}
            className={cx(
              'grid h-12 w-12 place-items-center border-[3px] border-ink text-xl transition-transform duration-75',
              value <= rating ? 'bg-retro-yellow shadow-pixel-sm' : 'bg-paper text-slate/30',
            )}
            aria-label={`${value} star${value > 1 ? 's' : ''}`}
          >
            ★
          </button>
        ))}
      </div>

      <div className="mt-5">
        <Field label="Comments">
          <Textarea
            value={review}
            onChange={(e) => setReview(e.target.value)}
            rows={3}
            placeholder="Did the quality match the listing?"
          />
        </Field>
      </div>

      <div className="mt-5 flex gap-3">
        <Button variant="ghost" className="flex-1" onClick={onClose}>
          Cancel
        </Button>
        <Button className="flex-1" loading={busy} onClick={() => onSubmit(rating, review)}>
          Submit
        </Button>
      </div>
    </Modal>
  )
}

export default function OrderDetail() {
  const { id } = useParams()
  const { role } = useAuth()
  const toast = useToast()

  const [order, setOrder] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [showReview, setShowReview] = useState(false)

  const load = useCallback(async () => {
    try {
      setOrder(await api.order(id))
      setError(null)
    } catch (err) {
      setError(err)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  // Poll while the order is moving so the tracker updates without a refresh.
  useEffect(() => {
    if (!order) return undefined
    const settled = ['delivered', 'cancelled'].includes(order.order_status)
    if (settled) return undefined
    const timer = setInterval(load, 15000)
    return () => clearInterval(timer)
  }, [order, load])

  const cancel = async () => {
    setBusy(true)
    try {
      setOrder(await api.cancelOrder(id))
      toast.success('Order cancelled and stock returned.')
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  const submitReview = async (rating, review) => {
    setBusy(true)
    try {
      setOrder(await api.reviewOrder(id, rating, review))
      setShowReview(false)
      toast.success('Thanks for the review.')
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <Loader label="Loading order" />
  if (!order) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12">
        <ErrorBanner error={error} />
        <Link to="/orders">
          <Button variant="dark">← Back to Orders</Button>
        </Link>
      </div>
    )
  }

  const backLink = role === 'supplier' ? '/supplier/orders' : '/orders'

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <Link
        to={backLink}
        className="mb-6 inline-block font-pixel text-[9px] uppercase tracking-wider text-slate hover:text-retro-red"
      >
        ← Back to orders
      </Link>

      <ErrorBanner error={error} onDismiss={() => setError(null)} />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-pixel text-[9px] uppercase tracking-wider text-slate">
            Order Reference
          </p>
          <h1 className="mt-1 font-pixel text-lg uppercase text-retro-navy">
            {order.reference}
          </h1>
          <p className="mt-2 text-sm text-slate/70">Placed {dateTime(order.created_at)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Tag color={statusColor(order.order_status)}>{order.status_label}</Tag>
          <Tag color={paymentColor(order.payment_status)}>{order.payment_status_label}</Tag>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-6">
          <OrderTracker order={order} />

          <Card>
            <p className="font-pixel text-[10px] uppercase tracking-wider text-slate">
              Delivery Details
            </p>
            <div className="mt-4 space-y-3 text-sm">
              <div>
                <p className="font-pixel text-[8px] uppercase text-slate">Address</p>
                <p className="mt-1 whitespace-pre-line">{order.delivery_address}</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="font-pixel text-[8px] uppercase text-slate">District</p>
                  <p className="mt-1">{order.delivery_district || '—'}</p>
                </div>
                <div>
                  <p className="font-pixel text-[8px] uppercase text-slate">Contact</p>
                  <p className="mt-1">
                    {order.contact_person} · {order.contact_phone}
                  </p>
                </div>
              </div>
              {order.notes && (
                <div>
                  <p className="font-pixel text-[8px] uppercase text-slate">Notes</p>
                  <p className="mt-1 text-slate/85">{order.notes}</p>
                </div>
              )}
            </div>
          </Card>

          {order.buyer_rating && (
            <Card className="border-l-8 border-l-retro-yellow">
              <p className="font-pixel text-[10px] uppercase tracking-wider text-slate">
                Your Review
              </p>
              <p className="mt-2 text-2xl leading-none text-retro-orange">
                {'★'.repeat(order.buyer_rating)}
                <span className="text-slate/25">{'★'.repeat(5 - order.buyer_rating)}</span>
              </p>
              {order.buyer_review && (
                <p className="mt-3 text-sm text-slate/85">{order.buyer_review}</p>
              )}
            </Card>
          )}
        </div>

        <aside className="space-y-6">
          <Card>
            <p className="font-pixel text-[10px] uppercase tracking-wider text-slate">
              The Lot
            </p>
            <div className="mt-4 flex gap-3">
              <PixelImage
                src={order.product.thumbnail}
                alt={order.product.title}
                seed={order.product.id}
                className="h-16 w-16 shrink-0 border-2 border-ink"
              />
              <div className="min-w-0">
                <Link
                  to={`/product/${order.product.id}`}
                  className="line-clamp-2 text-sm font-bold leading-snug hover:text-retro-red"
                >
                  {order.product.title}
                </Link>
                <p className="mt-1 text-xs text-slate/70">{order.product.gsm} GSM</p>
              </div>
            </div>

            <div className="mt-4 space-y-2 border-t-2 border-dashed border-ink/25 pt-4 text-sm">
              <div className="flex justify-between">
                <span className="text-slate/80">Unit price</span>
                <span className="font-medium">{bdt(order.unit_price_bdt)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate/80">Quantity</span>
                <span className="font-medium">{pcs(order.ordered_quantity)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate/80">Subtotal</span>
                <span className="font-medium">{bdt(order.subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate/80">Transport</span>
                <span className="font-medium">{bdt(order.transport_cost)}</span>
              </div>
              <div className="flex items-end justify-between border-t-[3px] border-ink pt-3">
                <span className="font-pixel text-[9px] uppercase">Total</span>
                <span className="font-term text-3xl leading-none text-retro-red">
                  {bdt(order.total_price)}
                </span>
              </div>
            </div>

            {order.payment_reference && (
              <p className="mt-3 break-all text-xs text-slate/60">
                Txn: {order.payment_reference}
              </p>
            )}
          </Card>

          <Card>
            <p className="font-pixel text-[10px] uppercase tracking-wider text-slate">
              {role === 'supplier' ? 'Buyer' : 'Supplier'}
            </p>
            <p className="mt-2 text-sm font-bold">
              {role === 'supplier'
                ? order.buyer_business_name
                : order.product.supplier_name}
            </p>
            <p className="mt-1 text-xs text-slate/70">
              {role === 'supplier' ? order.contact_phone : order.product.supplier_phone}
            </p>
          </Card>

          {role === 'buyer' && (
            <div className="space-y-3">
              {order.order_status === 'placed' && (
                <Button variant="danger" className="w-full" loading={busy} onClick={cancel}>
                  Cancel Order
                </Button>
              )}
              {order.order_status === 'delivered' && !order.buyer_rating && (
                <Button
                  variant="secondary"
                  className="w-full"
                  onClick={() => setShowReview(true)}
                >
                  ★ Rate Supplier
                </Button>
              )}
              {['confirmed', 'dispatched', 'in_transit'].includes(order.order_status) && (
                <p className="border-2 border-ink bg-parchment p-3 text-xs text-slate/80">
                  The supplier is handling this order. Contact them directly to change
                  anything.
                </p>
              )}
            </div>
          )}
        </aside>
      </div>

      <ReviewModal
        open={showReview}
        busy={busy}
        onClose={() => setShowReview(false)}
        onSubmit={submitReview}
      />
    </div>
  )
}
