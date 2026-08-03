import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import ImageUploader from '../components/ImageUploader'
import {
  Button,
  Card,
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
      estimated_transport_cost: form.estimated_transport_cost || '0',
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

  const moqTotal =
    (Number(form.moq) || 0) * (Number(form.unit_price_bdt) || 0) +
    (Number(form.estimated_transport_cost) || 0)

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <Link
        to="/supplier/listings"
        className="mb-6 inline-block font-pixel text-[9px] uppercase tracking-wider text-slate hover:text-retro-red"
      >
        ← Back to listings
      </Link>

      <h1 className="font-pixel text-lg uppercase">
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
          <p className="font-pixel text-[10px] uppercase tracking-wider text-slate">
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
          <p className="font-pixel text-[10px] uppercase tracking-wider text-slate">
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
            <Field label="Est. Transport Cost (৳)" hint="Flat delivery estimate per order">
              <Input
                type="number"
                min="0"
                step="0.01"
                value={form.estimated_transport_cost}
                onChange={set('estimated_transport_cost')}
                placeholder="1800.00"
              />
            </Field>
          </div>

          {moqTotal > 0 && (
            <div className="mt-5 flex items-center justify-between border-[3px] border-ink bg-parchment p-3">
              <span className="font-pixel text-[9px] uppercase tracking-wider text-slate">
                Buyer pays at MOQ
              </span>
              <span className="font-term text-2xl leading-none text-retro-red">
                {bdt(moqTotal)}
              </span>
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

        {/* Photos */}
        <Card>
          <p className="font-pixel text-[10px] uppercase tracking-wider text-slate">
            3 — Photos
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
