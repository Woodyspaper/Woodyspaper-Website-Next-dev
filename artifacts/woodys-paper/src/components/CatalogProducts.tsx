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
  const submittedQuery = params.get('q') || initialQuery
  const rawOffset = Number(params.get('offset') || 0)
  const offset = Number.isSafeInteger(rawOffset) && rawOffset >= 0 ? rawOffset : 0
  const filters = Object.fromEntries([...params.entries()]
    .filter(([key, value]) => key.startsWith('filter.') && value)
    .map(([key, value]) => [key.slice(7), value]))
  const [search, setSearch] = useState(submittedQuery)

  useEffect(() => {
    setSearch(submittedQuery)
  }, [submittedQuery])

  const navigate = (query: string, selected: Record<string, string>, nextOffset = 0) => {
    const next = new URLSearchParams()
    if (query) next.set('q', query)
    for (const [key, value] of Object.entries(selected)) if (value) next.set(`filter.${key}`, value)
    if (nextOffset) next.set('offset', String(nextOffset))
    const path = hubPath || window.location.pathname
    router.push(`${path}${next.size ? `?${next}` : ''}`)
  }

  const { data, error, isLoading, isFetching } = useGetCatalogProducts(
    { q: submittedQuery || undefined, filters: Object.keys(filters).length ? JSON.stringify(filters) : undefined, limit: PAGE_SIZE, offset },
    { query: { staleTime: 30_000 } },
  )

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const query = search.trim().slice(0, 100)
    navigate(query, filters)
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
  const currentOffset = data?.offset ?? offset
  const pageSize = data?.limit ?? PAGE_SIZE
  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / pageSize))
  const lastOffset = (totalPages - 1) * pageSize
  const hasPrevious = currentOffset > 0
  const hasNext = Boolean(data && currentOffset + data.limit < data.total)

  return (
    <div className="space-y-8">
      <form onSubmit={submitSearch} className="mx-auto flex max-w-3xl gap-3">
        <label className="sr-only" htmlFor="catalog-search">Search products</label>
        <input
          id="catalog-search"
          type="search"
          maxLength={100}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by product name or SKU"
          className="min-w-0 flex-1 rounded-full border border-slate-200 bg-white px-5 py-3 text-ink shadow-sm outline-none transition focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20"
        />
        <button
          type="submit"
          className="shrink-0 rounded-full bg-brand-blue px-6 py-3 font-semibold text-white shadow-cta transition hover:bg-brand-blue-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-blue"
        >
          Search
        </button>
      </form>

      <section aria-label="Product filters" className="rounded-panel border border-slate-200 bg-white p-5 shadow-glass">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-semibold text-ink">Filter products</h3>
          {Object.keys(filters).length > 0 ? (
            <button type="button" onClick={() => navigate(submittedQuery, {})}
              className="text-sm font-semibold text-brand-blue underline underline-offset-4">Clear all filters</button>
          ) : null}
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data && !data.facets?.some(facet => facet.key === 'size') ? (
            <label className="flex min-w-0 flex-col gap-1.5 text-sm font-semibold text-slate-500">
              Size
              <select aria-label="Size" disabled className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 font-normal">
                <option>No size data for these products</option>
              </select>
            </label>
          ) : null}
          {(data?.facets || []).map(facet => (
            <label key={facet.key} className="flex min-w-0 flex-col gap-1.5 text-sm font-semibold text-ink">
              {facet.label}
              <select aria-label={facet.label} value={filters[facet.key] || ''}
                onChange={event => {
                  const selected = { ...filters }
                  if (event.target.value) selected[facet.key] = event.target.value
                  else delete selected[facet.key]
                  navigate(submittedQuery, selected)
                }}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 font-normal outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20">
                <option value="">All {facet.label.toLowerCase()}</option>
                {facet.options.map(option => (
                  <option key={option.value} value={option.value}>{option.label} ({option.count})</option>
                ))}
              </select>
            </label>
          ))}
        </div>
        {isFetching ? <p role="status" className="mt-3 text-sm text-slate-500">Updating filters and products…</p> : null}
        {!isFetching && !error && !data?.facets?.length ? <p className="text-sm text-slate-500">No filter values are available for this search.</p> : null}
        {Object.keys(filters).length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {Object.entries(filters).map(([key, value]) => {
              const facet = data?.facets?.find(f => f.key === key)
              const label = facet?.options.find(o => o.value === value)?.label || value
              return <button key={key} type="button" aria-label={`Remove ${facet?.label || key} filter`}
                onClick={() => { const selected = { ...filters }; delete selected[key]; navigate(submittedQuery, selected) }}
                className="rounded-full bg-brand-mist px-3 py-1.5 text-sm text-brand-blue">
                {facet?.label || key}: {label} <span aria-hidden="true">×</span>
              </button>
            })}
          </div>
        ) : null}
      </section>

      {isLoading ? (
        <p className="py-12 text-center text-slate-600" role="status">Loading products…</p>
      ) : error ? (
        <div className="rounded-panel border border-brand-blue/20 bg-white p-8 text-center shadow-glass" role="alert">
          <h3 className="text-xl font-semibold text-ink">Inventory is temporarily unavailable</h3>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-slate-600">{errorMessage}</p>
        </div>
      ) : !data?.items.length ? (
        <p className="rounded-panel border border-slate-200 bg-white p-10 text-center text-slate-600">
          {Object.keys(filters).length ? 'No products match these filters. Remove a filter or clear all filters to try again.' : submittedQuery ? `No products found for “${submittedQuery}”.` : 'No products are available right now.'}
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
              onClick={() => navigate(submittedQuery, filters, Math.max(0, currentOffset - PAGE_SIZE))}
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
                onClick={() => navigate(submittedQuery, filters, 0)}
                className="rounded px-1 py-2 font-semibold text-brand-blue underline underline-offset-4 hover:text-brand-blue-dark focus-visible:outline-2 focus-visible:outline-brand-blue disabled:cursor-default disabled:no-underline"
              >{Math.floor(currentOffset / pageSize) + 1}</button>
              {' '}of{' '}
              <button
                type="button"
                aria-label="Last"
                title="Go to last page"
                disabled={!hasNext || isFetching}
                onClick={() => navigate(submittedQuery, filters, lastOffset)}
                className="rounded px-1 py-2 font-semibold text-brand-blue underline underline-offset-4 hover:text-brand-blue-dark focus-visible:outline-2 focus-visible:outline-brand-blue disabled:cursor-default disabled:no-underline"
              >{totalPages}</button>
            </span>
            <button
              type="button"
              aria-label="Next"
              title="Next page"
              disabled={!hasNext || isFetching}
              onClick={() => navigate(submittedQuery, filters, currentOffset + PAGE_SIZE)}
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
