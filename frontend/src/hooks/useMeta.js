import { useEffect, useState } from 'react'

import { api } from '../lib/api'

// Module-level cache: the choice lists never change during a session.
let cache = null
let inflight = null

const FALLBACK = {
  categories: [],
  districts: [],
  order_milestones: [],
  payment_methods: [],
  order_statuses: [],
  dev_login_enabled: false,
}

export function useMeta() {
  const [meta, setMeta] = useState(cache ?? FALLBACK)
  const [ready, setReady] = useState(Boolean(cache))

  useEffect(() => {
    if (cache) return undefined
    let cancelled = false
    inflight = inflight || api.meta()
    inflight
      .then((data) => {
        cache = data
        if (!cancelled) {
          setMeta(data)
          setReady(true)
        }
      })
      .catch(() => {
        // Backend down -- the UI still renders with empty choice lists.
        if (!cancelled) setReady(true)
      })
      .finally(() => {
        inflight = null
      })
    return () => {
      cancelled = true
    }
  }, [])

  return { meta, ready }
}

export function categoryLabel(meta, value) {
  return meta.categories.find((c) => c.value === value)?.label || value
}
