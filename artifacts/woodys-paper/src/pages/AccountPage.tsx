import { useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useClerk } from '@clerk/react'
import {
  getGetAccountOrdersQueryKey,
  getGetAccountPricingQueryKey,
  getGetAccountQueryKey,
  useGetAccount,
  useGetAccountOrders,
  useGetAccountPricing,
  useUnlinkProviderAccount,
  type AccountPricingOffer,
  type ProviderAccountLink,
  type WoodyAccount,
} from '@workspace/api-client-react'
import Link from '@/lib/navigation'
import { serverMessage } from '@/lib/apiError'
import { LightspeedLinkForm } from '@/components/LightspeedLinkForm'

const basePath = import.meta.env.BASE_URL.replace(/\/$/, '')
const PAGE_SIZE = 10

const btn =
  'inline-flex items-center justify-center rounded-full px-5 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-blue disabled:cursor-not-allowed disabled:opacity-50 active:scale-95'
const btnPrimary = `${btn} bg-brand-blue text-white shadow-cta hover:bg-brand-blue-dark`
const btnGhost = `${btn} border border-brand-blue/30 bg-white text-brand-blue hover:bg-brand-mist`
const btnDanger = `${btn} border border-red-300 bg-white text-red-800 hover:bg-red-50`

const amount = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const date = (s: string) => {
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? s : d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

function Panel({ title, kicker, children, id }: { title: string; kicker: string; children: ReactNode; id?: string }) {
  return (
    <section id={id} aria-labelledby={`${id ?? title}-h`} className="rounded-card border border-white/70 bg-white/85 p-6 shadow-glass backdrop-blur sm:p-8">
      <p className="text-3xs font-bold uppercase tracking-ultra text-brand-blue">{kicker}</p>
      <h2 id={`${id ?? title}-h`} className="mt-1 text-2xl font-bold text-ink">{title}</h2>
      <div className="mt-5">{children}</div>
    </section>
  )
}

function Skeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div aria-busy="true" aria-label="Loading" className="space-y-3">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="h-5 animate-pulse rounded-full bg-brand-mist" style={{ width: `${88 - i * 14}%` }} />
      ))}
    </div>
  )
}

function ErrorBox({ message, onRetry, testId }: { message: string; onRetry?: () => void; testId: string }) {
  return (
    <div role="alert" className="rounded-2xl border border-red-200 bg-red-50/70 p-4 text-sm text-red-900" data-testid={testId}>
      <p>{message}</p>
      {onRetry ? (
        <button type="button" onClick={onRetry} className={`${btnGhost} mt-3`} data-testid={`button-retry-${testId}`}>
          Try again
        </button>
      ) : null}
    </div>
  )
}

function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-2xl border border-dashed border-brand-blue/25 bg-brand-mist/50 p-6 text-center text-sm text-slate-600">{children}</div>
}

export default function AccountPage() {
  const { signOut } = useClerk()
  const account = useGetAccount()

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-3xs font-bold uppercase tracking-mega text-brand-blue">Woody&rsquo;s Paper account</p>
          <h1 className="mt-2 text-4xl font-black leading-hero text-ink sm:text-5xl">
            {account.data ? `Hello, ${account.data.displayName || 'there'}.` : 'Your account'}
          </h1>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href="/inventory" className={btnGhost} data-testid="link-browse-catalog">Browse catalog</Link>
          <Link href="/account/security" className={btnGhost} data-testid="link-security">Profile &amp; security</Link>
          <button type="button" className={btnGhost} onClick={() => signOut({ redirectUrl: basePath || '/' })} data-testid="button-sign-out">
            Sign out
          </button>
        </div>
      </div>

      <div className="mt-10">
        {account.isLoading ? (
          <Panel kicker="Website identity" title="Loading your account"><Skeleton rows={4} /></Panel>
        ) : account.isError ? (
          <ErrorBox testId="account-error" message={`We couldn't load your website account. ${serverMessage(account.error)}`} onRetry={() => account.refetch()} />
        ) : account.data ? (
          <AccountBody account={account.data} />
        ) : null}
      </div>
    </div>
  )
}

