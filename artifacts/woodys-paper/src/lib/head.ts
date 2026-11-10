import { useEffect } from 'react'

const SITE_URL = 'https://woodyspaper.com'

/** Sets the document title and canonical link (the only head tags React manages). */
export function usePageHead(title: string, canonicalPath: string) {
  useEffect(() => {
    document.title = title
    let link = document.querySelector<HTMLLinkElement>('link[rel="canonical"]')
    if (!link) {
      link = document.createElement('link')
      link.rel = 'canonical'
      document.head.appendChild(link)
    }
    link.href = new URL(canonicalPath, SITE_URL).toString()
  }, [title, canonicalPath])
}
