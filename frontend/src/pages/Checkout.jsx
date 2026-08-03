import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'

import PixelImage from '../components/PixelImage'
import {
  Button,
  Card,
  ErrorBanner,
  Field,
  Input,
  Loader,
  Modal,
  Select,
  Textarea,
  cx,
} from '../components/ui'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { useMeta } from '../hooks/useMeta'
import { api } from '../lib/api'
import { bdt, pcs } from '../lib/format'

const PAYMENT_OPTIONS = [
  {
    value: 'bkash',
    label: 'bKash',
    blurb: 'Pay now from your bKash wallet',
    color: 'bg-retro-pink',
    icon: 'b',
  },
  {
    value: 'card',
    label: 'Card',
    blurb: 'Visa / Mastercard, paid up front',
    color: 'bg-retro-blue',
    icon: '▦',
  },
  {
    value: 'cod',
    label: 'Cash on Delivery',
    blurb: 'Pay the driver when the lot arrives',
    color: 'bg-retro-green',
    icon: '৳',
  },
]

/** Fake bKash confirmation so the demo shows a realistic wallet step. */
function BkashModal({ open, amount, onClose, onConfirm, busy }) {
  const [pin, setPin] = useState('')
  return (
    <Modal open={open} onClose={busy ? () => {} : onClose} title="bKash — Mock Payment">
      <div className="border-[3px] border-ink bg-retro-pink p-4 text-center">
        <p className="font-pixel text-[9px] uppercase tracking-wider">Amount</p>
        <p className="mt-2 font-term text-4xl leading-none">{bdt(amount)}</p>
      </div>

      <p className="mt-4 text-sm text-slate/85">
        This is a simulated gateway. Enter any 4 digits to approve — no real transaction is
        made and no credentials are sent anywhere.
      </p>

      <div className="mt-4">
        <Field label="Wallet PIN (any 4 digits)">
          <Input
            type="text"
            inputMode="numeric"
            maxLength={4}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
            placeholder="••••"
            className="text-center font-term text-3xl tracking-[0.5em]"
          />
        </Field>
      </div>

      <div className="mt-5 flex gap-3">
        <Button variant="ghost" className="flex-1" onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button
          className="flex-1"
          onClick={onConfirm}
          disabled={pin.length !== 4}
          loading={busy}
        >
          Approve
        </Button>
      </div>
    </Modal>
  )
}

