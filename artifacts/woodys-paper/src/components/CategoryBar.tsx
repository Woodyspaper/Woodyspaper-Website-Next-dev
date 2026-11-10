import { useEffect, useState } from 'react'
import { useGetCatalogCategories } from '@workspace/api-client-react'
import Link from '@/lib/navigation'
import { usePathname, useSearchParams } from '@/lib/navigation'

const chip =
  'shrink-0 whitespace-nowrap rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-blue'

const titleCase = (name: string) =>
  name === name.toUpperCase() ? name.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase()) : name

/** Secondary bar: quick category links, plus a full panel for the long list. */
export function CategoryBar() {
  const { data, isLoading, isError, refetch } = useGetCatalogCategories({ query: { staleTime: 10 * 60 * 1000 } })
  const pathname = usePathname()
  const params = useSearchParams()
  const onInventory = pathname === '/inventory'
  const active = onInventory ? params.get('filter.category') : null
  const allActive = onInventory && !active && !params.get('q')
  const [open, setOpen] = useState(false)

  const [lastPath, setLastPath] = useState(pathname + params.toString())
  if (lastPath !== pathname + params.toString()) {
    setLastPath(pathname + params.toString())
    setOpen(false)
  }

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    const onDown = (e: PointerEvent) => {
      if (!(e.target as Element).closest('[data-category-bar]')) setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onDown)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onDown)
    }
  }, [open])

  const categories = data ?? []
  const href = (id: number) => `/inventory?filter.category=${id}`

  return (
    <nav
      aria-label="Product categories"
      data-category-bar
      className="fixed inset-x-0 top-catbar-top z-40 h-catbar border-b border-slate-200/80 bg-brand-mist/95 backdrop-blur-lg lg:top-catbar-top-lg"
    >
      <div className="mx-auto flex h-full max-w-7xl items-center gap-2 px-4">
        <Link
          href="/inventory"
          aria-current={allActive ? 'page' : undefined}
          data-testid="link-category-all"
          className={`${chip} ${allActive ? 'bg-brand-blue text-white' : 'bg-white text-brand-blue ring-1 ring-brand-blue/20 hover:bg-white/70'}`}
        >
          All products
        </Link>
        <span aria-hidden="true" className="h-5 w-px shrink-0 bg-brand-blue/15" />

        <div className="relative min-w-0 flex-1 overflow-hidden">
          <ul className="flex items-center gap-1 overflow-x-auto py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [mask-image:linear-gradient(to_right,black_92%,transparent)]">
            {isLoading
              ? [88, 120, 72, 104, 96, 132, 80].map((w, i) => (
                  <li key={i} aria-hidden="true" className="h-6 shrink-0 animate-pulse rounded-full bg-brand-blue/10" style={{ width: w }} />
                ))
              : isError
                ? (
                    <li className="flex items-center gap-2 text-[13px] text-slate-500">
                      Categories unavailable.
                      <button type="button" onClick={() => refetch()} className="font-semibold text-brand-blue underline underline-offset-2 hover:text-brand-blue-dark">
                        Retry
                      </button>
                    </li>
                  )
                : categories.map((c) => {
                    const isActive = active === String(c.id)
                    return (
                      <li key={c.id}>
                        <Link
                          href={href(c.id)}
                          aria-current={isActive ? 'page' : undefined}
                          data-testid={`link-category-${c.id}`}
                          className={`${chip} block ${isActive ? 'bg-brand-blue text-white' : 'text-slate-600 hover:bg-white hover:text-brand-blue'}`}
                        >
                          {titleCase(c.name)}
                        </Link>
                      </li>
                    )
                  })}
          </ul>
        </div>

        {categories.length > 0 ? (
          <button
            type="button"
            aria-expanded={open}
            aria-controls="category-panel"
            onClick={() => setOpen((o) => !o)}
            data-testid="button-all-categories"
            className={`${chip} flex items-center gap-1.5 ${open ? 'bg-brand-blue text-white' : 'bg-white text-brand-blue ring-1 ring-brand-blue/20 hover:bg-white/70'}`}
          >
            <span className="hidden sm:inline">All categories</span>
            <span className="sm:hidden">More</span>
            <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" className={`size-3.5 transition-transform ${open ? 'rotate-180' : ''}`}>
              <path d="M5.3 7.3a1 1 0 011.4 0L10 10.6l3.3-3.3a1 1 0 111.4 1.4l-4 4a1 1 0 01-1.4 0l-4-4a1 1 0 010-1.4z" />
            </svg>
          </button>
        ) : null}
      </div>

      <div
        id="category-panel"
        hidden={!open}
        className="absolute inset-x-0 top-full max-h-[60dvh] overflow-y-auto border-b border-slate-200 bg-white/98 shadow-lift backdrop-blur-xl"
      >
        <div className="mx-auto max-w-7xl px-4 py-6">
          <p className="mb-4 text-xs font-bold uppercase tracking-ultra text-slate-400">
            Browse {categories.length} categories
          </p>
          <ul className="grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {categories.map((c) => {
              const isActive = active === String(c.id)
              return (
                <li key={c.id}>
                  <Link
                    href={href(c.id)}
                    aria-current={isActive ? 'page' : undefined}
                    className={`block rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-brand-mist hover:text-brand-blue ${isActive ? 'bg-brand-mist text-brand-blue' : 'text-slate-700'}`}
                  >
                    {titleCase(c.name)}
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      </div>
    </nav>
  )
}
