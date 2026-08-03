import { Navigate, useLocation } from 'react-router-dom'

import { useAuth } from '../context/AuthContext'
import { Loader } from './ui'

/** Requires a session. Sends unfinished signups through onboarding. */
export function RequireAuth({ children, requireOnboarding = true }) {
  const { isAuthenticated, isOnboarded, loading } = useAuth()
  const location = useLocation()

  if (loading) return <Loader label="Checking session" />
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />
  }
  if (requireOnboarding && !isOnboarded) {
    return <Navigate to="/onboarding" state={{ from: location.pathname }} replace />
  }
  return children
}

/** Requires a specific role; wrong role gets bounced to their own home. */
export function RequireRole({ role, children }) {
  const { loading, isAuthenticated, isOnboarded, role: currentRole } = useAuth()
  const location = useLocation()

  if (loading) return <Loader label="Checking access" />
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />
  }
  if (!isOnboarded) return <Navigate to="/onboarding" replace />
  if (currentRole !== role) {
    return <Navigate to={currentRole === 'supplier' ? '/supplier' : '/marketplace'} replace />
  }
  return children
}
