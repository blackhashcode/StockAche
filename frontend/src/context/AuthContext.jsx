import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

import { api, setTokenGetter } from '../lib/api'
import { signInWithGoogle, signOutSupabase, supabase, supabaseConfigured } from '../lib/supabase'

const AuthContext = createContext(null)
const DEV_TOKEN_KEY = 'stockache.devToken'

export function AuthProvider({ children }) {
  const [account, setAccount] = useState(null)
  const [loading, setLoading] = useState(true)
  const [authError, setAuthError] = useState(null)

  // Kept in a ref as well so the token getter can read it synchronously
  // without being re-created on every change.
  const devTokenRef = useRef(localStorage.getItem(DEV_TOKEN_KEY))
  const [devToken, setDevToken] = useState(devTokenRef.current)

  // Wire the API client to whichever session we currently hold.
  useEffect(() => {
    setTokenGetter(async () => {
      if (devTokenRef.current) return devTokenRef.current
      if (!supabase) return null
      const { data } = await supabase.auth.getSession()
      return data?.session?.access_token ?? null
    })
  }, [])

  const refresh = useCallback(async () => {
    try {
      const data = await api.me()
      setAccount(data)
      setAuthError(null)
      return data
    } catch (err) {
      // 401 just means "not signed in" -- not an error worth surfacing.
      if (err.status !== 401) setAuthError(err)
      setAccount(null)
      return null
    }
  }, [])

  const hasSession = useCallback(async () => {
    if (devTokenRef.current) return true
    if (!supabase) return false
    const { data } = await supabase.auth.getSession()
    return Boolean(data?.session)
  }, [])

  // Bootstrap: restore an existing session on first paint.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (await hasSession()) await refresh()
      if (!cancelled) setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [hasSession, refresh])

  // React to Google sign-in / sign-out happening in the Supabase client.
  useEffect(() => {
    if (!supabase) return undefined
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event) => {
      if (devTokenRef.current) return
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        setLoading(true)
        await refresh()
        setLoading(false)
      }
      if (event === 'SIGNED_OUT') setAccount(null)
    })
    return () => subscription.unsubscribe()
  }, [refresh])

  const loginWithGoogle = useCallback(async () => {
    setAuthError(null)
    await signInWithGoogle()
  }, [])

  /** Prototype-only shortcut into a seeded demo account. */
  const loginAsDemo = useCallback(
    async (email) => {
      setLoading(true)
      try {
        const { access_token } = await api.devLogin(email)
        localStorage.setItem(DEV_TOKEN_KEY, access_token)
        devTokenRef.current = access_token
        setDevToken(access_token)
        return await refresh()
      } finally {
        setLoading(false)
      }
    },
    [refresh],
  )

  const logout = useCallback(async () => {
    localStorage.removeItem(DEV_TOKEN_KEY)
    devTokenRef.current = null
    setDevToken(null)
    await signOutSupabase()
    setAccount(null)
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
      isDemoSession: Boolean(devToken),
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
      loginAsDemo,
      logout,
      setRole,
      refresh,
    }),
    [account, loading, authError, devToken, loginWithGoogle, loginAsDemo, logout, setRole, refresh],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>')
  return context
}
