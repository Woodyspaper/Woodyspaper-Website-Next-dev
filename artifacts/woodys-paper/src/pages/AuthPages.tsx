import type { ReactNode } from 'react'
import { SignIn, SignUp } from '@clerk/react'

const basePath = import.meta.env.BASE_URL.replace(/\/$/, '')

function AuthShell({ eyebrow, title, children }: { eyebrow: string; title: string; children: ReactNode }) {
  return (
    <section className="mx-auto grid min-h-[70dvh] max-w-6xl items-center gap-12 px-4 py-14 lg:grid-cols-[1fr_auto]">
      <div className="max-w-md">
        <p className="text-3xs font-bold uppercase tracking-mega text-brand-blue">{eyebrow}</p>
        <h1 className="mt-4 text-4xl font-black leading-hero text-ink sm:text-5xl">{title}</h1>
        <ul className="mt-8 space-y-4 text-slate-600">
          <li className="border-l-2 border-brand-blue pl-4">One Woody&rsquo;s Paper identity that stays the same even if our inventory system changes.</li>
          <li className="border-l-2 border-brand-sky pl-4">Forgot your password? Choose &ldquo;Forgot password&rdquo; on the sign-in form to reset it by email.</li>
          <li className="border-l-2 border-brand-sky pl-4">Lightspeed checkout passwords are not carried over. Checkout keeps its own separate sign-in.</li>
        </ul>
      </div>
      <div className="w-full">{children}</div>
    </section>
  )
}

export function SignInPage() {
  return (
    <AuthShell eyebrow="Website account" title="Welcome back.">
      <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} />
    </AuthShell>
  )
}

export function SignUpPage() {
  return (
    <AuthShell eyebrow="New website account" title="Your account, built to last.">
      <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} />
    </AuthShell>
  )
}
