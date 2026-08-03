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

export async function signInWithGoogle() {
  const { error } = await requireClient().auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
      queryParams: { access_type: 'offline', prompt: 'consent' },
    },
  })
  if (error) throw error
}

export async function signInWithEmail(email, password) {
  const { data, error } = await requireClient().auth.signInWithPassword({
    email: email.trim(),
    password,
  })
  if (error) throw error
  return data
}

export async function signUpWithEmail(email, password, fullName = '') {
  const { data, error } = await requireClient().auth.signUp({
    email: email.trim(),
    password,
    options: {
      data: { full_name: fullName.trim() },
      emailRedirectTo: `${window.location.origin}/auth/callback`,
    },
  })
  if (error) throw error

  // With "Confirm email" enabled in Supabase, signUp returns a user but no
  // session until the link is clicked.
  return { ...data, needsConfirmation: Boolean(data.user && !data.session) }
}

export async function requestPasswordReset(email) {
  const { error } = await requireClient().auth.resetPasswordForEmail(email.trim(), {
    redirectTo: `${window.location.origin}/auth/callback`,
  })
  if (error) throw error
}

export async function signOutSupabase() {
  if (supabase) await supabase.auth.signOut()
}
