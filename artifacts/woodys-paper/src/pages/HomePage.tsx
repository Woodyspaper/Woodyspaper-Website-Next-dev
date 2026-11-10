import { Suspense } from 'react'
import { HeroSection } from '@/components/HeroSection'
import { InquirySection } from '@/components/InquirySection'
import { InventoryContent } from '@/components/InventoryContent'
import { usePageHead } from '@/lib/head'

/*
 * Description / Open Graph / Twitter tags are NOT set here. The Lightspeed
 * store on this page rewrites and deletes those tags, and React crashes on the
 * next navigation if it owns them. They are written statically into index.html
 * instead, where search engines and link previews read them.
 */
export default function HomePage() {
  usePageHead("Woody's Paper | Wholesale Packaging & Tissue Paper South Florida", '/')
  return (
    <>
      <HeroSection />
      {/* The store's front page; clicking or searching in it opens /inventory. */}
      <Suspense fallback={<div className="min-h-screen" />}>
        <InventoryContent hubPath="/inventory" />
      </Suspense>
      <InquirySection />
    </>
  )
}
