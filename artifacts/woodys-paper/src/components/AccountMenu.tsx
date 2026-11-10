import { useState } from 'react'
import { useClerk } from '@clerk/react'
import { ChevronDown, LogOut, Settings, UserRound } from 'lucide-react'
import Link, { usePathname } from '@/lib/navigation'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

const itemClass = 'cursor-pointer rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 focus:bg-brand-mist focus:text-brand-blue'
const home = import.meta.env.BASE_URL

export function AccountMenu({ label, email, onNavigate, mobile = false }: {
  label: string
  email?: string
  onNavigate?: () => void
  mobile?: boolean
}) {
  const { signOut } = useClerk()
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [openedPath, setOpenedPath] = useState(pathname)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  // Back/forward or navigation elsewhere must not leave the menu open.
  if (openedPath !== pathname) {
    setOpenedPath(pathname)
    setOpen(false)
  }

  function navigate() {
    setOpen(false)
    onNavigate?.()
  }

  async function logout() {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      await signOut({ redirectUrl: home })
      navigate()
    } catch {
      setError('Could not log out. Please try again.')
    } finally { setBusy(false) }
  }

  return (
    <DropdownMenu open={open} onOpenChange={value => { setOpen(value); if (value) setError('') }} modal={false}>
      <DropdownMenuTrigger asChild>
        <button type="button" aria-label="Account menu" data-testid={mobile ? 'button-mobile-account-menu' : 'button-header-account-menu'} className="group inline-flex max-w-48 items-center justify-center gap-2 rounded-full px-3 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-brand-mist hover:text-brand-blue focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-blue data-[state=open]:bg-brand-mist data-[state=open]:text-brand-blue">
          <UserRound className="size-4 shrink-0 text-brand-blue" aria-hidden="true" />
          <span className="truncate">{label}</span>
          <ChevronDown className="size-3.5 shrink-0 transition-transform group-data-[state=open]:rotate-180" aria-hidden="true" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={mobile ? 'center' : 'end'} sideOffset={10} collisionPadding={16} className="z-[80] w-64 max-w-[calc(100vw-2rem)] rounded-2xl border-slate-200 bg-white p-2 text-slate-700 shadow-xl" aria-label="Account shortcuts">
        <DropdownMenuLabel className="px-3 py-2">
          <p className="text-sm font-semibold text-ink">Woody&rsquo;s Paper account</p>
          {email ? <p className="mt-1 truncate text-xs font-normal text-slate-500" title={email}>{email}</p> : null}
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="mx-1 bg-slate-100" />
        <DropdownMenuItem asChild className={itemClass}>
          <Link href="/account" onClick={navigate}><UserRound aria-hidden="true" />My account</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className={itemClass}>
          <Link href="/account/security" onClick={navigate}><Settings aria-hidden="true" />Profile &amp; settings</Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator className="mx-1 bg-slate-100" />
        <DropdownMenuItem disabled={busy} onSelect={event => { event.preventDefault(); void logout() }} className="cursor-pointer rounded-lg px-3 py-2.5 text-sm font-medium text-red-700 focus:bg-red-50 focus:text-red-800" data-testid="button-menu-logout">
          <LogOut aria-hidden="true" />{busy ? 'Logging out…' : 'Log out'}
        </DropdownMenuItem>
        {error ? <p role="alert" className="px-3 py-2 text-xs text-red-700">{error}</p> : null}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
