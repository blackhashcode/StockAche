import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { Button, Card, Loader } from '../components/ui'
import { useAuth } from '../context/AuthContext'
import { readAuthErrorFromUrl } from '../lib/supabase'

/**
 * Landing spot for every Supabase redirect: OAuth, email confirmation and
 * password reset all come back here.
 *
 * Supabase reports failures by appending error params rather than by throwing,
 * so those are read off the URL before anything else. Previously this page
 * bounced silently to /login on any failure, which made an expired confirmation
 * link look identical to a bug.
 */
export default function AuthCallback() {
  const { loading, isAuthenticated, isOnboarded, role } = useAuth()
  const navigate = useNavigate()
  const [urlError] = useState(() => readAuthErrorFromUrl())

  useEffect(() => {
    if (urlError || loading) return
    if (!isAuthenticated) {
      navigate('/login', { replace: true, state: { callbackFailed: true } })
    } else if (!isOnboarded) {
      navigate('/onboarding', { replace: true })
    } else {
      navigate(role === 'supplier' ? '/supplier' : '/marketplace', { replace: true })
    }
  }, [urlError, loading, isAuthenticated, isOnboarded, role, navigate])

  if (urlError) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16">
        <Card className="border-t-8 border-t-retro-red">
          <h1 className="h-section">Sign-in could not be completed</h1>
          <p className="mt-4 text-base leading-relaxed text-slate/85">{urlError.message}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link to="/login">
              <Button>Back to Sign In</Button>
            </Link>
            <Link to="/marketplace">
              <Button variant="ghost">Browse Stocklots</Button>
            </Link>
          </div>
        </Card>
      </div>
    )
  }

  return <Loader label="Completing sign-in" />
}
