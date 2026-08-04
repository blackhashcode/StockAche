import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import ProductCard from '../components/ProductCard'
import { Button, Card, EmptyState, ErrorBanner, Input, Loader, Select, cx } from '../components/ui'
import { useMeta } from '../hooks/useMeta'
import { api } from '../lib/api'

const SORTS = [
  { value: '-created_at', label: 'Newest first' },
  { value: 'unit_price_bdt', label: 'Price: low → high' },
  { value: '-unit_price_bdt', label: 'Price: high → low' },
  { value: 'moq', label: 'MOQ: low → high' },
  { value: '-available_quantity', label: 'Largest lots' },
  { value: 'gsm', label: 'GSM: light → heavy' },
]

const GSM_PRESETS = [
  { label: 'Light (≤160)', min: '', max: '160' },
  { label: 'Mid (161-260)', min: '161', max: '260' },
  { label: 'Heavy (261+)', min: '261', max: '' },
]

const EMPTY_FILTERS = {
  search: '',
  category: '',
  gsm_min: '',
  gsm_max: '',
  moq_min: '',
  moq_max: '',
  price_min: '',
  price_max: '',
  district: '',
  verified_only: '',
  in_stock: '',
  ordering: '-created_at',
}

export default function Marketplace() {
  const { meta } = useMeta()
  const [searchParams, setSearchParams] = useSearchParams()

  const filters = useMemo(() => {
    const next = { ...EMPTY_FILTERS }
    for (const key of Object.keys(EMPTY_FILTERS)) {
      const value = searchParams.get(key)
      if (value !== null) next[key] = value
    }
    return next
  }, [searchParams])

  const [searchDraft, setSearchDraft] = useState(filters.search)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showFilters, setShowFilters] = useState(false)
  const page = Number(searchParams.get('page') || 1)

  const update = useCallback(
    (patch, { resetPage = true } = {}) => {
      const next = new URLSearchParams(searchParams)
      Object.entries(patch).forEach(([key, value]) => {
        if (value === '' || value === null || value === undefined) next.delete(key)
        else next.set(key, value)
      })
      if (resetPage) next.delete('page')
      setSearchParams(next, { replace: true })
    },
    [searchParams, setSearchParams],
  )

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    api
      .products({ ...filters, page })
      .then((result) => !cancelled && (setData(result), setError(null)))
      .catch((err) => !cancelled && setError(err))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [filters, page])

  // Debounce the search box so we aren't firing a request per keystroke.
  useEffect(() => {
    if (searchDraft === filters.search) return undefined
    const timer = setTimeout(() => update({ search: searchDraft }), 350)
    return () => clearTimeout(timer)
  }, [searchDraft, filters.search, update])

  const activeCount = Object.entries(filters).filter(
    ([key, value]) => value && !['ordering', 'search'].includes(key),
  ).length

  const clearAll = () => {
    setSearchDraft('')
    setSearchParams({}, { replace: true })
  }

  const results = data?.results || []
  const totalPages = data ? Math.ceil(data.count / 24) : 1

  const filterPanel = (
    <div className="space-y-6">
      {/* Category */}
      <div>
        <p className="pixel-label">Fabric Category</p>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => update({ category: '' })}
            className={cx(
              'pixel-tag transition-colors',
              !filters.category ? 'bg-ink text-paper' : 'bg-paper hover:bg-parchment',
            )}
          >
            All
          </button>
          {meta.categories.map((category) => (
            <button
              key={category.value}
              onClick={() =>
                update({ category: filters.category === category.value ? '' : category.value })
              }
              className={cx(
                'pixel-tag transition-colors',
                filters.category === category.value
                  ? 'bg-retro-red text-paper'
                  : 'bg-paper hover:bg-parchment',
              )}
            >
              {category.label}
            </button>
          ))}
        </div>
      </div>

      {/* GSM */}
      <div>
        <p className="pixel-label">GSM Range</p>
        <div className="mb-2 flex flex-wrap gap-2">
          {GSM_PRESETS.map((preset) => {
            const active = filters.gsm_min === preset.min && filters.gsm_max === preset.max
            return (
              <button
                key={preset.label}
                onClick={() =>
                  update(
                    active
                      ? { gsm_min: '', gsm_max: '' }
                      : { gsm_min: preset.min, gsm_max: preset.max },
                  )
                }
                className={cx(
                  'pixel-tag transition-colors',
                  active ? 'bg-retro-blue text-paper' : 'bg-paper hover:bg-parchment',
                )}
              >
                {preset.label}
              </button>
            )
          })}
        </div>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min="0"
            placeholder="Min"
            value={filters.gsm_min}
            onChange={(e) => update({ gsm_min: e.target.value })}
          />
          <span className="font-pixel text-pixel-xs">—</span>
          <Input
            type="number"
            min="0"
            placeholder="Max"
            value={filters.gsm_max}
            onChange={(e) => update({ gsm_max: e.target.value })}
          />
        </div>
      </div>

      {/* MOQ */}
      <div>
        <p className="pixel-label">MOQ Range (pcs)</p>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min="0"
            placeholder="Min"
            value={filters.moq_min}
            onChange={(e) => update({ moq_min: e.target.value })}
          />
          <span className="font-pixel text-pixel-xs">—</span>
          <Input
            type="number"
            min="0"
            placeholder="Max"
            value={filters.moq_max}
            onChange={(e) => update({ moq_max: e.target.value })}
          />
        </div>
      </div>

      {/* Price */}
      <div>
        <p className="pixel-label">Unit Price (৳)</p>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min="0"
            placeholder="Min"
            value={filters.price_min}
            onChange={(e) => update({ price_min: e.target.value })}
          />
          <span className="font-pixel text-pixel-xs">—</span>
          <Input
            type="number"
            min="0"
            placeholder="Max"
            value={filters.price_max}
            onChange={(e) => update({ price_max: e.target.value })}
          />
        </div>
      </div>

      {/* District */}
      <div>
        <p className="pixel-label">Supplier District</p>
        <Select
          value={filters.district}
          onChange={(e) => update({ district: e.target.value })}
        >
          <option value="">Anywhere in Bangladesh</option>
          {meta.districts.map((district) => (
            <option key={district} value={district}>
              {district}
            </option>
          ))}
        </Select>
      </div>

      {/* Availability & verification */}
      <div className="space-y-2">
        <label className="flex cursor-pointer items-center gap-3 border-[3px] border-ink bg-parchment p-3">
          <input
            type="checkbox"
            checked={filters.in_stock === 'true'}
            onChange={(e) => update({ in_stock: e.target.checked ? 'true' : '' })}
            className="h-5 w-5 shrink-0 accent-retro-green"
          />
          <span className="eyebrow">Hide sold-out lots</span>
        </label>

        <label className="flex cursor-pointer items-center gap-3 border-[3px] border-ink bg-parchment p-3">
          <input
            type="checkbox"
            checked={filters.verified_only === 'true'}
            onChange={(e) => update({ verified_only: e.target.checked ? 'true' : '' })}
            className="h-5 w-5 shrink-0 accent-retro-green"
          />
          <span className="eyebrow">Verified suppliers only</span>
        </label>
      </div>

      {activeCount > 0 && (
        <Button variant="dark" className="w-full" onClick={clearAll}>
          Clear {activeCount} Filter{activeCount > 1 ? 's' : ''}
        </Button>
      )}
    </div>
  )

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6">
        <h1 className="h-page">
          <span className="text-retro-red">▸ </span>Stocklot Feed
        </h1>
        <p className="mt-2 text-base text-slate/80">
          {data
            ? `${data.count} lot${data.count === 1 ? '' : 's'} found` +
              (filters.in_stock === 'true' ? ' · in stock only' : '')
            : 'Loading lots…'}
        </p>
      </div>

      {/* Search + sort bar */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[16rem] flex-1">
          <Input
            value={searchDraft}
            onChange={(e) => setSearchDraft(e.target.value)}
            placeholder="Search lots, fabrics, suppliers…"
            className="pl-10"
          />
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-pixel text-pixel-xs">
            ⌕
          </span>
        </div>

        <Select
          value={filters.ordering}
          onChange={(e) => update({ ordering: e.target.value })}
          className="w-auto min-w-[12rem]"
        >
          {SORTS.map((sort) => (
            <option key={sort.value} value={sort.value}>
              {sort.label}
            </option>
          ))}
        </Select>

        <Button
          variant="dark"
          className="lg:hidden"
          onClick={() => setShowFilters((v) => !v)}
        >
          Filters{activeCount > 0 ? ` (${activeCount})` : ''}
        </Button>
      </div>

      <ErrorBanner error={error} onDismiss={() => setError(null)} />

      <div className="grid gap-6 lg:grid-cols-[16rem_1fr]">
        <aside className={cx('lg:block', showFilters ? 'block' : 'hidden')}>
          <Card className="lg:sticky lg:top-32">{filterPanel}</Card>
        </aside>

        <section>
          {loading ? (
            <Loader label="Fetching lots" />
          ) : results.length === 0 ? (
            <EmptyState
              icon="⌕"
              title="No lots match those specs"
              message="Try widening the GSM or MOQ range, or clear the filters to see everything."
              action={
                activeCount > 0 && (
                  <Button className="mt-2" onClick={clearAll}>
                    Clear Filters
                  </Button>
                )
              }
            />
          ) : (
            <>
              <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {results.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>

              {totalPages > 1 && (
                <div className="mt-8 flex items-center justify-center gap-3">
                  <Button
                    variant="dark"
                    size="sm"
                    disabled={!data.previous}
                    onClick={() => update({ page: page - 1 }, { resetPage: false })}
                  >
                    ← Prev
                  </Button>
                  <span className="h-card">
                    {page} / {totalPages}
                  </span>
                  <Button
                    variant="dark"
                    size="sm"
                    disabled={!data.next}
                    onClick={() => update({ page: page + 1 }, { resetPage: false })}
                  >
                    Next →
                  </Button>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  )
}
