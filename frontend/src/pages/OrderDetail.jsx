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
  MoneyRow,
  Tag,
  Textarea,
  cx,
} from '../components/ui'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { api } from '../lib/api'
import { bdt, dateTime, paymentColor, pcs, statusColor } from '../lib/format'

/** Asks the supplier to release an order they have already committed to. */
function CancelRequestModal({ open, order, onClose, onSubmit, busy }) {
  const [reason, setReason] = useState('')

  useEffect(() => {
    if (open) setReason('')
  }, [open])

  return (
    <Modal open={open} onClose={onClose} title="Request cancellation">
      <p className="text-base text-slate/85">
        <strong>{order?.product?.supplier_name}</strong> has already started work on{' '}
        <strong>{order?.reference}</strong>, so they need to approve this. Explaining why
        gets it resolved faster.
      </p>

      <div className="mt-5">
        <Field
          label="Why do you need to cancel?"
          required
          hint="At least a sentence. The supplier reads this."
        >
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={4}
            placeholder="e.g. My customer changed the order to 200 GSM, this lot no longer fits."
            maxLength={1000}
          />
        </Field>
      </div>

      <p className="mt-4 border-2 border-ink bg-parchment p-3 text-sm text-slate/80">
        Your stock stays reserved until the supplier responds, so nothing is lost if they
        decline.
      </p>

      <div className="mt-5 flex gap-3">
        <Button variant="ghost" className="flex-1" onClick={onClose} disabled={busy}>
          Keep order
        </Button>
        <Button
          variant="danger"
          className="flex-1"
          loading={busy}
          disabled={reason.trim().length < 10}
          onClick={() => onSubmit(reason.trim())}
        >
          Send request
        </Button>
      </div>
    </Modal>
  )
}

