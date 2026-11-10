import { useEffect, useState, type FormEvent } from 'react'
import { useGetCatalogProducts } from '@workspace/api-client-react'
import type { CatalogProduct } from '@workspace/api-client-react'
import { useRouter } from '@/lib/navigation'

const PAGE_SIZE = 24
const PLACEHOLDER_IMAGE = '/product-placeholder.webp'

type CatalogProductsProps = {
  initialQuery?: string
  hubPath?: string
}

export function CatalogProducts({ initialQuery = '', hubPath }: CatalogProductsProps) {
  const router = useRouter()
  const [search, setSearch] = useState(initialQuery)
  const [submittedQuery, setSubmittedQuery] = useState(initialQuery)
  const [offset, setOffset] = useState(0)

  useEffect(() => {
    setSearch(initialQuery)
    setSubmittedQuery(initialQuery)
    setOffset(0)
  }, [initialQuery])

  const { data, error, isLoading, isFetching } = useGetCatalogProducts(
    { q: submittedQuery || undefined, limit: PAGE_SIZE, offset },
    { query: { staleTime: 30_000 } },
  )

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const query = search.trim().slice(0, 100)
    setOffset(0)
    setSubmittedQuery(query)

    if (hubPath) {
      router.push(`${hubPath}${query ? `?q=${encodeURIComponent(query)}` : ''}`)
    } else {
      router.replace(`${window.location.pathname}${query ? `?q=${encodeURIComponent(query)}` : ''}`)
    }
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

      {isLoading ? (
        <p className="py-12 text-center text-slate-600" role="status">Loading products…</p>
      ) : error ? (
        <div className="rounded-panel border border-brand-blue/20 bg-white p-8 text-center shadow-glass" role="alert">
          <h3 className="text-xl font-semibold text-ink">Inventory is temporarily unavailable</h3>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-slate-600">{errorMessage}</p>
        </div>
      ) : !data?.items.length ? (
        <p className="rounded-panel border border-slate-200 bg-white p-10 text-center text-slate-600">
          {submittedQuery ? `No products found for “${submittedQuery}”.` : 'No products are available right now.'}
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
          <nav aria-label="Product pages" className="flex items-center justify-center gap-4">
            <button
              type="button"
              disabled={!hasPrevious || isFetching}
              onClick={() => setOffset(Math.max(0, currentOffset - PAGE_SIZE))}
              className="rounded-full border border-brand-blue/30 px-5 py-2.5 font-semibold text-brand-blue transition hover:bg-brand-mist disabled:cursor-not-allowed disabled:opacity-40"
            >
              Previous
            </button>
            <span className="text-sm text-slate-600">
              Page {Math.floor(currentOffset / PAGE_SIZE) + 1}
            </span>
            <button
              type="button"
              disabled={!hasNext || isFetching}
              onClick={() => setOffset(currentOffset + PAGE_SIZE)}
              className="rounded-full border border-brand-blue/30 px-5 py-2.5 font-semibold text-brand-blue transition hover:bg-brand-mist disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next
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
