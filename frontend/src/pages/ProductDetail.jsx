import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import PixelImage from '../components/PixelImage'
import { VerifiedBadge } from '../components/ProductCard'
import { Button, Card, ErrorBanner, Input, Loader, Tag, cx } from '../components/ui'
import { useAuth } from '../context/AuthContext'
import { api } from '../lib/api'
import { bdt, pcs } from '../lib/format'

function SpecRow({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b-2 border-dashed border-ink/25 py-2.5 last:border-0">
      <span className="eyebrow text-slate">
        {label}
      </span>
      <span className="text-right text-sm font-medium">{value || '—'}</span>
    </div>
  )
}

/** Quantity × unit price + delivery, computed live. */
function FeeCalculator({ product, quantity, setQuantity, speed, setSpeed }) {
  const qty = Number(quantity) || 0
  const subtotal = qty * Number(product.unit_price_bdt)
  const transport = Number(product.estimated_transport_cost)
  const expressFee =
    speed === 'express' && product.express_delivery_available
      ? Number(product.express_delivery_fee)
      : 0
  const total = subtotal + transport + expressFee
  const belowMoq = qty > 0 && qty < product.moq
  const overStock = qty > product.available_quantity

  const perPiece = qty > 0 ? total / qty : 0

  return (
    <Card className="border-t-8 border-t-retro-blue">
      <p className="h-card text-slate">
        Fee Calculator
      </p>

      <div className="mt-4">
        <span className="pixel-label">Quantity (pcs)</span>
        <div className="flex items-stretch gap-2">
          <button
            type="button"
            onClick={() => setQuantity(String(Math.max(product.moq, qty - product.moq)))}
            className="pixel-btn bg-parchment px-3 py-0 text-ink"
            aria-label="Decrease quantity"
          >
            −
          </button>
          <Input
            type="number"
            min={product.moq}
            max={product.available_quantity}
            step="1"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className="text-center price text-2xl"
          />
          <button
            type="button"
            onClick={() =>
              setQuantity(String(Math.min(product.available_quantity, qty + product.moq)))
            }
            className="pixel-btn bg-parchment px-3 py-0 text-ink"
            aria-label="Increase quantity"
          >
            +
          </button>
        </div>

        <div className="mt-2 flex flex-wrap gap-2">
          {[1, 2, 5].map((multiple) => {
            const value = product.moq * multiple
            if (value > product.available_quantity) return null
            return (
              <button
                key={multiple}
                type="button"
                onClick={() => setQuantity(String(value))}
                className={cx(
                  'pixel-tag transition-colors',
                  qty === value ? 'bg-retro-blue text-paper' : 'bg-paper hover:bg-parchment',
                )}
              >
                {multiple}× MOQ
              </button>
            )
          })}
          <button
            type="button"
            onClick={() => setQuantity(String(product.available_quantity))}
            className="pixel-tag bg-paper transition-colors hover:bg-parchment"
          >
            Whole lot
          </button>
        </div>
      </div>

      {/* Delivery speed */}
      <div className="mt-6">
        <span className="pixel-label">Delivery</span>
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => setSpeed('standard')}
            className={cx(
              'flex w-full items-center justify-between gap-3 border-[3px] border-ink p-3 text-left transition-transform duration-75',
              speed === 'standard'
                ? 'translate-x-[2px] translate-y-[2px] bg-ink text-paper shadow-none'
                : 'bg-paper shadow-pixel-sm hover:bg-parchment',
            )}
          >
            <span className="min-w-0">
              <span className="block text-sm font-bold uppercase tracking-[0.06em]">
                Standard
              </span>
              <span
                className={cx(
                  'block text-sm',
                  speed === 'standard' ? 'text-paper/75' : 'text-slate/70',
                )}
              >
                Usual 3–5 day road freight
              </span>
            </span>
            <span className="price shrink-0 text-base">
              {product.free_delivery ? 'FREE' : bdt(transport)}
            </span>
          </button>

          {product.express_delivery_available && (
            <button
              type="button"
              onClick={() => setSpeed('express')}
              className={cx(
                'flex w-full items-center justify-between gap-3 border-[3px] border-ink p-3 text-left transition-transform duration-75',
                speed === 'express'
                  ? 'translate-x-[2px] translate-y-[2px] bg-retro-orange shadow-none'
                  : 'bg-paper shadow-pixel-sm hover:bg-parchment',
              )}
            >
              <span className="min-w-0">
                <span className="block text-sm font-bold uppercase tracking-[0.06em]">
                  ⚡ Express — {product.express_delivery_hours}h
                </span>
                <span
                  className={cx(
                    'block text-sm',
                    speed === 'express' ? 'text-ink/75' : 'text-slate/70',
                  )}
                >
                  Guaranteed within {product.express_delivery_hours} hours
                </span>
              </span>
              <span className="price shrink-0 text-base">
                +{bdt(product.express_delivery_fee)}
              </span>
            </button>
          )}
        </div>
      </div>

      <div className="mt-6 space-y-2.5 border-t-2 border-dashed border-ink/25 pt-4">
        <div className="flex items-baseline justify-between gap-3 text-sm">
          <span className="text-slate/80">
            {pcs(qty)} × {bdt(product.unit_price_bdt)}
          </span>
          <span className="price text-base">{bdt(subtotal)}</span>
        </div>
        <div className="flex items-baseline justify-between gap-3 text-sm">
          <span className="text-slate/80">
            {product.free_delivery ? 'Delivery (free)' : 'Delivery'}
          </span>
          <span
            className={cx(
              'price text-base',
              product.free_delivery && 'text-retro-green',
            )}
          >
            {product.free_delivery ? 'FREE' : bdt(transport)}
          </span>
        </div>
        {expressFee > 0 && (
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="text-slate/80">
              Express surcharge ({product.express_delivery_hours}h)
            </span>
            <span className="price text-base text-retro-orange">
              {bdt(expressFee)}
            </span>
          </div>
        )}
        <div className="flex items-end justify-between gap-3 border-t-[3px] border-ink pt-3">
          <span className="h-card">Total</span>
          <span className="price text-3xl text-retro-red">{bdt(total)}</span>
        </div>
        {qty > 0 && (
          <p className="text-right text-sm text-slate/70">
            ≈ {bdt(perPiece)} per piece, landed
          </p>
        )}
      </div>

      {belowMoq && (
        <p className="mt-4 border-2 border-ink bg-retro-yellow p-3 text-sm">
          ⚠ Below the supplier&apos;s MOQ of {pcs(product.moq)}.
        </p>
      )}
      {overStock && (
        <p className="mt-4 border-2 border-ink bg-retro-red p-3 text-sm text-paper">
          ⚠ Only {pcs(product.available_quantity)} left in this lot.
        </p>
      )}
    </Card>
  )
}

