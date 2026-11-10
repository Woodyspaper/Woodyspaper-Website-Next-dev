import { HeroSection } from '@/components/HeroSection'
import { InquirySection } from '@/components/InquirySection'
import { usePageHead } from '@/lib/head'

/*
 * Description / Open Graph / Twitter tags are NOT set here. The Lightspeed
 * store on the inventory page rewrites and deletes those tags, and React crashes on the
 * next navigation if it owns them. They are written statically into index.html
 * instead, where search engines and link previews read them.
 */
export default function HomePage() {
  usePageHead("Woody's Paper | Wholesale Packaging & Tissue Paper South Florida", '/')
  return (
    <>
      <HeroSection />
      <InquirySection />
    </>
  )
}