/** Status panel for whatever cancellation request exists on this order. */
function CancellationPanel({ request, onWithdraw, busy }) {
  if (!request) return null

  const TONE = {
    pending: 'bg-retro-yellow',
    approved: 'bg-retro-green',
    rejected: 'bg-retro-red text-paper',
    withdrawn: 'bg-retro-grey',
  }

  return (
    <Card className={cx('border-l-8', {
      'border-l-retro-yellow': request.status === 'pending',
      'border-l-retro-green': request.status === 'approved',
      'border-l-retro-red': request.status === 'rejected',
      'border-l-retro-grey': request.status === 'withdrawn',
    })}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="h-card text-slate">Cancellation Request</p>
        <Tag color={TONE[request.status]}>{request.status_label}</Tag>
      </div>

      <p className="mt-3 text-base text-slate/85">
        <span className="eyebrow block text-slate">Your reason</span>
        {request.reason}
      </p>

      {request.response_note && (
        <p className="mt-3 border-2 border-ink bg-parchment p-3 text-base">
          <span className="eyebrow block text-slate">Supplier replied</span>
          {request.response_note}
        </p>
      )}

      {request.status === 'pending' && (
        <>
          <p className="mt-3 text-sm text-slate/70">
            Waiting on {request.buyer_business_name ? 'the supplier' : 'a response'}. You can
            withdraw this while it is still open.
          </p>
          <Button
            variant="ghost"
            size="sm"
            className="mt-4"
            loading={busy}
            onClick={onWithdraw}
          >
            Withdraw request
          </Button>
        </>
      )}
    </Card>
  )
}

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
  const [showCancelRequest, setShowCancelRequest] = useState(false)

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
      // Quota exhausted mid-session: fall through to the request flow.
      await load()
    } finally {
      setBusy(false)
    }
  }

  const requestCancellation = async (reason) => {
    setBusy(true)
    try {
      await api.requestCancellation(id, reason)
      setShowCancelRequest(false)
      toast.success('Request sent. The supplier will respond shortly.')
      await load()
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  const withdrawCancellation = async () => {
    setBusy(true)
    try {
      setOrder(await api.withdrawCancellation(id))
      toast.info('Cancellation request withdrawn.')
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
        className="mb-6 inline-block eyebrow text-slate hover:text-retro-red"
      >
        ← Back to orders
      </Link>

      <ErrorBanner error={error} onDismiss={() => setError(null)} />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="eyebrow text-slate">
            Order Reference
          </p>
          <h1 className="mt-1 h-page text-retro-navy">
            {order.reference}
          </h1>
          <p className="mt-2 text-sm text-slate/70">Placed {dateTime(order.created_at)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Tag color={statusColor(order.order_status)}>{order.status_label}</Tag>
          <Tag color={paymentColor(order.payment_status)}>{order.payment_status_label}</Tag>
          {order.is_express && (
            <Tag color="bg-retro-orange">⚡ {order.delivery_speed_label}</Tag>
          )}
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-6">
          {order.is_express && order.promised_delivery_at && (
            <div className="border-[3px] border-ink bg-retro-orange p-4 shadow-pixel">
              <p className="eyebrow text-ink/70">Express Guarantee</p>
              <p className="mt-1.5 text-base font-semibold">
                Promised by {dateTime(order.promised_delivery_at)}
              </p>
            </div>
          )}

          <OrderTracker order={order} />

          <CancellationPanel
            request={order.cancellation_request}
            busy={busy}
            onWithdraw={withdrawCancellation}
          />

          <Card>
            <p className="h-card text-slate">
              Delivery Details
            </p>
            <div className="mt-4 space-y-3 text-base">
              <div>
                <p className="eyebrow text-slate">Address</p>
                <p className="mt-1 whitespace-pre-line">{order.delivery_address}</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="eyebrow text-slate">District</p>
                  <p className="mt-1">{order.delivery_district || '—'}</p>
                </div>
                <div>
                  <p className="eyebrow text-slate">Contact</p>
                  <p className="mt-1">
                    {order.contact_person} · {order.contact_phone}
                  </p>
                </div>
              </div>
              {order.notes && (
                <div>
                  <p className="eyebrow text-slate">Notes</p>
                  <p className="mt-1 text-slate/85">{order.notes}</p>
                </div>
              )}
            </div>
          </Card>

          {order.buyer_rating && (
            <Card className="border-l-8 border-l-retro-yellow">
              <p className="h-card text-slate">
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
            <p className="h-card text-slate">
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

            <div className="mt-4 space-y-2.5 border-t-2 border-dashed border-ink/25 pt-4">
              <MoneyRow label="Unit price" value={bdt(order.unit_price_bdt)} muted />
              <MoneyRow label="Quantity" value={pcs(order.ordered_quantity)} muted />
              <MoneyRow label="Subtotal" value={bdt(order.subtotal)} muted />
              <MoneyRow
                label="Delivery"
                value={
                  Number(order.transport_cost) === 0
                    ? 'FREE'
                    : bdt(order.transport_cost)
                }
                muted
              />
              {Number(order.express_fee) > 0 && (
                <MoneyRow label="Express surcharge" value={bdt(order.express_fee)} muted />
              )}
              <div className="flex items-end justify-between border-t-[3px] border-ink pt-3">
                <span className="h-card">Total</span>
                <span className="price text-2xl text-retro-red">
                  {bdt(order.total_price)}
                </span>
              </div>

              {/* Suppliers see what actually reaches them after commission. */}
              {role === 'supplier' && (
                <div className="mt-2 space-y-2 border-t-2 border-dashed border-ink/25 pt-3">
                  <MoneyRow
                    label={`Platform fee (${(Number(order.commission_rate) * 100).toFixed(0)}%)`}
                    value={`−${bdt(order.platform_commission)}`}
                    muted
                  />
                  <MoneyRow
                    label="Your payout"
                    value={bdt(order.supplier_payout)}
                    strong
                  />
                </div>
              )}
            </div>

            {order.payment_reference && (
              <p className="mt-3 break-all text-sm text-slate/60">
                Txn: {order.payment_reference}
              </p>
            )}
          </Card>

          <Card>
            <p className="h-card text-slate">
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
              {/* Free self-cancel while the supplier has not committed. */}
              {order.can_self_cancel && (
                <>
                  <Button
                    variant="danger"
                    className="w-full"
                    loading={busy}
                    onClick={cancel}
                  >
                    Cancel Order
                  </Button>
                  <p className="text-center text-sm text-slate/70">
                    Free — the supplier has not confirmed yet.
                  </p>
                </>
              )}

              {/* Past that point, the supplier has to agree. */}
              {order.needs_cancellation_request && !order.cancellation_request?.status && (
                <Button
                  variant="ghost"
                  className="w-full"
                  onClick={() => setShowCancelRequest(true)}
                >
                  Request Cancellation
                </Button>
              )}
              {order.needs_cancellation_request &&
                order.cancellation_request &&
                order.cancellation_request.status !== 'pending' && (
                  <Button
                    variant="ghost"
                    className="w-full"
                    onClick={() => setShowCancelRequest(true)}
                  >
                    Request Cancellation Again
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
      <CancelRequestModal
        open={showCancelRequest}
        order={order}
        busy={busy}
        onClose={() => setShowCancelRequest(false)}
        onSubmit={requestCancellation}
      />
    </div>
  )
}