export default function ProductDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { isAuthenticated, role } = useAuth()

  const [product, setProduct] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [activeImage, setActiveImage] = useState(0)
  const [quantity, setQuantity] = useState('')
  const [speed, setSpeed] = useState('standard')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    api
      .product(id)
      .then((data) => {
        if (cancelled) return
        setProduct(data)
        setQuantity(String(data.moq))
        setError(null)
      })
      .catch((err) => !cancelled && setError(err))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [id])

  const qty = Number(quantity) || 0
  const canOrder = useMemo(
    () => product && qty >= product.moq && qty <= product.available_quantity,
    [product, qty],
  )

  if (loading) return <Loader label="Loading lot" />
  if (error) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12">
        <ErrorBanner error={error} />
        <Link to="/marketplace">
          <Button variant="dark">← Back to Marketplace</Button>
        </Link>
      </div>
    )
  }
  if (!product) return null

  const images = product.images?.length ? product.images : [null]

  const checkoutPath = `/checkout/${product.id}?qty=${qty}&speed=${speed}`

  const handleOrder = () => {
    if (!isAuthenticated) {
      navigate('/login', { state: { from: checkoutPath } })
      return
    }
    if (role === 'supplier') return
    navigate(checkoutPath)
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <Link
        to="/marketplace"
        className="mb-6 inline-block eyebrow text-slate hover:text-retro-red"
      >
        ← Back to feed
      </Link>

      <div className="grid gap-8 lg:grid-cols-[1.15fr_1fr]">
        {/* Gallery + specs */}
        <div>
          <div className="border-[3px] border-ink shadow-pixel">
            <PixelImage
              src={images[activeImage]}
              alt={product.title}
              seed={product.id}
              className="aspect-[4/3] w-full"
            />
          </div>

          {images.length > 1 && (
            <div className="mt-3 flex gap-3 overflow-x-auto pb-1 no-scrollbar">
              {images.map((image, index) => (
                <button
                  key={index}
                  onClick={() => setActiveImage(index)}
                  className={cx(
                    'shrink-0 border-[3px] transition-transform',
                    index === activeImage
                      ? 'border-retro-red shadow-pixel-sm'
                      : 'border-ink opacity-70 hover:opacity-100',
                  )}
                >
                  <PixelImage
                    src={image}
                    alt={`View ${index + 1}`}
                    seed={`${product.id}-${index}`}
                    className="h-20 w-20"
                  />
                </button>
              ))}
            </div>
          )}

          <Card className="mt-6">
            <p className="h-card text-slate">
              Specifications
            </p>
            <div className="mt-3">
              <SpecRow label="Category" value={product.category_label} />
              <SpecRow label="GSM" value={`${product.gsm} g/m²`} />
              <SpecRow label="Composition" value={product.fabric_composition} />
              <SpecRow label="Sizes" value={product.sizes_available} />
              <SpecRow label="Colors" value={product.colors} />
              <SpecRow label="Available" value={pcs(product.available_quantity)} />
              <SpecRow label="MOQ" value={pcs(product.moq)} />
              <SpecRow label="Unit Price" value={`${bdt(product.unit_price_bdt)} / pc`} />
              <SpecRow
                label="Delivery"
                value={
                  product.free_delivery
                    ? 'Free'
                    : bdt(product.estimated_transport_cost)
                }
              />
              <SpecRow
                label="Express"
                value={
                  product.express_delivery_available
                    ? `${product.express_delivery_hours}h · +${bdt(product.express_delivery_fee)}`
                    : 'Not offered'
                }
              />
              <SpecRow label="Ships From" value={product.location} />
            </div>
          </Card>

          {product.description && (
            <Card className="mt-6">
              <p className="h-card text-slate">
                About This Lot
              </p>
              <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-slate/85">
                {product.description}
              </p>
            </Card>
          )}
        </div>

        {/* Buy column */}
        <div className="space-y-6 lg:sticky lg:top-32 lg:self-start">
          <div>
            <div className="flex flex-wrap gap-2">
              <Tag color="bg-retro-yellow">{product.category_label}</Tag>
              <Tag color="bg-ink text-paper">{product.gsm} GSM</Tag>
              {product.free_delivery && <Tag color="bg-retro-green">✓ Free Delivery</Tag>}
              {product.express_delivery_available && (
                <Tag color="bg-retro-orange">⚡ {product.express_delivery_hours}h Express</Tag>
              )}
              {!product.in_stock && <Tag color="bg-retro-red text-paper">Sold Out</Tag>}
            </div>
            <h1 className="mt-4 text-2xl font-bold leading-snug">{product.title}</h1>
            <p className="mt-2 text-base text-slate/80">{product.fabric_composition}</p>
          </div>

          {/* Supplier */}
          <Card className="border-l-8 border-l-retro-purple">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="eyebrow text-slate">
                  Supplied by
                </p>
                <Link
                  to={`/supplier/${product.supplier.id}`}
                  className="mt-1 block truncate text-base font-bold hover:text-retro-red"
                >
                  {product.supplier.business_name}
                </Link>
                <p className="mt-1 text-xs text-slate/70">
                  {product.supplier.district || 'Bangladesh'}
                  {product.supplier.rating > 0 && ` · ★ ${product.supplier.rating}/5`}
                </p>
              </div>
              <VerifiedBadge verified={product.supplier.is_verified} />
            </div>
            {!product.supplier.is_verified && (
              <p className="mt-3 border-2 border-ink bg-retro-yellow p-2 text-xs">
                This supplier hasn&apos;t completed trade-licence verification yet. Consider
                cash on delivery.
              </p>
            )}
          </Card>

          <FeeCalculator
            product={product}
            quantity={quantity}
            setQuantity={setQuantity}
            speed={speed}
            setSpeed={setSpeed}
          />

          {role === 'supplier' ? (
            <div className="border-[3px] border-ink bg-parchment p-4 text-center">
              <p className="text-sm text-slate/80">
                You&apos;re signed in as a supplier. Switch to a buyer account to place orders.
              </p>
            </div>
          ) : (
            <Button
              size="lg"
              className="w-full"
              disabled={!canOrder || !product.in_stock}
              onClick={handleOrder}
            >
              {!product.in_stock
                ? 'Sold Out'
                : !canOrder
                  ? `Minimum ${pcs(product.moq)}`
                  : `Order ${pcs(qty)} →`}
            </Button>
          )}

          {!isAuthenticated && (
            <p className="text-center text-xs text-slate/70">
              You&apos;ll be asked to sign in before checkout.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
