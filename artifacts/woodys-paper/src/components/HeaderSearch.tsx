import { useState } from 'react'
import type { FormEvent } from 'react'
import { usePathname, useRouter, useSearchParams } from '@/lib/navigation'

/** Header product search. On /inventory it keeps filters and sort; elsewhere it starts fresh. */
export function HeaderSearch({ className = '' }: { className?: string }) {
  const pathname = usePathname()
  const params = useSearchParams()
  const router = useRouter()
  const onInventory = pathname === '/inventory'
  const urlQuery = onInventory ? params.get('q') ?? '' : ''
  const [value, setValue] = useState(urlQuery)
  const [syncedQuery, setSyncedQuery] = useState(urlQuery)
  if (syncedQuery !== urlQuery) {
    setSyncedQuery(urlQuery)
    setValue(urlQuery)
  }

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const q = value.trim()
    const next = onInventory ? new URLSearchParams(params) : new URLSearchParams()
    next.delete('offset')
    next.delete('account')
    if (q) next.set('q', q)
    else next.delete('q')
    const qs = next.toString()
    router.push(qs ? `/inventory?${qs}` : '/inventory')
  }

  return (
    <form role="search" aria-label="Header product search" onSubmit={submit} className={`group relative ${className}`}>
      <label htmlFor="header-search" className="sr-only">Search catalog</label>
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-brand-blue">
        <circle cx="8.5" cy="8.5" r="5.5" />
        <path d="M13 13l4 4" />
      </svg>
      <input
        id="header-search"
        type="search"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        maxLength={100}
        placeholder="Napkins, tissue, cups, SKU..."
        autoComplete="off"
        data-testid="input-header-search"
        className="h-11 w-full rounded-full border border-slate-200 bg-brand-mist/60 pl-11 pr-28 text-sm text-ink placeholder:text-slate-400 transition-colors focus:border-brand-blue/50 focus:bg-white focus:outline-none focus:ring-4 focus:ring-brand-blue/10 [&::-webkit-search-cancel-button]:hidden"
      />
      <button
        type="submit"
        aria-label="Search catalog"
        data-testid="button-header-search"
        className="absolute right-1 top-1/2 h-9 -translate-y-1/2 rounded-full bg-brand-blue px-5 text-sm font-semibold text-white transition-colors hover:bg-brand-blue-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-blue active:scale-95"
      >
        Search
      </button>
    </form>
  )
}
