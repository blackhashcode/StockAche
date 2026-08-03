import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import ImageUploader from '../components/ImageUploader'
import {
  Button,
  Card,
  Checkbox,
  ErrorBanner,
  Field,
  Input,
  Loader,
  Select,
  Textarea,
} from '../components/ui'
import { useToast } from '../context/ToastContext'
import { useMeta } from '../hooks/useMeta'
import { api } from '../lib/api'
import { bdt } from '../lib/format'

const BLANK = {
  title: '',
  description: '',
  category: 'tshirt',
  gsm: '',
  fabric_composition: '',
  sizes_available: '',
  colors: '',
  available_quantity: '',
  moq: '',
  unit_price_bdt: '',
  estimated_transport_cost: '',
  free_delivery: false,
  express_delivery_available: false,
  express_delivery_fee: '',
  express_delivery_hours: '24',
  location: '',
  images: [],
  is_active: true,
}

export default function ListingForm() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const toast = useToast()
  const { meta } = useMeta()

  const [form, setForm] = useState(BLANK)
  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!isEdit) return
    api
      .product(id)
      .then((data) =>
        setForm({
          title: data.title,
          description: data.description || '',
          category: data.category,
          gsm: String(data.gsm),
          fabric_composition: data.fabric_composition,
          sizes_available: data.sizes_available || '',
          colors: data.colors || '',
          available_quantity: String(data.available_quantity),
          moq: String(data.moq),
          unit_price_bdt: String(data.unit_price_bdt),
          estimated_transport_cost: String(data.estimated_transport_cost),
          free_delivery: data.free_delivery,
          express_delivery_available: data.express_delivery_available,
          express_delivery_fee: String(data.express_delivery_fee),
          express_delivery_hours: String(data.express_delivery_hours),
          location: data.location || '',
          images: data.images || [],
          is_active: data.is_active,
        }),
      )
      .catch(setError)
      .finally(() => setLoading(false))
  }, [id, isEdit])

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    setError(null)
    setSaving(true)

    const payload = {
      ...form,
      gsm: Number(form.gsm),
      available_quantity: Number(form.available_quantity),
      moq: Number(form.moq),
      unit_price_bdt: form.unit_price_bdt,
      estimated_transport_cost: form.free_delivery
        ? '0'
        : form.estimated_transport_cost || '0',
      express_delivery_fee: form.express_delivery_available
        ? form.express_delivery_fee || '0'
        : '0',
      express_delivery_hours: Number(form.express_delivery_hours) || 24,
    }

    try {
      if (isEdit) {
        await api.updateProduct(id, payload)
        toast.success('Listing updated.')
      } else {
        await api.createProduct(payload)
        toast.success('Listing published.')
      }
      navigate('/supplier/listings')
    } catch (err) {
      setError(err)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <Loader label="Loading listing" />

  const goodsAtMoq = (Number(form.moq) || 0) * (Number(form.unit_price_bdt) || 0)
  const transportAtMoq = form.free_delivery
    ? 0
    : Number(form.estimated_transport_cost) || 0
  const moqTotal = goodsAtMoq + transportAtMoq

  // Commission is charged on goods value only, so the supplier can see exactly
  // what lands in their account before they publish.
  const commissionRate = Number(meta.commission_rate ?? 0.02)
  const commissionAtMoq = goodsAtMoq * commissionRate
  const payoutAtMoq = goodsAtMoq - commissionAtMoq + transportAtMoq

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <Link
        to="/supplier/listings"
        className="mb-6 inline-block eyebrow text-slate hover:text-retro-red"
      >
        ← Back to listings
      </Link>

      <h1 className="h-page">
        <span className="text-retro-red">▸ </span>
        {isEdit ? 'Edit Stocklot' : 'New Stocklot'}
      </h1>
      <p className="mt-2 text-sm text-slate/80">
        Buyers filter on GSM, category, MOQ and price — accurate specs get you found.
      </p>

      <ErrorBanner error={error} onDismiss={() => setError(null)} />

      <form onSubmit={submit} className="mt-6 space-y-6">
        {/* Basics */}
        <Card>
          <p className="h-card text-slate">
            1 — The Lot
          </p>
          <div className="mt-4 space-y-5">
            <Field label="Listing Title" required>
              <Input
                value={form.title}
                onChange={set('title')}
                placeholder="e.g. Export Surplus Cotton T-Shirt Lot (Mixed Colors)"
                required
                maxLength={200}
              />
            </Field>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Category" required>
                <Select value={form.category} onChange={set('category')} required>
                  {meta.categories.map((category) => (
                    <option key={category.value} value={category.value}>
                      {category.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="GSM" required hint="Fabric weight in grams per square metre">
                <Input
                  type="number"
                  min="1"
                  value={form.gsm}
                  onChange={set('gsm')}
                  placeholder="180"
                  required
                />
              </Field>
            </div>

            <Field label="Fabric Composition" required>
              <Input
                value={form.fabric_composition}
                onChange={set('fabric_composition')}
                placeholder="95% Cotton, 5% Elastane"
                required
                maxLength={160}
              />
            </Field>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Sizes Available" hint="Comma separated">
                <Input
                  value={form.sizes_available}
                  onChange={set('sizes_available')}
                  placeholder="S,M,L,XL"
                />
              </Field>
              <Field label="Colors" hint="Comma separated">
                <Input
                  value={form.colors}
                  onChange={set('colors')}
                  placeholder="Black, White, Navy"
                />
              </Field>
            </div>

            <Field label="Description" hint="Grade, origin, why it's a stocklot, packing ratio">
              <Textarea
                value={form.description}
                onChange={set('description')}
                rows={4}
                placeholder="Buyer-cancelled order, A-grade with original tags. Ratio packed 1:2:2:1."
              />
            </Field>
          </div>
        </Card>

        {/* Pricing */}
        <Card>
          <p className="h-card text-slate">
            2 — Quantity &amp; Pricing
          </p>
          <div className="mt-4 grid gap-5 sm:grid-cols-2">
            <Field label="Available Quantity (pcs)" required>
              <Input
                type="number"
                min="1"
                value={form.available_quantity}
                onChange={set('available_quantity')}
                placeholder="4200"
                required
              />
            </Field>
            <Field label="MOQ (pcs)" required hint="Smallest order you will accept">
              <Input
                type="number"
                min="1"
                value={form.moq}
                onChange={set('moq')}
                placeholder="120"
                required
              />
            </Field>
            <Field label="Unit Price (৳)" required>
              <Input
                type="number"
                min="0.01"
                step="0.01"
                value={form.unit_price_bdt}
                onChange={set('unit_price_bdt')}
                placeholder="165.00"
                required
              />
            </Field>
          </div>

          {moqTotal > 0 && (
            <div className="mt-5 border-[3px] border-ink bg-parchment p-4">
              <div className="flex items-center justify-between gap-4">
                <span className="eyebrow text-slate">Buyer pays at MOQ</span>
                <span className="price text-2xl text-retro-red">{bdt(moqTotal)}</span>
              </div>
              <div className="mt-3 flex items-center justify-between gap-4 border-t-2 border-dashed border-ink/30 pt-3">
                <span className="text-sm text-slate/80">
                  Platform commission ({(commissionRate * 100).toFixed(0)}% of goods value)
                </span>
                <span className="price text-base text-slate">−{bdt(commissionAtMoq)}</span>
              </div>
              <div className="mt-2 flex items-center justify-between gap-4">
                <span className="text-sm font-semibold">You receive</span>
                <span className="price text-xl text-retro-green">{bdt(payoutAtMoq)}</span>
              </div>
            </div>
          )}

          <div className="mt-5">
            <Field label="Ships From">
              <Select value={form.location} onChange={set('location')}>
                <option value="">Select district</option>
                {meta.districts.map((district) => (
                  <option key={district} value={district}>
                    {district}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </Card>

        {/* Delivery */}
        <Card>
          <p className="h-card text-slate">3 — Delivery Options</p>
          <p className="mt-2 text-base text-slate/80">
            Delivery terms are one of the first things buyers compare between lots.
          </p>

          <div className="mt-5 space-y-5">
            <Checkbox
              checked={form.free_delivery}
              onChange={(e) =>
                setForm((f) => ({ ...f, free_delivery: e.target.checked }))
              }
              label="Offer free delivery"
              hint="You absorb the transport cost. Listings with free delivery get a green badge on the feed."
            />

            {!form.free_delivery && (
              <Field
                label="Transport Cost (৳)"
                hint="Flat delivery charge added to every order of this lot."
              >
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.estimated_transport_cost}
                  onChange={set('estimated_transport_cost')}
                  placeholder="1800.00"
                  className="price"
                />
              </Field>
            )}

            <div className="border-t-2 border-dashed border-ink/30 pt-5">
              <Checkbox
                checked={form.express_delivery_available}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    express_delivery_available: e.target.checked,
                  }))
                }
                label="⚡ Offer express delivery"
                hint="A guaranteed fast window for an extra fee. Only enable it if you can genuinely meet the deadline."
              />

              {form.express_delivery_available && (
                <div className="mt-4 grid gap-5 sm:grid-cols-2">
                  <Field
                    label="Express Fee (৳)"
                    required
                    hint="Keep it affordable — this is on top of transport."
                  >
                    <Input
                      type="number"
                      min="1"
                      step="0.01"
                      value={form.express_delivery_fee}
                      onChange={set('express_delivery_fee')}
                      placeholder="850.00"
                      className="price"
                      required
                    />
                  </Field>
                  <Field
                    label="Delivery Window (hours)"
                    required
                    hint="Between 1 and 72 hours."
                  >
                    <Input
                      type="number"
                      min="1"
                      max="72"
                      value={form.express_delivery_hours}
                      onChange={set('express_delivery_hours')}
                      placeholder="24"
                      className="price"
                      required
                    />
                  </Field>
                </div>
              )}
            </div>
          </div>
        </Card>

        {/* Photos */}
        <Card>
          <p className="h-card text-slate">
            4 — Photos
          </p>
          <p className="mt-2 text-sm text-slate/80">
            Real photos of the actual lot. Buyers skip listings without them.
          </p>
          <div className="mt-4">
            <ImageUploader
              value={form.images}
              onChange={(images) => setForm((f) => ({ ...f, images }))}
            />
          </div>
        </Card>

        <div className="flex flex-wrap gap-3">
          <Button type="submit" size="lg" loading={saving}>
            {isEdit ? 'Save Changes' : 'Publish Listing'}
          </Button>
          <Link to="/supplier/listings">
            <Button type="button" size="lg" variant="ghost">
              Cancel
            </Button>
          </Link>
        </div>
      </form>
    </div>
  )
}
