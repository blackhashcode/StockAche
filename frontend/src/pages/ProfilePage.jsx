import { BuyerProfileForm, SupplierProfileForm } from '../components/ProfileForms'
import { Card, Loader, Tag } from '../components/ui'
import { useAuth } from '../context/AuthContext'
import { shortDate } from '../lib/format'

const VERIFICATION_TONE = {
  verified: 'bg-retro-green',
  pending: 'bg-retro-blue text-paper',
  rejected: 'bg-retro-red text-paper',
  unsubmitted: 'bg-retro-grey',
}

const VERIFICATION_LABEL = {
  verified: '✔ Verified',
  pending: 'Pending review',
  rejected: 'Rejected',
  unsubmitted: 'Not submitted',
}

export default function ProfilePage({ kind }) {
  const { account, buyerProfile, supplierProfile, refresh, loading } = useAuth()

  if (loading) return <Loader label="Loading profile" />

  const profile = kind === 'supplier' ? supplierProfile : buyerProfile

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="h-page">
        <span className="text-retro-red">▸ </span>
        {kind === 'supplier' ? 'Supplier Profile' : 'Buyer Profile'}
      </h1>
      <p className="mt-2 text-sm text-slate/80">
        Keep this current — it drives delivery, contact and verification.
      </p>

      {/* Account summary */}
      <Card className="mt-6 border-l-8 border-l-retro-blue">
        <div className="flex flex-wrap items-center gap-4">
          <div className="grid h-14 w-14 shrink-0 place-items-center border-[3px] border-ink bg-retro-yellow font-pixel text-base">
            {(account?.full_name || account?.email || '?')[0].toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-bold">{account?.full_name || '—'}</p>
            <p className="truncate text-sm text-slate/70">{account?.email}</p>
            <p className="mt-1 eyebrow text-slate/60">
              Joined {shortDate(account?.created_at)}
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <Tag color={kind === 'supplier' ? 'bg-retro-purple text-paper' : 'bg-retro-green'}>
              {kind}
            </Tag>
            {profile && (
              <Tag color={VERIFICATION_TONE[profile.verification_status]}>
                {VERIFICATION_LABEL[profile.verification_status]}
              </Tag>
            )}
          </div>
        </div>

        {kind === 'supplier' && profile?.verification_status === 'unsubmitted' && (
          <p className="mt-4 border-2 border-ink bg-retro-yellow p-3 text-sm">
            Add your trade licence number below to enter the verification queue. Verified
            suppliers appear in the buyers&apos; &quot;verified only&quot; filter.
          </p>
        )}
      </Card>

      <Card className="mt-6">
        {kind === 'supplier' ? (
          <SupplierProfileForm initial={profile} onSaved={refresh} />
        ) : (
          <BuyerProfileForm initial={profile} onSaved={refresh} />
        )}
      </Card>
    </div>
  )
}
