import { Suspense } from 'react'
import { InventoryContent } from '@/components/InventoryContent'
import { usePageHead } from '@/lib/head'

// No description / Open Graph tags here: the Lightspeed store manages those on this page.
export default function InventoryPage() {
  usePageHead("Inventory Hub | Woody's Paper", '/inventory')
  // The ?q= search is only known in the browser, so the hub renders client-side.
  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <InventoryContent />
    </Suspense>
  )
}
