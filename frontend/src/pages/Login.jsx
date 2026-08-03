import { useEffect, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'

import { Button, Card, ErrorBanner, Field, Input, Loader, cx } from '../components/ui'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'

const MODES = {
  signin: {
    heading: 'Sign In',
    blurb: 'Welcome back. Pick up where you left off.',
    submit: 'Sign In',
    swapCopy: 'New to StockAche?',
    swapCta: 'Create an account',
  },
  signup: {
    heading: 'Create Account',
    blurb: 'One account works for both sides — you choose buyer or supplier next.',
    submit: 'Create Account',
    swapCopy: 'Already have an account?',
    swapCta: 'Sign in instead',
  },
}

export default function Login() {
  const {
    loginWithGoogle,
    loginWithPassword,
    signUpWithPassword,
    sendPasswordReset,
    isAuthenticated,
    isOnboarded,
    googleEnabled,
    loading,
  } = useAuth()

  const [mode, setMode] = useState('signin')
  const [form, setForm] = useState({ email: '', password: '', confirm: '', fullName: '' })
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(null)
  const [notice, setNotice] = useState(null)
  const navigate = useNavigate()
  const location = useLocation()
  const toast = useToast()

  // Supabase reports OAuth failures back on the URL fragment.
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

  const copy = MODES[mode]
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  const swapMode = () => {
    setMode((m) => (m === 'signin' ? 'signup' : 'signin'))
    setError(null)
    setNotice(null)
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

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setNotice(null)

    if (mode === 'signup') {
      if (form.password.length < 8) {
        setError({ message: 'Choose a password of at least 8 characters.' })
        return
      }
      if (form.password !== form.confirm) {
        setError({ message: 'The two passwords do not match.' })
        return
      }
    }

    setBusy('email')
    try {
      if (mode === 'signup') {
        const { needsConfirmation } = await signUpWithPassword(
          form.email,
          form.password,
          form.fullName,
        )
        if (needsConfirmation) {
          setNotice(
            `We sent a confirmation link to ${form.email}. Click it, then sign in.`,
          )
          setMode('signin')
          return
        }
        toast.success('Account created.')
      } else {
        await loginWithPassword(form.email, form.password)
        toast.success('Signed in.')
      }
      navigate(location.state?.from || '/onboarding', { replace: true })
    } catch (err) {
      setError(err)
    } finally {
      setBusy(null)
    }
  }

  const handleReset = async () => {
    if (!form.email) {
      setError({ message: 'Enter your email address first, then request a reset.' })
      return
    }
    setError(null)
    setBusy('reset')
    try {
      await sendPasswordReset(form.email)
      setNotice(`Password reset link sent to ${form.email}.`)
    } catch (err) {
      setError(err)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-14">
      <div className="mb-8 text-center">
        <h1 className="h-page">{copy.heading}</h1>
        <p className="mx-auto mt-4 max-w-md text-base text-slate/85">{copy.blurb}</p>
      </div>

      <ErrorBanner error={error} onDismiss={() => setError(null)} />

      {notice && (
        <div className="mb-4 border-[3px] border-ink bg-retro-green p-4 shadow-pixel">
          <p className="text-base">{notice}</p>
        </div>
      )}

      <Card>
        {/* Google first: fewest steps, and it carries a verified email. */}
        <Button
          variant="dark"
          size="lg"
          className="w-full"
          onClick={handleGoogle}
          loading={busy === 'google'}
          disabled={!googleEnabled || Boolean(busy)}
        >
          <span className="grid h-5 w-5 place-items-center border-2 border-paper bg-paper text-sm font-bold text-ink">
            G
          </span>
          Continue with Google
        </Button>

        {!googleEnabled && (
          <p className="mt-3 border-2 border-ink bg-retro-yellow p-3 text-sm">
            Google sign-in is unavailable — Supabase keys are missing from{' '}
            <code className="bg-paper px-1">frontend/.env</code>. Use email and password
            below.
          </p>
        )}

        <div className="my-6 flex items-center gap-3">
          <span className="h-1 flex-1 border-y-2 border-ink/25" />
          <span className="eyebrow text-slate/70">or use email</span>
          <span className="h-1 flex-1 border-y-2 border-ink/25" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {mode === 'signup' && (
            <Field label="Full Name" required>
              <Input
                value={form.fullName}
                onChange={set('fullName')}
                placeholder="e.g. Tanvir Ahmed"
                autoComplete="name"
                required
              />
            </Field>
          )}

          <Field label="Email Address" required>
            <Input
              type="email"
              value={form.email}
              onChange={set('email')}
              placeholder="you@business.com"
              autoComplete="email"
              required
            />
          </Field>

          <Field
            label="Password"
            required
            hint={mode === 'signup' ? 'At least 8 characters.' : undefined}
          >
            <Input
              type="password"
              value={form.password}
              onChange={set('password')}
              placeholder="••••••••"
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              minLength={mode === 'signup' ? 8 : undefined}
              required
            />
          </Field>

          {mode === 'signup' && (
            <Field label="Confirm Password" required>
              <Input
                type="password"
                value={form.confirm}
                onChange={set('confirm')}
                placeholder="••••••••"
                autoComplete="new-password"
                required
              />
            </Field>
          )}

          <Button
            type="submit"
            size="lg"
            className="w-full"
            loading={busy === 'email'}
            disabled={Boolean(busy)}
          >
            {copy.submit}
          </Button>
        </form>

        {mode === 'signin' && (
          <button
            type="button"
            onClick={handleReset}
            disabled={Boolean(busy)}
            className="mt-4 w-full text-sm text-slate/75 underline underline-offset-4 hover:text-retro-red"
          >
            {busy === 'reset' ? 'Sending reset link…' : 'Forgot your password?'}
          </button>
        )}
      </Card>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-2 text-base">
        <span className="text-slate/75">{copy.swapCopy}</span>
        <button
          type="button"
          onClick={swapMode}
          className="font-semibold text-retro-navy underline underline-offset-4 hover:text-retro-red"
        >
          {copy.swapCta}
        </button>
      </div>

      <div className="mt-8 border-[3px] border-ink bg-parchment p-5">
        <p className="eyebrow">What happens next</p>
        <ol className="mt-3 space-y-2 text-base text-slate/85">
          {[
            'Choose whether you are buying or supplying.',
            'Add your business details and a photo of your NID card.',
            'Buy or list stocklots once your identity is on file.',
          ].map((step, i) => (
            <li key={step} className="flex gap-3">
              <span
                className={cx(
                  'grid h-6 w-6 shrink-0 place-items-center border-2 border-ink text-xs font-bold',
                  'bg-retro-yellow',
                )}
              >
                {i + 1}
              </span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
        <p className="mt-4 text-sm text-slate/70">
          Identity verification keeps scams off the platform. Your NID is visible only to
          the StockAche review team, never to other traders.{' '}
          <Link to="/marketplace" className="underline underline-offset-2 hover:text-retro-red">
            Browse without an account
          </Link>
          .
        </p>
      </div>
    </div>
  )
}
