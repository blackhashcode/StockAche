import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

import { Loader } from '../components/ui'
import { useAuth } from '../context/AuthContext'

/** Landing spot for the Supabase OAuth redirect. */
export default function AuthCallback() {
  const { loading, isAuthenticated, isOnboarded, role } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (loading) return
    if (!isAuthenticated) {
      navigate('/login', { replace: true })
    } else if (!isOnboarded) {
      navigate('/onboarding', { replace: true })
    } else {
      navigate(role === 'supplier' ? '/supplier' : '/marketplace', { replace: true })
    }
  }, [loading, isAuthenticated, isOnboarded, role, navigate])

  return <Loader label="Completing sign-in" />
}
