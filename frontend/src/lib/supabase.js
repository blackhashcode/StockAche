import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabaseConfigured = Boolean(url && anonKey)

if (!supabaseConfigured) {
  console.warn(
    '[StockAche] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are missing from ' +
      'frontend/.env — sign-in and registration are disabled.',
  )
}

export const supabase = supabaseConfigured
  ? createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        // Lets the client pick the session out of the fragment/query that
        // Supabase appends when it bounces back from a confirmation link or
        // an OAuth provider.
        detectSessionInUrl: true,
      },
    })
  : null

function requireClient() {
  if (!supabase) {
    throw new Error(
      'Authentication is unavailable — Supabase keys are missing from frontend/.env.',
    )
  }
  return supabase
}

const redirectTo = () => `${window.location.origin}/auth/callback`

/* ------------------------------------------------------------------ errors */

/**
 * Supabase error codes are terse and often leak implementation detail
 * ("Email not confirmed"). Map the ones users actually hit onto sentences that
 * say what to do next.
 */
export function friendlyAuthError(error) {
  if (!error) return null
  const code = error.code || error.error_code || ''
  const message = error.message || String(error)

  const map = {
    email_not_confirmed:
      'Your email address has not been confirmed yet. Check your inbox for the ' +
      'confirmation link, or send yourself a new one below.',
    invalid_credentials:
      'That email and password combination did not match an account. If you just ' +
      'registered, confirm your email address first.',
    user_already_exists:
      'An account already exists for that email address. Sign in instead, or reset ' +
      'your password.',
    email_exists:
      'An account already exists for that email address. Sign in instead, or reset ' +
      'your password.',
    weak_password: 'That password is too weak. Use at least 8 characters.',
    over_email_send_rate_limit:
      'Too many emails requested. Wait about a minute before trying again.',
    validation_failed: 'Check the details you entered and try again.',
    signup_disabled: 'New registrations are currently disabled on this project.',
    over_request_rate_limit: 'Too many attempts. Wait a moment and try again.',
  }

  const friendly =
    map[code] ||
    (/email not confirmed/i.test(message) ? map.email_not_confirmed : null) ||
    (/invalid login credentials/i.test(message) ? map.invalid_credentials : null) ||
    (/already registered|already exists/i.test(message) ? map.user_already_exists : null)

  const result = new Error(friendly || message)
  result.code = code
  // Preserved so callers can branch on the unconfirmed case specifically.
  result.needsConfirmation =
    code === 'email_not_confirmed' || /email not confirmed/i.test(message)
  return result
}

/* ---------------------------------------------------------------- sessions */

/** True when the current URL carries an auth callback payload. */
export function urlHasAuthPayload() {
  if (typeof window === 'undefined') return false
  const hash = window.location.hash || ''
  const search = window.location.search || ''
  return (
    hash.includes('access_token') ||
    hash.includes('error') ||
    /[?&]code=/.test(search) ||
    /[?&]error/.test(search)
  )
}

/** Any error Supabase reported by redirecting back with error params. */
export function readAuthErrorFromUrl() {
  if (typeof window === 'undefined') return null
  const hash = new URLSearchParams((window.location.hash || '').replace(/^#/, ''))
  const query = new URLSearchParams(window.location.search || '')
  const description =
    hash.get('error_description') || query.get('error_description') || null
  const code = hash.get('error_code') || query.get('error_code') || null
  if (!description && !code) return null

  // URLSearchParams has already percent-decoded and turned '+' into spaces;
  // decoding again would throw on any literal '%' in the text.
  const message = description || `Sign-in failed (${code}).`
  if (code === 'otp_expired' || /expired/i.test(message)) {
    return new Error(
      'That confirmation link has expired. Send yourself a fresh one below.',
    )
  }
  if (code === 'access_denied') {
    return new Error('Sign-in was cancelled before it completed.')
  }
  return new Error(message)
}

/**
 * Wait for the client to finish turning a callback URL into a session.
 *
 * `detectSessionInUrl` does this asynchronously, so a `getSession()` fired
 * immediately after landing on /auth/callback can legitimately return null.
 * Resolving too early was sending freshly-confirmed users back to the login
 * page, so poll briefly and also listen for the auth event.
 */
export function waitForSession(timeoutMs = 8000) {
  const client = requireClient()

  return new Promise((resolve) => {
    let settled = false
    const finish = (session) => {
      if (settled) return
      settled = true
      clearInterval(poll)
      clearTimeout(timer)
      subscription?.unsubscribe()
      resolve(session)
    }

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, session) => {
      if (session) finish(session)
    })

    const check = async () => {
      const { data } = await client.auth.getSession()
      if (data?.session) finish(data.session)
    }

    const poll = setInterval(check, 250)
    const timer = setTimeout(() => finish(null), timeoutMs)
    check()
  })
}

export async function getAccessToken() {
  if (!supabase) return null
  const { data } = await supabase.auth.getSession()
  return data?.session?.access_token ?? null
}

/* ------------------------------------------------------------------- auth */

export async function signInWithGoogle() {
  const { error } = await requireClient().auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: redirectTo(),
      queryParams: { access_type: 'offline', prompt: 'consent' },
    },
  })
  if (error) throw friendlyAuthError(error)
}

export async function signInWithEmail(email, password) {
  const { data, error } = await requireClient().auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  })
  if (error) throw friendlyAuthError(error)
  return data
}

export async function signUpWithEmail(email, password, fullName = '') {
  const { data, error } = await requireClient().auth.signUp({
    email: email.trim().toLowerCase(),
    password,
    options: {
      data: { full_name: fullName.trim() },
      emailRedirectTo: redirectTo(),
    },
  })
  if (error) throw friendlyAuthError(error)

  // Supabase returns an obfuscated user with no identities when the address is
  // already taken, rather than erroring -- so that has to be detected by shape.
  if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
    const err = new Error(
      'An account already exists for that email address. Sign in instead, or reset ' +
        'your password.',
    )
    err.code = 'user_already_exists'
    throw err
  }

  // With "Confirm email" enabled, signUp creates the user but withholds the
  // session until the emailed link is clicked.
  return { ...data, needsConfirmation: Boolean(data.user && !data.session) }
}

export async function resendConfirmationEmail(email) {
  const { error } = await requireClient().auth.resend({
    type: 'signup',
    email: email.trim().toLowerCase(),
    options: { emailRedirectTo: redirectTo() },
  })
  if (error) throw friendlyAuthError(error)
}

export async function requestPasswordReset(email) {
  const { error } = await requireClient().auth.resetPasswordForEmail(
    email.trim().toLowerCase(),
    { redirectTo: redirectTo() },
  )
  if (error) throw friendlyAuthError(error)
}

export async function signOutSupabase() {
  if (supabase) await supabase.auth.signOut()
}
