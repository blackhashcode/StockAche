import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'

import { api, setTokenGetter } from '../lib/api'
import {
  getAccessToken,
  requestPasswordReset,
  resendConfirmationEmail,
  signInWithEmail,
  signInWithGoogle,
  signOutSupabase,
  signUpWithEmail,
  supabase,
  supabaseConfigured,
  urlHasAuthPayload,
  waitForSession,
} from '../lib/supabase'

const AuthContext = createContext(null)

// One-time cleanup. An earlier build let the browser hold a local test token
// and handed it to the API *in preference to* the real Supabase session. Once
// the seeded account behind it was replaced, every request 401'd while the user
// appeared to be signed in. Nothing writes this key any more; purge leftovers
// so affected browsers heal themselves on next load.
try {
  window.localStorage.removeItem('stockache.devToken')
} catch {
  /* private mode / storage disabled -- nothing to clean up */
}

const BACKEND_UNREACHABLE =
  'Signed in with Supabase, but the StockAche server did not accept the session. ' +
  'Check that the Django backend is running on port 8000.'

export function AuthProvider({ children }) {
  const [account, setAccount] = useState(null)
  const [loading, setLoading] = useState(true)
  const [authError, setAuthError] = useState(null)

  // The Supabase session is the single source of truth for the API token.
  useEffect(() => {
    setTokenGetter(getAccessToken)
  }, [])

  /**
   * Pull the account from our own API.
   *
   * A 401 legitimately means "not signed in" and resolves to null. Anything
   * else -- the backend being down, a 500 -- is a real failure and must not be
   * mistaken for a signed-out user, because callers use the return value to
   * decide whether to report success.
   */
  const refresh = useCallback(async ({ silent = false } = {}) => {
    try {
      const data = await api.me()
      setAccount(data)
      setAuthError(null)
      return data
    } catch (err) {
      setAccount(null)
      if (err.status === 401) {
        setAuthError(null)
        return null
      }
      setAuthError(err)
      if (!silent) throw err
      return null
    }
  }, [])

  const hasSession = useCallback(async () => {
    if (!supabase) return false
    // Landing on a callback URL means the client is still turning the fragment
    // into a session; asking getSession() now would race it.
    if (urlHasAuthPayload()) return Boolean(await waitForSession())
    return Boolean(await getAccessToken())
  }, [])

  // Bootstrap: restore an existing session on first paint.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (await hasSession()) await refresh({ silent: true })
      if (!cancelled) setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [hasSession, refresh])

  // Track sign-in / sign-out happening inside the Supabase client.
  useEffect(() => {
    if (!supabase) return undefined
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        setAccount(null)
        return
      }
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        // Deferred out of the callback so no Supabase call runs while the
        // client is still dispatching this event.
        setTimeout(() => {
          refresh({ silent: true })
        }, 0)
      }
    })
    return () => subscription.unsubscribe()
  }, [refresh])

  const loginWithGoogle = useCallback(async () => {
    setAuthError(null)
    await signInWithGoogle()
  }, [])

  /** Establish the local account, failing loudly rather than half-succeeding. */
  const syncAfterSignIn = useCallback(async () => {
    const acct = await refresh()
    if (!acct) throw new Error(BACKEND_UNREACHABLE)
    return acct
  }, [refresh])

  const loginWithPassword = useCallback(
    async (email, password) => {
      setAuthError(null)
      await signInWithEmail(email, password)
      return syncAfterSignIn()
    },
    [syncAfterSignIn],
  )

  const signUpWithPassword = useCallback(
    async (email, password, fullName) => {
      setAuthError(null)
      const result = await signUpWithEmail(email, password, fullName)
      // No session yet means Supabase is waiting on email confirmation; there
      // is nothing to sync and the caller shows the confirmation screen.
      if (!result.needsConfirmation) await syncAfterSignIn()
      return result
    },
    [syncAfterSignIn],
  )

  const sendPasswordReset = useCallback(async (email) => {
    setAuthError(null)
    await requestPasswordReset(email)
  }, [])

  const resendConfirmation = useCallback(async (email) => {
    setAuthError(null)
    await resendConfirmationEmail(email)
  }, [])

  const logout = useCallback(async () => {
    await signOutSupabase()
    setAccount(null)
    setAuthError(null)
  }, [])

  const setRole = useCallback(
    async (role) => {
      await api.selectRole(role)
      return refresh()
    },
    [refresh],
  )

  const value = useMemo(
    () => ({
      account,
      loading,
      authError,
      isAuthenticated: Boolean(account),
      googleEnabled: supabaseConfigured,
      role: account?.role || null,
      buyerProfile: account?.buyer_profile || null,
      supplierProfile: account?.supplier_profile || null,
      // "Onboarded" means: role chosen AND the matching profile filled in.
      isOnboarded: Boolean(
        account?.role === 'buyer'
          ? account?.buyer_profile
          : account?.role === 'supplier'
            ? account?.supplier_profile
            : false,
      ),
      loginWithGoogle,
      loginWithPassword,
      signUpWithPassword,
      sendPasswordReset,
      resendConfirmation,
      logout,
      setRole,
      refresh,
    }),
    [
      account,
      loading,
      authError,
      loginWithGoogle,
      loginWithPassword,
      signUpWithPassword,
      sendPasswordReset,
      resendConfirmation,
      logout,
      setRole,
      refresh,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>')
  return context
}
