import { useEffect } from 'react'
import { useRouter } from '@/lib/navigation'

/** Unknown URLs send visitors back to the home page. */
export default function NotFound() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/')
  }, [router])

  return <div className="min-h-screen" />
}
