import { useEffect, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'

import { Button, Card, ErrorBanner, Field, Input, Loader, cx } from '../components/ui'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { readAuthErrorFromUrl } from '../lib/supabase'

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

/**
 * Full-panel confirmation screen.
 *
 * Supabase withholds the session until the emailed link is clicked, so signup
 * genuinely cannot continue here. That needs to be unmistakable — a small
 * banner under a still-populated form reads as "nothing happened".
 */
export function ConfirmEmailScreen({ email, onResend, onBackToSignIn, resending, sentAgain }) {
  return (
    <div className="mx-auto max-w-xl px-4 py-14">
      <Card className="border-t-8 border-t-retro-green">
        <div className="flex items-start gap-4">
          <span className="grid h-14 w-14 shrink-0 place-items-center border-[3px] border-ink bg-retro-green text-2xl">
            ✉
          </span>
          <div className="min-w-0">
            <h1 className="h-section">Confirm your email</h1>
            <p className="mt-3 text-base leading-relaxed text-slate/85">
              Your account is created. We sent a confirmation link to{' '}
              <strong className="break-all">{email}</strong>. Click it and you will be
              brought straight back here, signed in.
            </p>
          </div>
        </div>

        <ol className="mt-6 space-y-3 border-t-2 border-dashed border-ink/30 pt-5">
          {[
            'Open your inbox and look for a mail from Supabase.',
            'Check the spam folder — confirmation mail often lands there.',
            'Click the link. It expires after about an hour.',
          ].map((step, i) => (
            <li key={step} className="flex gap-3 text-base">
              <span className="grid h-6 w-6 shrink-0 place-items-center border-2 border-ink bg-retro-yellow text-xs font-bold">
                {i + 1}
              </span>
              <span className="text-slate/85">{step}</span>
            </li>
          ))}
        </ol>

        {sentAgain && (
          <p className="mt-5 border-2 border-ink bg-retro-green p-3 text-base">
            ✓ A fresh confirmation link is on its way to {email}.
          </p>
        )}

        <div className="mt-6 flex flex-wrap gap-3">
          <Button variant="ghost" onClick={onResend} loading={resending}>
            Resend Link
          </Button>
          <Button onClick={onBackToSignIn}>I&apos;ve Confirmed — Sign In</Button>
        </div>
      </Card>
    </div>
  )
}

export default function Login() {
  const {
    loginWithGoogle,
    loginWithPassword,
    signUpWithPassword,
    sendPasswordReset,
    resendConfirmation,
    isAuthenticated,
    isOnboarded,
    googleEnabled,
    loading,
    authError,
  } = useAuth()

  const [mode, setMode] = useState('signin')
  const [form, setForm] = useState({ email: '', password: '', confirm: '', fullName: '' })
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(null)
  const [notice, setNotice] = useState(null)
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(null)
  const [sentAgain, setSentAgain] = useState(false)
  // Set when sign-in failed specifically because the address is unconfirmed.
  const [needsConfirmation, setNeedsConfirmation] = useState(false)

  const navigate = useNavigate()
  const location = useLocation()
  const toast = useToast()

  useEffect(() => {
    const fromUrl = readAuthErrorFromUrl()
    if (fromUrl) {
      setError(fromUrl)
      return
    }
    // Bounced back here from /auth/callback: the provider handshake succeeded
    // but our own API would not accept the session. Say so rather than looking
    // like the sign-in simply did nothing.
    if (location.state?.callbackFailed) {
      setError(
        authError ||
          new Error(
            'Sign-in completed with the provider, but the StockAche server did not ' +
              'accept the session. Check that the Django backend is running on port 8000.',
          ),
      )
    }
  }, [location.state, authError])

  if (loading) return <Loader label="Checking session" />

  if (isAuthenticated) {
    const target = location.state?.from || (isOnboarded ? '/marketplace' : '/onboarding')
    return <Navigate to={target} replace />
  }

  const copy = MODES[mode]
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  const clearFeedback = () => {
    setError(null)
    setNotice(null)
    setNeedsConfirmation(false)
  }

  const swapMode = () => {
    setMode((m) => (m === 'signin' ? 'signup' : 'signin'))
    clearFeedback()
  }

  const handleResend = async () => {
    const target = awaitingConfirmation || form.email
    if (!target) return
    setBusy('resend')
    setError(null)
    try {
      await resendConfirmation(target)
      setSentAgain(true)
      if (!awaitingConfirmation) setNotice(`New confirmation link sent to ${target}.`)
    } catch (err) {
      setError(err)
    } finally {
      setBusy(null)
    }
  }

  if (awaitingConfirmation) {
    return (
      <ConfirmEmailScreen
        email={awaitingConfirmation}
        resending={busy === 'resend'}
        sentAgain={sentAgain}
        onResend={handleResend}
        onBackToSignIn={() => {
          setAwaitingConfirmation(null)
          setSentAgain(false)
          setMode('signin')
          clearFeedback()
        }}
      />
    )
  }

  const handleGoogle = async () => {
    clearFeedback()
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
    clearFeedback()

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
        const { needsConfirmation: pending } = await signUpWithPassword(
          form.email,
          form.password,
          form.fullName,
        )
        if (pending) {
          // Cannot proceed to onboarding without a session — hand off to the
          // dedicated confirmation screen.
          setAwaitingConfirmation(form.email.trim().toLowerCase())
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
      if (err?.needsConfirmation) setNeedsConfirmation(true)
    } finally {
      setBusy(null)
    }
  }

  const handleReset = async () => {
    if (!form.email) {
      setError({ message: 'Enter your email address first, then request a reset.' })
      return
    }
    clearFeedback()
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

      {needsConfirmation && (
        <div className="mb-4 border-[3px] border-ink bg-retro-yellow p-4 shadow-pixel">
          <p className="text-base">
            Need a new confirmation link for <strong>{form.email}</strong>?
          </p>
          <Button
            size="sm"
            variant="dark"
            className="mt-3"
            loading={busy === 'resend'}
            onClick={handleResend}
          >
            Resend Confirmation Email
          </Button>
        </div>
      )}

      {notice && (
        <div className="mb-4 border-[3px] border-ink bg-retro-green p-4 shadow-pixel">
          <p className="text-base">{notice}</p>
        </div>
      )}

      <Card>
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

        {mode === 'signup' && (
          <p className="mt-4 text-center text-sm text-slate/70">
            You will need to confirm your email address before you can sign in.
          </p>
        )}

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
