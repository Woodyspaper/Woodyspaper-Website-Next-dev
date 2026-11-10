import { useEffect, useState, type FormEvent } from 'react'
import { useGetCatalogProducts } from '@workspace/api-client-react'
import type { CatalogProduct } from '@workspace/api-client-react'
import { useRouter, useSearchParams } from '@/lib/navigation'

const PAGE_SIZE = 24
const PLACEHOLDER_IMAGE = '/product-placeholder.webp'

type CatalogProductsProps = {
  initialQuery?: string
  hubPath?: string
}

export function CatalogProducts({ initialQuery = '', hubPath }: CatalogProductsProps) {
  const router = useRouter()
  const params = useSearchParams()
  const queryFromUrl = (params.get('q') ?? initialQuery).trim().slice(0, 100)
  const offsetFromUrl = validIntegerParam(params.get('offset')) ?? 0
  const minPriceFromUrl = validPriceParam(params.get('minPrice'))
  const maxPriceFromUrl = validPriceParam(params.get('maxPrice'))
  const filters = Object.fromEntries([...params.entries()]
    .filter(([key, value]) => key.startsWith('filter.') && value)
    .map(([key, value]) => [key.slice('filter.'.length), value]))
  const [search, setSearch] = useState(queryFromUrl)
  const [minPrice, setMinPrice] = useState(minPriceFromUrl ?? '')
  const [maxPrice, setMaxPrice] = useState(maxPriceFromUrl ?? '')
  const [filterError, setFilterError] = useState('')

  useEffect(() => {
    setSearch(queryFromUrl)
    setMinPrice(minPriceFromUrl ?? '')
    setMaxPrice(maxPriceFromUrl ?? '')
    setFilterError('')
  }, [queryFromUrl, minPriceFromUrl, maxPriceFromUrl])

  const { data, error, isLoading, isFetching } = useGetCatalogProducts(
    {
      q: queryFromUrl || undefined,
      filters: Object.keys(filters).length ? JSON.stringify(filters) : undefined,
      minPrice: minPriceFromUrl === undefined ? undefined : Number(minPriceFromUrl),
      maxPrice: maxPriceFromUrl === undefined ? undefined : Number(maxPriceFromUrl),
      limit: PAGE_SIZE,
      offset: offsetFromUrl,
    },
    { query: { staleTime: 30_000 } },
  )

  const updateUrl = (values: Record<string, string | undefined>) => {
    const next = new URLSearchParams(window.location.search)
    for (const [key, value] of Object.entries(values)) {
      if (value) next.set(key, value)
      else next.delete(key)
    }
    const queryString = next.toString()
    router.push(`${hubPath ?? window.location.pathname}${queryString ? `?${queryString}` : ''}`)
  }

  const applyPriceAndSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const normalizedMin = normalizePriceInput(minPrice)
    const normalizedMax = normalizePriceInput(maxPrice)
    if (normalizedMin === null || normalizedMax === null) {
      setFilterError('Enter a valid price of zero or more.')
      return
    }
    if (normalizedMin !== undefined && normalizedMax !== undefined && normalizedMin > normalizedMax) {
      setFilterError('Minimum price cannot exceed maximum price.')
      return
    }
    setFilterError('')
    updateUrl({
      q: search.trim().slice(0, 100),
      minPrice: normalizedMin === undefined ? undefined : String(normalizedMin),
      maxPrice: normalizedMax === undefined ? undefined : String(normalizedMax),
      offset: undefined,
    })
  }

  const clearFilters = () => {
    setSearch('')
    setMinPrice('')
    setMaxPrice('')
    setFilterError('')
    const next = new URLSearchParams(window.location.search)
    next.delete('q')
    next.delete('minPrice')
    next.delete('maxPrice')
    next.delete('offset')
    for (const key of [...next.keys()]) {
      if (key.startsWith('filter.')) next.delete(key)
    }
    const queryString = next.toString()
    router.push(`${hubPath ?? window.location.pathname}${queryString ? `?${queryString}` : ''}`)
  }

  const clearFacetFilters = () => {
    const next = new URLSearchParams(window.location.search)
    next.delete('offset')
    for (const key of [...next.keys()]) {
      if (key.startsWith('filter.')) next.delete(key)
    }
    const queryString = next.toString()
    router.push(`${hubPath ?? window.location.pathname}${queryString ? `?${queryString}` : ''}`)
  }

  const errorData = error && typeof error === 'object' && 'data' in error
    ? (error as { data?: unknown }).data
    : null
  const errorMessage =
    errorData && typeof errorData === 'object' && 'error' in errorData &&
    typeof errorData.error === 'string'
      ? errorData.error
      : error instanceof Error
        ? error.message
        : 'The product catalog could not be loaded.'
  const currentOffset = data?.offset ?? offsetFromUrl
  const pageSize = data?.limit ?? PAGE_SIZE
  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / pageSize))
  const lastOffset = (totalPages - 1) * pageSize
  const hasPrevious = currentOffset > 0
  const hasNext = Boolean(data && currentOffset + data.limit < data.total)

  return (
    <div className="space-y-8">
      <form onSubmit={applyPriceAndSearch} className="mx-auto max-w-5xl rounded-panel border border-slate-200 bg-white p-4 shadow-glass sm:p-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="sm:col-span-2 lg:col-span-3">
            <label className="mb-1.5 block text-sm font-medium text-ink" htmlFor="catalog-search">Search products</label>
            <input
              id="catalog-search"
              type="search"
              maxLength={100}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by product name or SKU"
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-ink shadow-sm outline-none transition focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-ink" htmlFor="catalog-min-price">Minimum price</label>
            <input
              id="catalog-min-price"
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              value={minPrice}
              onChange={(event) => setMinPrice(event.target.value)}
              placeholder="No minimum"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-ink shadow-sm outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-ink" htmlFor="catalog-max-price">Maximum price</label>
            <input
              id="catalog-max-price"
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              value={maxPrice}
              onChange={(event) => setMaxPrice(event.target.value)}
              placeholder="No maximum"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-ink shadow-sm outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20"
            />
          </div>
        </div>
        {filterError ? <p className="mt-3 text-sm text-rose-700" role="alert">{filterError}</p> : null}
        <div className="mt-5 flex flex-wrap justify-end gap-3">
          <button
            type="button"
            onClick={clearFilters}
            className="rounded-full border border-brand-blue/30 px-5 py-2.5 font-semibold text-brand-blue transition hover:bg-brand-mist"
          >
            Clear filters
          </button>
          <button
            type="submit"
            className="rounded-full bg-brand-blue px-6 py-2.5 font-semibold text-white shadow-cta transition hover:bg-brand-blue-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-blue"
          >
            Apply filters
          </button>
        </div>
      </form>

      {data ? (
        <section aria-label="Product filters" className="rounded-panel border border-slate-200 bg-white p-5 shadow-glass">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h3 className="font-semibold text-ink">Filter products</h3>
            {Object.keys(filters).length > 0 ? (
              <button
                type="button"
                onClick={clearFacetFilters}
                className="text-sm font-semibold text-brand-blue underline underline-offset-4"
              >
                Clear all filters
              </button>
            ) : null}
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {!data.facets?.some((facet) => facet.key === 'size') ? (
              <label className="flex min-w-0 flex-col gap-1.5 text-sm font-semibold text-slate-500">
                Size
                <select aria-label="Size" disabled className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 font-normal">
                  <option>No size data for these products</option>
                </select>
              </label>
            ) : null}
            {(data.facets || []).map((facet) => (
              <label key={facet.key} className="flex min-w-0 flex-col gap-1.5 text-sm font-semibold text-ink">
                {facet.label}
                <select
                  aria-label={facet.label}
                  value={filters[facet.key] || ''}
                  onChange={(event) => updateUrl({
                    [`filter.${facet.key}`]: event.target.value || undefined,
                    offset: undefined,
                  })}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 font-normal outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20"
                >
                  <option value="">All {facet.label.toLowerCase()}</option>
                  {facet.options.map((option) => (
                    <option key={option.value} value={option.value}>{option.label} ({option.count})</option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          {isFetching ? <p role="status" className="mt-3 text-sm text-slate-500">Updating filters and products…</p> : null}
          {!isFetching && !error && !data.facets?.length ? (
            <p className="text-sm text-slate-500">No filter values are available for this search.</p>
          ) : null}
          {Object.keys(filters).length > 0 ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {Object.entries(filters).map(([key, value]) => {
                const facet = data.facets?.find((item) => item.key === key)
                const label = facet?.options.find((option) => option.value === value)?.label || value
                return (
                  <button
                    key={key}
                    type="button"
                    aria-label={`Remove ${facet?.label || key} filter`}
                    onClick={() => updateUrl({ [`filter.${key}`]: undefined, offset: undefined })}
                    className="rounded-full bg-brand-mist px-3 py-1.5 text-sm text-brand-blue"
                  >
                    {facet?.label || key}: {label} <span aria-hidden="true">×</span>
                  </button>
                )
              })}
            </div>
          ) : null}
        </section>
      ) : null}

      {isLoading ? (
        <p className="py-12 text-center text-slate-600" role="status">Loading products…</p>
      ) : error ? (
        <div className="rounded-panel border border-brand-blue/20 bg-white p-8 text-center shadow-glass" role="alert">
          <h3 className="text-xl font-semibold text-ink">Inventory is temporarily unavailable</h3>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-slate-600">{errorMessage}</p>
        </div>
      ) : !data?.items.length ? (
        <p className="rounded-panel border border-slate-200 bg-white p-10 text-center text-slate-600">
          {queryFromUrl
            ? `No products found for “${queryFromUrl}” with the selected filters.`
            : 'No products match the selected filters.'}
        </p>
      ) : (
        <>
          <div className="flex items-center justify-between gap-4 text-sm text-slate-600" aria-live="polite">
            <span>{data.total.toLocaleString()} products</span>
            {isFetching ? <span>Updating…</span> : null}
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:gap-6">
            {data.items.map((product) => <ProductCard key={product.id} product={product} />)}
          </div>
          <nav aria-label="Product pages" className="flex flex-wrap items-center justify-center gap-2 sm:gap-4">
            <button
              type="button"
              aria-label="Previous"
              title="Previous page"
              disabled={!hasPrevious || isFetching}
              onClick={() => updateUrl({ offset: String(Math.max(0, currentOffset - PAGE_SIZE)) })}
              className="rounded-full border border-brand-blue/30 px-5 py-2.5 font-semibold text-brand-blue transition hover:bg-brand-mist disabled:cursor-not-allowed disabled:opacity-40"
            >
              <span aria-hidden="true">←</span>
            </button>
            <span className="text-sm text-slate-600">
              Page{' '}
              <button
                type="button"
                aria-label="First"
                title="Go to first page"
                disabled={!hasPrevious || isFetching}
                onClick={() => updateUrl({ offset: undefined })}
                className="rounded px-1 py-2 font-semibold text-brand-blue underline underline-offset-4 hover:text-brand-blue-dark focus-visible:outline-2 focus-visible:outline-brand-blue disabled:cursor-default disabled:no-underline"
              >{Math.floor(currentOffset / pageSize) + 1}</button>
              {' '}of{' '}
              <button
                type="button"
                aria-label="Last"
                title="Go to last page"
                disabled={!hasNext || isFetching}
                onClick={() => updateUrl({ offset: lastOffset ? String(lastOffset) : undefined })}
                className="rounded px-1 py-2 font-semibold text-brand-blue underline underline-offset-4 hover:text-brand-blue-dark focus-visible:outline-2 focus-visible:outline-brand-blue disabled:cursor-default disabled:no-underline"
              >{totalPages}</button>
            </span>
            <button
              type="button"
              aria-label="Next"
              title="Next page"
              disabled={!hasNext || isFetching}
              onClick={() => updateUrl({ offset: String(currentOffset + PAGE_SIZE) })}
              className="rounded-full border border-brand-blue/30 px-5 py-2.5 font-semibold text-brand-blue transition hover:bg-brand-mist disabled:cursor-not-allowed disabled:opacity-40"
            >
              <span aria-hidden="true">→</span>
            </button>
          </nav>
        </>
      )}
    </div>
  )
}

function validIntegerParam(value: string | null): number | undefined {
  if (value === null || !/^\d+$/.test(value)) return undefined
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) ? parsed : undefined
}

function validPriceParam(value: string | null): string | undefined {
  if (value === null || value.trim() === '') return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? String(parsed) : undefined
}

function normalizePriceInput(value: string): number | undefined | null {
  if (value.trim() === '') return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
}

function ProductCard({ product }: { product: CatalogProduct }) {
  return (
    <article className="flex min-w-0 flex-col overflow-hidden rounded-card border border-slate-100 bg-white shadow-glass transition hover:-translate-y-0.5 hover:shadow-lift">
      <div className="aspect-square bg-brand-mist">
        <img
          src={product.imageUrl || PLACEHOLDER_IMAGE}
          alt={product.name}
          loading="lazy"
          onError={(event) => {
            event.currentTarget.onerror = null
            event.currentTarget.src = PLACEHOLDER_IMAGE
          }}
          className="h-full w-full object-contain p-3"
        />
      </div>
      <div className="flex flex-1 flex-col p-4">
        <h3 className="line-clamp-2 font-semibold leading-snug text-ink">{product.name}</h3>
        {product.sku ? <p className="mt-1 text-xs text-slate-500">SKU: {product.sku}</p> : null}
        <p className="mt-3 text-sm font-bold text-brand-blue">
          {product.priceFormatted || (product.price === null ? 'Contact us for pricing' : `$${product.price.toFixed(2)}`)}
        </p>
        <p className={`mt-1 text-xs ${product.inStock ? 'text-emerald-700' : 'text-slate-500'}`}>
          {product.inStock ? 'In stock' : 'Check availability'}
        </p>
        {product.productUrl ? (
          <a
            href={product.productUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-auto pt-4 text-sm font-semibold text-brand-blue underline decoration-brand-blue/30 underline-offset-4 hover:text-brand-blue-dark"
          >
            View and order
          </a>
        ) : null}
      </div>
    </article>
  )
}