function AccountBody({ account }: { account: WoodyAccount }) {
  const activeLink = account.links.find(
    (l) => l.provider.toLowerCase() === 'lightspeed' && account.activeLightspeedStoreId !== null && l.storeId === account.activeLightspeedStoreId,
  )
  const [offset, setOffset] = useState(0)

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <div className="space-y-6">
        <Panel kicker="Permanent" title="Website identity" id="identity">
          <dl className="grid gap-4 text-sm">
            <Row label="Name" value={account.displayName || 'Not set'} testId="text-display-name" />
            <Row label="Email" value={account.email} testId="text-email" />
            <div>
              <dt className="font-semibold text-slate-500">Email status</dt>
              <dd className="mt-1" data-testid="status-email-verified">
                {account.emailVerified ? (
                  <span className="rounded-full bg-emerald-50 px-3 py-1 font-semibold text-emerald-800">Verified</span>
                ) : (
                  <span className="rounded-full bg-amber-50 px-3 py-1 font-semibold text-amber-900">Not verified</span>
                )}
              </dd>
            </div>
            <Row label="Account ID" value={account.id} mono testId="text-account-id" />
          </dl>
          <p className="mt-5 text-xs text-slate-500">This identity stays with you even if Woody&rsquo;s Paper changes inventory providers.</p>
        </Panel>
        <ProviderLinks account={account} onChanged={() => setOffset(0)} />
      </div>

      <div className="space-y-6">
        <Panel kicker="Lightspeed" title="Pricing & benefits" id="pricing">
          {activeLink ? <PricingBody key={activeLink.id} linkId={activeLink.id} /> : <Empty>Link your Lightspeed customer account to see your customer group and available promotions.</Empty>}
        </Panel>
        <Panel kicker="Lightspeed" title="Order history" id="orders">
          {activeLink ? <OrdersBody key={activeLink.id} linkId={activeLink.id} offset={offset} setOffset={setOffset} /> : <Empty>Order history appears here once your Lightspeed customer account is linked.</Empty>}
        </Panel>
      </div>
    </div>
  )
}

function Row({ label, value, mono, testId }: { label: string; value: string; mono?: boolean; testId: string }) {
  return (
    <div>
      <dt className="font-semibold text-slate-500">{label}</dt>
      <dd className={`mt-1 break-all text-ink ${mono ? 'font-mono text-xs' : 'text-base'}`} data-testid={testId}>{value}</dd>
    </div>
  )
}

function useInvalidateAccount() {
  const qc = useQueryClient()
  return () => {
    qc.invalidateQueries({ queryKey: getGetAccountQueryKey() })
    qc.invalidateQueries({ queryKey: getGetAccountPricingQueryKey() })
    qc.invalidateQueries({ queryKey: getGetAccountOrdersQueryKey() })
  }
}

