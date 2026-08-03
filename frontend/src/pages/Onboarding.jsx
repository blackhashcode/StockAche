import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'

import { BuyerProfileForm, SupplierProfileForm } from '../components/ProfileForms'
import { Button, Card, ErrorBanner, Loader } from '../components/ui'
import { useAuth } from '../context/AuthContext'

const ROLES = [
  {
    value: 'buyer',
    title: 'I am a Buyer',
    tagline: 'SME shop owner',
    color: 'bg-retro-green',
    points: [
      'Browse stocklots filtered by GSM, category, MOQ and price',
      'See the landed total before you commit',
      'Track every order to your door',
    ],
  },
  {
    value: 'supplier',
    title: 'I am a Supplier',
    tagline: 'Stocklot wholesaler',
    color: 'bg-retro-purple',
    points: [
      'List lots with specs and photos in under two minutes',
      'Earn a Verified Supplier badge',
      'Manage dispatch from one dashboard',
    ],
  },
]

export default function Onboarding() {
  const { account, role, isOnboarded, loading, setRole, refresh } = useAuth()
  const [choosing, setChoosing] = useState(false)
  const [error, setError] = useState(null)
  const navigate = useNavigate()

  if (loading) return <Loader label="Loading account" />
  if (!account) return <Navigate to="/login" replace />
  if (isOnboarded) {
    return <Navigate to={role === 'supplier' ? '/supplier' : '/marketplace'} replace />
  }

  const pickRole = async (value) => {
    setError(null)
    setChoosing(value)
    try {
      await setRole(value)
    } catch (err) {
      setError(err)
    } finally {
      setChoosing(false)
    }
  }

  const finish = async () => {
    await refresh()
    navigate(role === 'supplier' ? '/supplier' : '/marketplace', { replace: true })
  }

  const step = role ? 2 : 1

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      {/* Step indicator */}
      <div className="mb-8 flex items-center gap-3">
        {[1, 2].map((n) => (
          <div key={n} className="flex flex-1 items-center gap-3">
            <span
              className={`grid h-9 w-9 shrink-0 place-items-center border-[3px] border-ink font-pixel text-[10px] ${
                step >= n ? 'bg-retro-yellow' : 'bg-paper text-slate/40'
              }`}
            >
              {n}
            </span>
            <span className="font-pixel text-[8px] uppercase tracking-wider">
              {n === 1 ? 'Pick Role' : 'Business Details'}
            </span>
            {n === 1 && <span className="h-1 flex-1 border-y-2 border-ink bg-parchment" />}
          </div>
        ))}
      </div>

      <ErrorBanner error={error} onDismiss={() => setError(null)} />

      {step === 1 ? (
        <>
          <h1 className="font-pixel text-lg uppercase">Welcome{account.full_name ? `, ${account.full_name.split(' ')[0]}` : ''}</h1>
          <p className="mt-3 text-sm text-slate/80">
            How will you use StockAche? This decides your dashboard — it can&apos;t be
            changed later on the same account.
          </p>

          <div className="mt-8 grid gap-5 sm:grid-cols-2">
            {ROLES.map((option) => (
              <Card key={option.value} className="flex flex-col">
                <span className={`pixel-tag ${option.color}`}>{option.tagline}</span>
                <h2 className="mt-4 font-pixel text-xs uppercase leading-relaxed">
                  {option.title}
                </h2>
                <ul className="mt-4 flex-1 space-y-2">
                  {option.points.map((point) => (
                    <li key={point} className="flex gap-2 text-sm leading-relaxed">
                      <span className="mt-1 h-2.5 w-2.5 shrink-0 border-2 border-ink bg-retro-yellow" />
                      <span className="text-slate/85">{point}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  className="mt-6 w-full"
                  variant={option.value === 'buyer' ? 'success' : 'primary'}
                  loading={choosing === option.value}
                  onClick={() => pickRole(option.value)}
                >
                  Continue
                </Button>
              </Card>
            ))}
          </div>
        </>
      ) : (
        <>
          <h1 className="font-pixel text-lg uppercase">
            {role === 'supplier' ? 'Supplier Details' : 'Business Details'}
          </h1>
          <p className="mt-3 text-sm text-slate/80">
            {role === 'supplier'
              ? 'Suppliers with a trade licence on file get the Verified badge, which buyers filter on.'
              : 'Suppliers see your business name and delivery district. Your NID stays private.'}
          </p>

          <Card className="mt-8">
            {role === 'supplier' ? (
              <SupplierProfileForm onSaved={finish} submitLabel="Finish Setup →" />
            ) : (
              <BuyerProfileForm onSaved={finish} submitLabel="Finish Setup →" />
            )}
          </Card>
        </>
      )}
    </div>
  )
}
