import { useState } from 'react'

import { useToast } from '../context/ToastContext'
import { api } from '../lib/api'
import { useMeta } from '../hooks/useMeta'
import DocumentUpload from './DocumentUpload'
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

/** Shared explainer so both sides see the same reasoning for the NID rule. */
function IdentityNotice() {
  return (
    <div className="border-[3px] border-ink bg-retro-blue p-4 text-paper">
      <p className="eyebrow text-paper/80">Identity Verification — Required</p>
      <p className="mt-2 text-base leading-relaxed">
        Every trader on StockAche is identity-checked. That is what makes it safe to send
        money to someone you have never met.
      </p>
      <p className="mt-2 text-sm text-paper/80">
        Your NID is seen only by the StockAche review team. Other traders see your business
        name and district — never your documents or NID number.
      </p>
    </div>
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
    nid_document_url: initial?.nid_document_url || '',
    nid_back_url: initial?.nid_back_url || '',
  })
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)
  const toast = useToast()

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))
  const setValue = (key) => (value) => setForm((f) => ({ ...f, [key]: value }))

  const submit = async (e) => {
    e.preventDefault()
    if (!form.nid_document_url) {
      setError({ message: 'Upload a photo of the front of your NID card to continue.' })
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    setError(null)
    setSaving(true)
    try {
      const saved = await api.saveBuyerProfile(form)
      toast.success('Buyer profile saved.')
      onSaved?.(saved)
    } catch (err) {
      setError(err)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-6">
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

      <DistrictSelect value={form.district} onChange={set('district')} />

      <div className="space-y-5 border-t-[3px] border-dashed border-ink/30 pt-6">
        <IdentityNotice />

        <Field
          label="NID Number"
          required
          hint="10, 13 or 17 digits, exactly as printed on the card."
        >
          <Input
            value={form.nid_number}
            onChange={set('nid_number')}
            placeholder="1994778865521"
            inputMode="numeric"
            required
            maxLength={40}
          />
        </Field>

        <div className="grid gap-5 sm:grid-cols-2">
          <DocumentUpload
            label="NID Card — Front"
            required
            value={form.nid_document_url}
            onChange={setValue('nid_document_url')}
            hint="All four corners visible, text readable."
            accentColor="bg-retro-green"
          />
          <DocumentUpload
            label="NID Card — Back"
            value={form.nid_back_url}
            onChange={setValue('nid_back_url')}
            hint="Optional, but speeds up review."
          />
        </div>
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
    trade_license_document_url: initial?.trade_license_document_url || '',
    nid_number: initial?.nid_number || '',
    nid_document_url: initial?.nid_document_url || '',
    nid_back_url: initial?.nid_back_url || '',
    about: initial?.about || '',
  })
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)
  const toast = useToast()

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))
  const setValue = (key) => (value) => setForm((f) => ({ ...f, [key]: value }))

  const submit = async (e) => {
    e.preventDefault()
    if (!form.nid_document_url) {
      setError({ message: 'Upload a photo of the front of your NID card to continue.' })
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    setError(null)
    setSaving(true)
    try {
      const saved = await api.saveSupplierProfile(form)
      toast.success('Supplier profile saved.')
      onSaved?.(saved)
    } catch (err) {
      setError(err)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-6">
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

      <Field label="About Your Business" hint="Shown on your public supplier page.">
        <Textarea
          value={form.about}
          onChange={set('about')}
          rows={3}
          placeholder="What kind of lots do you usually carry?"
        />
      </Field>

      <div className="space-y-5 border-t-[3px] border-dashed border-ink/30 pt-6">
        <IdentityNotice />

        <Field
          label="NID Number"
          required
          hint="10, 13 or 17 digits, exactly as printed on the card."
        >
          <Input
            value={form.nid_number}
            onChange={set('nid_number')}
            placeholder="1985347765521"
            inputMode="numeric"
            required
            maxLength={40}
          />
        </Field>

        <div className="grid gap-5 sm:grid-cols-2">
          <DocumentUpload
            label="NID Card — Front"
            required
            value={form.nid_document_url}
            onChange={setValue('nid_document_url')}
            hint="All four corners visible, text readable."
            accentColor="bg-retro-green"
          />
          <DocumentUpload
            label="NID Card — Back"
            value={form.nid_back_url}
            onChange={setValue('nid_back_url')}
            hint="Optional, but speeds up review."
          />
        </div>

        <div className="border-[3px] border-ink bg-parchment p-4">
          <p className="eyebrow">Trade Licence — for the Verified badge</p>
          <p className="mt-2 text-base text-slate/85">
            Buyers can filter the marketplace to verified suppliers only. Adding a valid
            trade licence puts you in the review queue for that badge.
          </p>

          <div className="mt-4 grid gap-5 sm:grid-cols-2">
            <Field label="Trade Licence Number">
              <Input
                value={form.trade_license_number}
                onChange={set('trade_license_number')}
                placeholder="TRAD/DHA/2024/XXXXX"
                maxLength={60}
              />
            </Field>
            <DocumentUpload
              label="Trade Licence Scan"
              value={form.trade_license_document_url}
              onChange={setValue('trade_license_document_url')}
              accentColor="bg-retro-purple"
            />
          </div>
        </div>
      </div>

      <Button type="submit" size="lg" loading={saving}>
        {submitLabel}
      </Button>
    </form>
  )
}