function ProviderLinks({ account, onChanged }: { account: WoodyAccount; onChanged: () => void }) {
  const invalidate = useInvalidateAccount()
  const [confirming, setConfirming] = useState<ProviderAccountLink | null>(null)
  const unlink = useUnlinkProviderAccount({
    mutation: { onSuccess: () => { setConfirming(null); onChanged(); invalidate() } },
  })
  const hasLightspeed = account.links.some(
    (l) => l.provider.toLowerCase() === 'lightspeed' && l.storeId === account.activeLightspeedStoreId,
  )

  return (
    <Panel kicker="Inventory providers" title="Linked accounts" id="links">
      {account.links.length === 0 ? (
        <Empty>No provider accounts linked yet.</Empty>
      ) : (
        <ul className="space-y-3">
          {account.links.map((l) => (
            <li key={l.id} className="rounded-2xl border border-slate-200 bg-canvas p-4 text-sm" data-testid={`row-link-${l.id}`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold capitalize text-ink">{l.provider}</p>
                  <p className="text-slate-600">{l.linkedEmail}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    Store {l.storeId}
                    {l.storeId === account.activeLightspeedStoreId ? ' (current store)' : ''} &middot; linked {date(l.createdAt)}
                  </p>
                </div>
                {confirming?.id === l.id ? null : (
                  <button type="button" className={btnDanger} onClick={() => { unlink.reset(); setConfirming(l) }} data-testid={`button-unlink-${l.id}`}>
                    Unlink
                  </button>
                )}
              </div>
              {confirming?.id === l.id ? (
                <div role="alertdialog" aria-label="Confirm unlink" className="mt-4 rounded-xl border border-red-200 bg-red-50/60 p-4">
                  <p className="text-red-900">
                    Unlink this {l.provider} account? Your Woody&rsquo;s Paper website account stays active; only pricing and order history from this provider will stop showing.
                  </p>
                  {unlink.isError ? <p className="mt-2 font-semibold text-red-900" role="alert">{serverMessage(unlink.error)}</p> : null}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button type="button" className={btnDanger} disabled={unlink.isPending} onClick={() => unlink.mutate({ linkId: l.id })} data-testid={`button-confirm-unlink-${l.id}`}>
                      {unlink.isPending ? 'Unlinking...' : 'Yes, unlink'}
                    </button>
                    <button type="button" className={btnGhost} disabled={unlink.isPending} onClick={() => setConfirming(null)} data-testid="button-cancel-unlink">
                      Cancel
                    </button>
                  </div>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {!hasLightspeed ? (
        <div className="mt-6 rounded-2xl bg-brand-mist p-5 text-sm">
          <h3 className="font-sans text-base font-bold text-ink">Link your Lightspeed customer account</h3>
          {account.emailVerified ? (
            <LightspeedLinkForm initialEmail={account.email} onLinked={() => { onChanged(); invalidate() }} />
          ) : (
            <p className="mt-2 text-slate-700">
              Verify your email first. Go to <Link href="/account/security" className="font-semibold text-brand-blue underline">Profile &amp; security</Link> to finish verification.
            </p>
          )}
        </div>
      ) : null}
    </Panel>
  )
}

function offerLabel(o: AccountPricingOffer) {
  const t = o.discountType.toLowerCase()
  const value = t.includes('percent') ? `${o.amount}% off` : `${amount(o.amount)} off (store currency)`
  return value
}

function PricingBody({ linkId }: { linkId: string }) {
  const pricing = useGetAccountPricing({ query: { queryKey: [...getGetAccountPricingQueryKey(), linkId] } })
  if (pricing.isLoading) return <Skeleton rows={4} />
  if (pricing.isError)
    return <ErrorBox testId="pricing-error" message={`Lightspeed pricing is unavailable right now. Your website account is fine. ${serverMessage(pricing.error)}`} onRetry={() => pricing.refetch()} />
  const p = pricing.data
  if (!p) return null
  return (
    <div className="space-y-5 text-sm">
      <div className="flex flex-wrap gap-3">
        <span className="rounded-full bg-brand-mist px-4 py-1.5 font-semibold text-brand-blue-dark" data-testid="text-group-name">Group: {p.groupName || 'None'}</span>
        <span className="rounded-full bg-brand-mist px-4 py-1.5 font-semibold text-brand-blue-dark" data-testid="status-tax-exempt">{p.taxExempt ? 'Tax exempt' : 'Not tax exempt'}</span>
      </div>
      {p.offers.length === 0 ? (
        <Empty>No promotions are currently available for your customer group.</Empty>
      ) : (
        <ul className="divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-canvas">
          {p.offers.map((o, i) => (
            <li key={`${o.name}-${i}`} className="p-4" data-testid={`row-offer-${i}`}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-semibold text-ink">{o.name}</p>
                <p className="font-semibold text-brand-blue">{offerLabel(o)}</p>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Applies to {o.appliesTo}
                {o.minimumSubtotal !== null ? ` · minimum subtotal ${amount(o.minimumSubtotal)} (store currency)` : ''}
                {o.conditional ? ' · conditions apply' : ''}
              </p>
            </li>
          ))}
        </ul>
      )}
      {p.note ? <p className="text-slate-600" data-testid="text-pricing-note">{p.note}</p> : null}
      <p className="rounded-xl border-l-4 border-brand-blue bg-brand-mist/60 p-3 text-slate-700">
        These are promotions that may apply, not guaranteed prices. Catalog prices stay public, and final pricing and discounts are checked at Lightspeed checkout, which has its own separate sign-in.
      </p>
    </div>
  )
}

function OrdersBody({ linkId, offset, setOffset }: { linkId: string; offset: number; setOffset: (n: number) => void }) {
  const params = { limit: PAGE_SIZE, offset }
  const orders = useGetAccountOrders(params, { query: { queryKey: [...getGetAccountOrdersQueryKey(params), linkId] } })
  if (orders.isLoading) return <Skeleton rows={5} />
  if (orders.isError)
    return <ErrorBox testId="orders-error" message={`Order history from Lightspeed is unavailable right now. Your website account is fine. ${serverMessage(orders.error)}`} onRetry={() => orders.refetch()} />
  const page = orders.data
  if (!page) return null
  if (page.items.length === 0) return (
    <Empty>
      <p>{offset > 0 ? 'No more orders.' : 'No orders yet for your linked Lightspeed account.'}</p>
      {offset > 0 ? <button type="button" className={`${btnGhost} mt-3`} onClick={() => setOffset(0)}>Back to first page</button> : null}
    </Empty>
  )
  const end = Math.min(page.offset + page.items.length, page.total)
  return (
    <div className="text-sm">
      <p className="mb-3 text-xs text-slate-500">Amounts are shown in the store&rsquo;s currency.</p>
      <ul className="space-y-3">
        {page.items.map((o) => (
          <li key={o.id} className="rounded-2xl border border-slate-200 bg-canvas p-4" data-testid={`row-order-${o.id}`}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="font-semibold text-ink">Order {o.id}</p>
              <p className="font-mono font-semibold text-ink" data-testid={`text-order-total-${o.id}`}>{amount(o.total)}</p>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              {date(o.createdAt)} &middot; Payment: {o.paymentStatus} &middot; Fulfillment: {o.fulfillmentStatus}
            </p>
            {o.items.length ? (
              <ul className="mt-3 space-y-1 border-t border-slate-200 pt-3 text-slate-600">
                {o.items.map((it, i) => (
                  <li key={i} className="flex justify-between gap-3">
                    <span>{it.quantity} &times; {it.name}</span>
                    <span className="font-mono">{amount(it.unitPrice)} ea</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </li>
        ))}
      </ul>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-slate-500" aria-live="polite">{page.offset + 1}&ndash;{end} of {page.total}</p>
        <div className="flex gap-2">
          <button type="button" className={btnGhost} disabled={offset === 0 || orders.isFetching} onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))} data-testid="button-orders-prev">Previous</button>
          <button type="button" className={btnGhost} disabled={end >= page.total || orders.isFetching} onClick={() => setOffset(offset + PAGE_SIZE)} data-testid="button-orders-next">Next</button>
        </div>
      </div>
    </div>
  )
}
