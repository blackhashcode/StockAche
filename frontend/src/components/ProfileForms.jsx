import { useState } from 'react'

import { useToast } from '../context/ToastContext'
import { api } from '../lib/api'
import { useMeta } from '../hooks/useMeta'
import { Button, ErrorBanner, Field, Input, Select, Textarea } from './ui'

const BUSINESS_TYPES = [
  'Online Clothing Store',
  'Facebook Page Store',
  'Instagram Store',
  'Physical Retail Shop',
  'Boutique',
  'Reseller / Dropshipper',
  'Other',
]

function DistrictSelect({ value, onChange, required }) {
  const { meta } = useMeta()
  return (
    <Field label="District" required={required}>
      <Select value={value} onChange={onChange} required={required}>
        <option value="">Select district</option>
        {meta.districts.map((district) => (
          <option key={district} value={district}>
            {district}
          </option>
        ))}
      </Select>
    </Field>
  )
}

export function BuyerProfileForm({ initial, onSaved, submitLabel = 'Save Profile' }) {
  const [form, setForm] = useState({
    business_name: initial?.business_name || '',
    business_type: initial?.business_type || '',
    contact_phone: initial?.contact_phone || '',
    address: initial?.address || '',
    district: initial?.district || '',
    nid_number: initial?.nid_number || '',
  })
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)
  const toast = useToast()

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    setError(null)
    setSaving(true)
    try {
      const saved = await api.saveBuyerProfile(form)
      toast.success('Buyer profile saved.')
      onSaved?.(saved)
    } catch (err) {
      setError(err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <ErrorBanner error={error} onDismiss={() => setError(null)} />

      <Field label="Business Name" required>
        <Input
          value={form.business_name}
          onChange={set('business_name')}
          placeholder="e.g. Trendy Threads BD"
          required
          maxLength={160}
        />
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Business Type">
          <Select value={form.business_type} onChange={set('business_type')}>
            <option value="">Select type</option>
            {BUSINESS_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Contact Phone" required>
          <Input
            value={form.contact_phone}
            onChange={set('contact_phone')}
            placeholder="+8801XXXXXXXXX"
            required
          />
        </Field>
      </div>

      <Field label="Delivery Address" required>
        <Textarea
          value={form.address}
          onChange={set('address')}
          rows={3}
          placeholder="House, road, area, city, postcode"
          required
        />
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <DistrictSelect
          value={form.district}
          onChange={set('district')}
        />
        <Field
          label="NID Number"
          hint="Used to verify your business. Never shown to suppliers."
        >
          <Input
            value={form.nid_number}
            onChange={set('nid_number')}
            placeholder="10 or 17 digit NID"
            maxLength={40}
          />
        </Field>
      </div>

      <Button type="submit" size="lg" loading={saving}>
        {submitLabel}
      </Button>
    </form>
  )
}

export function SupplierProfileForm({ initial, onSaved, submitLabel = 'Save Profile' }) {
  const [form, setForm] = useState({
    business_name: initial?.business_name || '',
    contact_phone: initial?.contact_phone || '',
    address: initial?.address || '',
    district: initial?.district || '',
    trade_license_number: initial?.trade_license_number || '',
    nid_number: initial?.nid_number || '',
    about: initial?.about || '',
  })
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)
  const toast = useToast()

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    setError(null)
    setSaving(true)
    try {
      const saved = await api.saveSupplierProfile(form)
      toast.success('Supplier profile saved.')
      onSaved?.(saved)
    } catch (err) {
      setError(err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <ErrorBanner error={error} onDismiss={() => setError(null)} />

      <Field label="Business Name" required>
        <Input
          value={form.business_name}
          onChange={set('business_name')}
          placeholder="e.g. Hossain Stocklot House"
          required
          maxLength={160}
        />
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Contact Phone" required>
          <Input
            value={form.contact_phone}
            onChange={set('contact_phone')}
            placeholder="+8801XXXXXXXXX"
            required
          />
        </Field>
        <DistrictSelect value={form.district} onChange={set('district')} />
      </div>

      <Field label="Warehouse / Business Address" required>
        <Textarea
          value={form.address}
          onChange={set('address')}
          rows={3}
          placeholder="Plot, area, city"
          required
        />
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          label="Trade License No."
          hint="Submitting this puts you in the verification queue."
        >
          <Input
            value={form.trade_license_number}
            onChange={set('trade_license_number')}
            placeholder="TRAD/DHA/2024/XXXXX"
            maxLength={60}
          />
        </Field>
        <Field label="NID Number">
          <Input
            value={form.nid_number}
            onChange={set('nid_number')}
            placeholder="10 or 17 digit NID"
            maxLength={40}
          />
        </Field>
      </div>

      <Field label="About Your Business" hint="Shown on your public supplier page.">
        <Textarea
          value={form.about}
          onChange={set('about')}
          rows={3}
          placeholder="What kind of lots do you usually carry?"
        />
      </Field>

      <Button type="submit" size="lg" loading={saving}>
        {submitLabel}
      </Button>
    </form>
  )
}