export default function Checkout() {
  const { productId } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { buyerProfile, account } = useAuth()
  const { meta } = useMeta()
  const toast = useToast()

  const [product, setProduct] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [placing, setPlacing] = useState(false)
  const [showBkash, setShowBkash] = useState(false)

  const [form, setForm] = useState({
    ordered_quantity: searchParams.get('qty') || '',
    payment_method: 'bkash',
    delivery_address: '',
    delivery_district: '',
    contact_person: '',
    contact_phone: '',
    notes: '',
  })

  useEffect(() => {
    let cancelled = false
    api
      .product(productId)
      .then((data) => {
        if (cancelled) return
        setProduct(data)
        setForm((f) => ({
          ...f,
          ordered_quantity: f.ordered_quantity || String(data.moq),
        }))
      })
      .catch((err) => !cancelled && setError(err))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [productId])

  // Prefill delivery details from the buyer's saved profile.
  useEffect(() => {
    if (!buyerProfile) return
    setForm((f) => ({
      ...f,
      delivery_address: f.delivery_address || buyerProfile.address || '',
      delivery_district: f.delivery_district || buyerProfile.district || '',
      contact_person: f.contact_person || account?.full_name || '',
      contact_phone: f.contact_phone || buyerProfile.contact_phone || '',
    }))
  }, [buyerProfile, account])

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  const qty = Number(form.ordered_quantity) || 0
  const subtotal = product ? qty * Number(product.unit_price_bdt) : 0
  const transport = product ? Number(product.estimated_transport_cost) : 0
  const total = subtotal + transport

  const submitOrder = async () => {
    setError(null)
    setPlacing(true)
    try {
      const order = await api.placeOrder({
        product_id: productId,
        ordered_quantity: qty,
        payment_method: form.payment_method,
        delivery_address: form.delivery_address,
        delivery_district: form.delivery_district,
        contact_person: form.contact_person,
        contact_phone: form.contact_phone,
        notes: form.notes,
      })
      setShowBkash(false)
      toast.success(`Order ${order.reference} placed.`)
      navigate(`/orders/${order.id}`, { replace: true })
    } catch (err) {
      setError(err)
      setShowBkash(false)
    } finally {
      setPlacing(false)
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!product) return
    if (qty < product.moq) {
      setError({ message: `Minimum order quantity is ${pcs(product.moq)}.` })
      return
    }
    // bKash gets an extra confirmation step; card/COD post straight through.
    if (form.payment_method === 'bkash') setShowBkash(true)
    else submitOrder()
  }

  if (loading) return <Loader label="Preparing checkout" />
  if (!product) {
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
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="font-pixel text-lg uppercase">
        <span className="text-retro-red">▸ </span>Checkout
      </h1>
      <p className="mt-2 text-sm text-slate/80">
        Confirm the quantity, where it&apos;s going, and how you&apos;re paying.
      </p>

      <ErrorBanner error={error} onDismiss={() => setError(null)} />

      <form onSubmit={handleSubmit} className="mt-6 grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-6">
          {/* Quantity */}
          <Card>
            <p className="font-pixel text-[10px] uppercase tracking-wider text-slate">
              1 — Quantity
            </p>
            <div className="mt-4 grid gap-5 sm:grid-cols-2">
              <Field
                label="Pieces"
                required
                hint={`MOQ ${pcs(product.moq)} · ${pcs(product.available_quantity)} available`}
              >
                <Input
                  type="number"
                  min={product.moq}
                  max={product.available_quantity}
                  value={form.ordered_quantity}
                  onChange={set('ordered_quantity')}
                  required
                  className="font-term text-2xl"
                />
              </Field>
              <div className="self-end border-[3px] border-ink bg-parchment p-3">
                <p className="font-pixel text-[8px] uppercase tracking-wider text-slate">
                  Line total
                </p>
                <p className="font-term text-3xl leading-none text-retro-red">
                  {bdt(subtotal)}
                </p>
              </div>
            </div>
          </Card>

          {/* Delivery */}
          <Card>
            <p className="font-pixel text-[10px] uppercase tracking-wider text-slate">
              2 — Delivery
            </p>
            <div className="mt-4 space-y-5">
              <Field label="Delivery Address" required>
                <Textarea
                  value={form.delivery_address}
                  onChange={set('delivery_address')}
                  rows={3}
                  placeholder="House, road, area, city, postcode"
                  required
                />
              </Field>

              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="District">
                  <Select value={form.delivery_district} onChange={set('delivery_district')}>
                    <option value="">Select district</option>
                    {meta.districts.map((district) => (
                      <option key={district} value={district}>
                        {district}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Contact Person" required>
                  <Input
                    value={form.contact_person}
                    onChange={set('contact_person')}
                    placeholder="Who receives the lot?"
                    required
                  />
                </Field>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Contact Phone" required>
                  <Input
                    value={form.contact_phone}
                    onChange={set('contact_phone')}
                    placeholder="+8801XXXXXXXXX"
                    required
                  />
                </Field>
                <Field label="Notes for Supplier">
                  <Input
                    value={form.notes}
                    onChange={set('notes')}
                    placeholder="Size ratio, packing preference…"
                  />
                </Field>
              </div>
            </div>
          </Card>

          {/* Payment */}
          <Card>
            <p className="font-pixel text-[10px] uppercase tracking-wider text-slate">
              3 — Payment
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {PAYMENT_OPTIONS.map((option) => {
                const active = form.payment_method === option.value
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, payment_method: option.value }))}
                    className={cx(
                      'flex flex-col items-start gap-2 border-[3px] border-ink p-3 text-left transition-transform duration-75',
                      active
                        ? 'translate-x-[2px] translate-y-[2px] bg-ink text-paper shadow-none'
                        : 'bg-paper shadow-pixel-sm hover:bg-parchment',
                    )}
                  >
                    <span
                      className={cx(
                        'grid h-8 w-8 place-items-center border-2 border-ink font-pixel text-[11px] text-ink',
                        option.color,
                      )}
                    >
                      {option.icon}
                    </span>
                    <span className="font-pixel text-[9px] uppercase">{option.label}</span>
                    <span className={cx('text-xs', active ? 'text-paper/75' : 'text-slate/70')}>
                      {option.blurb}
                    </span>
                  </button>
                )
              })}
            </div>

            <p className="mt-4 border-2 border-ink bg-retro-yellow p-2 text-xs">
              ⚠ Prototype: payments run in <strong>mock mode</strong>. No money moves and no
              card or wallet details are collected.
            </p>
          </Card>
        </div>

        {/* Summary */}
        <aside className="lg:sticky lg:top-32 lg:self-start">
          <Card className="border-t-8 border-t-retro-red">
            <p className="font-pixel text-[10px] uppercase tracking-wider text-slate">
              Order Summary
            </p>

            <div className="mt-4 flex gap-3 border-b-2 border-dashed border-ink/25 pb-4">
              <PixelImage
                src={product.thumbnail}
                alt={product.title}
                seed={product.id}
                className="h-16 w-16 shrink-0 border-2 border-ink"
              />
              <div className="min-w-0">
                <p className="line-clamp-2 text-sm font-bold leading-snug">{product.title}</p>
                <p className="mt-1 text-xs text-slate/70">
                  {product.supplier.business_name}
                </p>
              </div>
            </div>

            <div className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate/80">Unit price</span>
                <span className="font-medium">{bdt(product.unit_price_bdt)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate/80">Quantity</span>
                <span className="font-medium">{pcs(qty)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate/80">Subtotal</span>
                <span className="font-medium">{bdt(subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate/80">Transport</span>
                <span className="font-medium">{bdt(transport)}</span>
              </div>
            </div>

            <div className="mt-4 flex items-end justify-between border-t-[3px] border-ink pt-3">
              <span className="font-pixel text-[10px] uppercase">Total</span>
              <span className="font-term text-4xl leading-none text-retro-red">
                {bdt(total)}
              </span>
            </div>

            <Button
              type="submit"
              size="lg"
              className="mt-5 w-full"
              loading={placing && form.payment_method !== 'bkash'}
              disabled={qty < product.moq}
            >
              {form.payment_method === 'cod' ? 'Place Order' : `Pay ${bdt(total)}`}
            </Button>

            <p className="mt-3 text-center text-xs text-slate/70">
              Stock is reserved the moment your order is placed.
            </p>
          </Card>
        </aside>
      </form>

      <BkashModal
        open={showBkash}
        amount={total}
        busy={placing}
        onClose={() => setShowBkash(false)}
        onConfirm={submitOrder}
      />
    </div>
  )
}
