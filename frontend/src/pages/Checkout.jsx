import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'

import { BkashFlow, CardFlow } from '../components/PaymentFlow'
import PixelImage from '../components/PixelImage'
import {
  Button,
  Card,
  ErrorBanner,
  Field,
  Input,
  Loader,
  MoneyRow,
  Select,
  Tag,
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
    blurb: 'Pay now from your wallet',
    color: 'bg-retro-pink',
    icon: 'b',
  },
  {
    value: 'card',
    label: 'Card',
    blurb: 'Visa or Mastercard',
    color: 'bg-retro-blue',
    icon: '▦',
  },
  {
    value: 'cod',
    label: 'Cash on Delivery',
    blurb: 'Pay the driver on arrival',
    color: 'bg-retro-green',
    icon: '৳',
  },
]

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
  const [gateway, setGateway] = useState(null)

  const [form, setForm] = useState({
    ordered_quantity: searchParams.get('qty') || '',
    delivery_speed: searchParams.get('speed') === 'express' ? 'express' : 'standard',
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
          // Fall back to standard if the listing does not offer express.
          delivery_speed: data.express_delivery_available ? f.delivery_speed : 'standard',
        }))
      })
      .catch((err) => !cancelled && setError(err))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [productId])

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
  const expressFee =
    product && form.delivery_speed === 'express' && product.express_delivery_available
      ? Number(product.express_delivery_fee)
      : 0
  const total = subtotal + transport + expressFee

  const submitOrder = async () => {
    setError(null)
    setPlacing(true)
    try {
      const order = await api.placeOrder({
        product_id: productId,
        ordered_quantity: qty,
        payment_method: form.payment_method,
        delivery_speed: form.delivery_speed,
        delivery_address: form.delivery_address,
        delivery_district: form.delivery_district,
        contact_person: form.contact_person,
        contact_phone: form.contact_phone,
        notes: form.notes,
      })
      setGateway(null)
      toast.success(`Order ${order.reference} placed.`)
      navigate(`/orders/${order.id}`, { replace: true })
    } catch (err) {
      setError(err)
      setGateway(null)
      window.scrollTo({ top: 0, behavior: 'smooth' })
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
    // Wallet and card both walk through their gateway journey first; cash on
    // delivery has nothing to authorise, so it posts straight through.
    if (form.payment_method === 'cod') submitOrder()
    else setGateway(form.payment_method)
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
      <h1 className="h-page">
        <span className="text-retro-red">▸ </span>Checkout
      </h1>
      <p className="mt-3 text-base text-slate/85">
        Confirm the quantity, where it is going, and how you are paying.
      </p>

      <ErrorBanner error={error} onDismiss={() => setError(null)} />

      <form onSubmit={handleSubmit} className="mt-6 grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-6">
          {/* Quantity */}
          <Card>
            <p className="h-card text-slate">1 — Quantity</p>
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
                  className="price text-xl"
                />
              </Field>
              <div className="self-start border-[3px] border-ink bg-parchment p-4">
                <p className="eyebrow text-slate">Line total</p>
                <p className="price mt-1.5 text-2xl text-retro-red">{bdt(subtotal)}</p>
              </div>
            </div>
          </Card>

          {/* Delivery speed */}
          <Card>
            <p className="h-card text-slate">2 — Delivery Speed</p>
            <div className="mt-4 space-y-3">
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, delivery_speed: 'standard' }))}
                className={cx(
                  'flex w-full items-center justify-between gap-3 border-[3px] border-ink p-4 text-left transition-transform duration-75',
                  form.delivery_speed === 'standard'
                    ? 'translate-x-[2px] translate-y-[2px] bg-ink text-paper shadow-none'
                    : 'bg-paper shadow-pixel-sm hover:bg-parchment',
                )}
              >
                <span className="min-w-0">
                  <span className="block text-base font-bold">Standard Delivery</span>
                  <span
                    className={cx(
                      'mt-1 block text-sm',
                      form.delivery_speed === 'standard'
                        ? 'text-paper/75'
                        : 'text-slate/70',
                    )}
                  >
                    Road freight, typically 3–5 days
                  </span>
                </span>
                <span className="price shrink-0 text-lg">
                  {product.free_delivery ? 'FREE' : bdt(transport)}
                </span>
              </button>

              {product.express_delivery_available ? (
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, delivery_speed: 'express' }))}
                  className={cx(
                    'flex w-full items-center justify-between gap-3 border-[3px] border-ink p-4 text-left transition-transform duration-75',
                    form.delivery_speed === 'express'
                      ? 'translate-x-[2px] translate-y-[2px] bg-retro-orange shadow-none'
                      : 'bg-paper shadow-pixel-sm hover:bg-parchment',
                  )}
                >
                  <span className="min-w-0">
                    <span className="block text-base font-bold">
                      ⚡ Express — {product.express_delivery_hours} hours
                    </span>
                    <span
                      className={cx(
                        'mt-1 block text-sm',
                        form.delivery_speed === 'express'
                          ? 'text-ink/75'
                          : 'text-slate/70',
                      )}
                    >
                      Guaranteed arrival within {product.express_delivery_hours} hours of
                      confirmation
                    </span>
                  </span>
                  <span className="price shrink-0 text-lg">
                    +{bdt(product.express_delivery_fee)}
                  </span>
                </button>
              ) : (
                <p className="border-2 border-dashed border-ink/40 p-3 text-sm text-slate/70">
                  This supplier does not offer express delivery on this lot.
                </p>
              )}
            </div>
          </Card>

          {/* Delivery details */}
          <Card>
            <p className="h-card text-slate">3 — Delivery Details</p>
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
            <p className="h-card text-slate">4 — Payment</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {PAYMENT_OPTIONS.map((option) => {
                const active = form.payment_method === option.value
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, payment_method: option.value }))}
                    className={cx(
                      'flex flex-col items-start gap-2.5 border-[3px] border-ink p-4 text-left transition-transform duration-75',
                      active
                        ? 'translate-x-[2px] translate-y-[2px] bg-ink text-paper shadow-none'
                        : 'bg-paper shadow-pixel-sm hover:bg-parchment',
                    )}
                  >
                    <span
                      className={cx(
                        'grid h-9 w-9 place-items-center border-2 border-ink text-base font-bold text-ink',
                        option.color,
                      )}
                    >
                      {option.icon}
                    </span>
                    <span className="text-base font-bold">{option.label}</span>
                    <span
                      className={cx('text-sm', active ? 'text-paper/75' : 'text-slate/70')}
                    >
                      {option.blurb}
                    </span>
                  </button>
                )
              })}
            </div>
          </Card>
        </div>

        {/* Summary */}
        <aside className="lg:sticky lg:top-32 lg:self-start">
          <Card className="border-t-8 border-t-retro-red">
            <p className="h-card text-slate">Order Summary</p>

            <div className="mt-4 flex gap-3 border-b-2 border-dashed border-ink/25 pb-4">
              <PixelImage
                src={product.thumbnail}
                alt={product.title}
                seed={product.id}
                className="h-16 w-16 shrink-0 border-2 border-ink"
              />
              <div className="min-w-0">
                <p className="line-clamp-2 text-sm font-bold leading-snug">{product.title}</p>
                <p className="mt-1 text-sm text-slate/70">
                  {product.supplier.business_name}
                </p>
              </div>
            </div>

            <div className="mt-4 space-y-2.5">
              <MoneyRow label="Unit price" value={bdt(product.unit_price_bdt)} muted />
              <MoneyRow label="Quantity" value={pcs(qty)} muted />
              <MoneyRow label="Subtotal" value={bdt(subtotal)} muted />
              <MoneyRow
                label="Delivery"
                value={product.free_delivery ? 'FREE' : bdt(transport)}
                muted
              />
              {expressFee > 0 && (
                <MoneyRow
                  label={`Express (${product.express_delivery_hours}h)`}
                  value={bdt(expressFee)}
                  muted
                />
              )}
            </div>

            <div className="mt-4 flex items-end justify-between border-t-[3px] border-ink pt-4">
              <span className="h-card">Total</span>
              <span className="price text-3xl text-retro-red">{bdt(total)}</span>
            </div>

            {form.delivery_speed === 'express' && (
              <div className="mt-4 border-2 border-ink bg-retro-orange p-3">
                <p className="text-sm font-semibold">
                  ⚡ Express: arriving within {product.express_delivery_hours} hours of the
                  supplier confirming.
                </p>
              </div>
            )}

            <Button
              type="submit"
              size="lg"
              className="mt-5 w-full"
              loading={placing && form.payment_method === 'cod'}
              disabled={qty < product.moq}
            >
              {form.payment_method === 'cod' ? 'Place Order' : `Pay ${bdt(total)}`}
            </Button>

            <p className="mt-3 text-center text-sm text-slate/70">
              Stock is reserved the moment your order is placed.
            </p>
          </Card>

          <div className="mt-4 flex items-start gap-2.5 border-[3px] border-ink bg-parchment p-3">
            <Tag color="bg-retro-green">✓</Tag>
            <p className="text-sm text-slate/80">
              Cancel free of charge any time before the supplier confirms.
            </p>
          </div>
        </aside>
      </form>

      <BkashFlow
        open={gateway === 'bkash'}
        amount={total}
        reference={product.id.slice(0, 8).toUpperCase()}
        submitting={placing}
        onClose={() => setGateway(null)}
        onConfirm={submitOrder}
      />
      <CardFlow
        open={gateway === 'card'}
        amount={total}
        reference={product.id.slice(0, 8).toUpperCase()}
        submitting={placing}
        onClose={() => setGateway(null)}
        onConfirm={submitOrder}
      />
    </div>
  )
}
