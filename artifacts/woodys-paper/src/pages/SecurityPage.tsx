import { UserProfile } from '@clerk/react'
import Link from '@/lib/navigation'

const basePath = import.meta.env.BASE_URL.replace(/\/$/, '')

export default function SecurityPage() {
  return (
    <section className="mx-auto max-w-5xl px-4 py-12">
      <Link href="/account" className="text-sm font-semibold text-brand-blue hover:text-brand-blue-dark" data-testid="link-back-account">
        &larr; Back to account
      </Link>
      <h1 className="mt-4 text-4xl font-black text-ink">Profile &amp; security</h1>
      <p className="mt-2 max-w-2xl text-slate-600">
        Update your name, email addresses and password for your Woody&rsquo;s Paper website account. This does not change your Lightspeed checkout sign-in.
      </p>
      <div className="mt-8 flex justify-center">
        <UserProfile routing="path" path={`${basePath}/account/security`} />
      </div>
    </section>
  )
}
