import { forwardRef, type AnchorHTMLAttributes, type MouseEvent } from 'react'
import { useLocation, useSearch } from 'wouter'
import { navigate as wouterNavigate } from 'wouter/use-browser-location'

/** Path relative to the Vite base (BASE_URL), matching the router's base. */
const BASE = import.meta.env.BASE_URL.replace(/\/$/, '')
const withBase = (to: string) => (to.startsWith('/') ? BASE + to : to)

/** Scroll like Next's router did: to a #id target if it exists, otherwise to the top. */
function scrollAfterNavigate(to: string, previousPath: string) {
  const hashIndex = to.indexOf('#')
  const hash = hashIndex >= 0 ? to.slice(hashIndex + 1) : ''
  const pathOnly = (hashIndex >= 0 ? to.slice(0, hashIndex) : to).split('?')[0]
  requestAnimationFrame(() => {
    if (hash && !hash.startsWith('!')) {
      const el = document.getElementById(decodeURIComponent(hash))
      if (el) {
        el.scrollIntoView()
        return
      }
    }
    if (pathOnly && pathOnly !== previousPath) window.scrollTo(0, 0)
  })
}

function go(to: string, replace: boolean) {
  const previousPath = window.location.pathname
  wouterNavigate(withBase(to), { replace })
  scrollAfterNavigate(withBase(to), previousPath)
}

export function useRouter() {
  return ROUTER
}
const ROUTER = {
  push: (to: string) => go(to, false),
  replace: (to: string) => go(to, true),
}

export function usePathname() {
  const [location] = useLocation()
  return location
}

export function useSearchParams() {
  const search = useSearch()
  return new URLSearchParams(search)
}

type LinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }

/** Drop-in replacement for next/link: client-side navigation with query/hash preserved. */
export const Link = forwardRef<HTMLAnchorElement, LinkProps>(function Link({ href, onClick, target, ...rest }, ref) {
  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event)
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      (target && target !== '_self') ||
      !href.startsWith('/')
    )
      return
    event.preventDefault()
    go(href, false)
  }
  return <a ref={ref} href={withBase(href)} target={target} onClick={handleClick} {...rest} />
})

export default Link
