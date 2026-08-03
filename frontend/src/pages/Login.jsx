import { useEffect, useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'

import { Button, Card, ErrorBanner, Loader } from '../components/ui'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { useMeta } from '../hooks/useMeta'

const DEMO_ACCOUNTS = [
  {
    email: 'buyer@stockache.dev',
    name: 'Trendy Threads BD',
    role: 'Buyer',
    note: 'Banani, Dhaka — online clothing store',
    color: 'bg-retro-green',
  },
  {
    email: 'supplier@stockache.dev',
    name: 'Hossain Stocklot House',
    role: 'Supplier',
    note: 'Narayanganj — verified, 4 active lots',
    color: 'bg-retro-purple',
  },
  {
    email: 'ctgfabrics@stockache.dev',
    name: 'Chattogram Fabric Depot',
    role: 'Supplier',
    note: 'Chattogram — pending verification',
    color: 'bg-retro-orange',
  },
]

export default function Login() {
  const { loginWithGoogle, loginAsDemo, isAuthenticated, isOnboarded, googleEnabled, loading } =
    useAuth()
  const { meta } = useMeta()
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(null)
  const navigate = useNavigate()
  const location = useLocation()
  const toast = useToast()

  // Surface the reason Supabase bounced us back, if it did.
  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.replace(/^#/, ''))
    const description = params.get('error_description')
    if (description) setError({ message: decodeURIComponent(description) })
  }, [])

  if (loading) return <Loader label="Checking session" />

  if (isAuthenticated) {
    const target = location.state?.from || (isOnboarded ? '/marketplace' : '/onboarding')
    return <Navigate to={target} replace />
  }

  const handleGoogle = async () => {
    setError(null)
    setBusy('google')
    try {
      await loginWithGoogle()
    } catch (err) {
      setError(err)
      setBusy(null)
    }
  }

  const handleDemo = async (email) => {
    setError(null)
    setBusy(email)
    try {
      const account = await loginAsDemo(email)
      toast.success(`Signed in as ${account?.full_name || email}`)
      navigate(account?.role === 'supplier' ? '/supplier' : '/marketplace', { replace: true })
    } catch (err) {
      setError(err)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <div className="mb-8 text-center">
        <h1 className="font-pixel text-xl uppercase">Sign In</h1>
        <p className="mt-3 text-sm text-slate/80">
          One account works for both sides — you pick buyer or supplier next.
        </p>
      </div>

      <ErrorBanner error={error} onDismiss={() => setError(null)} />

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Google */}
        <Card className="flex flex-col">
          <span className="pixel-tag bg-retro-blue text-paper">Recommended</span>
          <h2 className="mt-4 font-pixel text-xs uppercase leading-relaxed">
            Continue with Google
          </h2>
          <p className="mt-3 flex-1 text-sm leading-relaxed text-slate/85">
            Uses Supabase Auth. Your name, email and photo come across automatically — no
            password to remember.
          </p>

          <Button
            variant="dark"
            size="lg"
            className="mt-6 w-full"
            onClick={handleGoogle}
            loading={busy === 'google'}
            disabled={!googleEnabled}
          >
            <span className="grid h-5 w-5 place-items-center border-2 border-paper bg-paper text-ink">
              G
            </span>
            Sign in with Google
          </Button>

          {!googleEnabled && (
            <p className="mt-3 border-2 border-ink bg-retro-yellow p-2 text-xs">
              Supabase keys are missing from <code>frontend/.env</code>. Use a demo account
              below instead.
            </p>
          )}
        </Card>

        {/* Demo switcher */}
        <Card className="flex flex-col border-t-8 border-t-retro-purple">
          <span className="pixel-tag bg-retro-purple text-paper">Prototype</span>
          <h2 className="mt-4 font-pixel text-xs uppercase leading-relaxed">
            Demo Accounts
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-slate/85">
            Jump straight into seeded data — useful for judging without configuring OAuth.
          </p>

          <div className="mt-5 flex flex-col gap-3">
            {DEMO_ACCOUNTS.map((account) => (
              <button
                key={account.email}
                onClick={() => handleDemo(account.email)}
                disabled={Boolean(busy) || !meta.dev_login_enabled}
                className="flex items-center gap-3 border-[3px] border-ink bg-paper p-3 text-left shadow-pixel-sm transition-transform duration-75 hover:bg-parchment active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:opacity-50"
              >
                <span
                  className={`grid h-9 w-9 shrink-0 place-items-center border-2 border-ink font-pixel text-[10px] ${account.color}`}
                >
                  {account.role[0]}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold">{account.name}</span>
                  <span className="block truncate text-xs text-slate/70">{account.note}</span>
                </span>
                <span className="pixel-tag shrink-0 bg-parchment">
                  {busy === account.email ? '...' : account.role}
                </span>
              </button>
            ))}
          </div>

          {!meta.dev_login_enabled && (
            <p className="mt-4 border-2 border-ink bg-retro-red p-2 text-xs text-paper">
              Demo login is disabled on the server (ENABLE_DEV_LOGIN=False).
            </p>
          )}
        </Card>
      </div>

      <div className="mt-8 border-[3px] border-ink bg-parchment p-4">
        <p className="font-pixel text-[9px] uppercase tracking-wider text-slate">
          Setting up Google sign-in
        </p>
        <ol className="mt-3 list-inside list-decimal space-y-1 text-sm text-slate/85">
          <li>Supabase Dashboard → Authentication → Providers → enable Google.</li>
          <li>Paste your Google OAuth client ID and secret.</li>
          <li>
            Add <code className="bg-paper px-1">http://localhost:5173/auth/callback</code> to
            the redirect URLs.
          </li>
        </ol>
      </div>
    </div>
  )
}
