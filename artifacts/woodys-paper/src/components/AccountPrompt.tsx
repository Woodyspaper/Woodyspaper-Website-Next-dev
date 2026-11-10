'use client'

import { Show } from '@clerk/react'
import Link from '@/lib/navigation'

const linkClasses =
  'font-semibold text-brand-blue underline decoration-brand-blue/30 underline-offset-4 transition-colors hover:text-brand-blue-dark hover:decoration-brand-blue'

/**
 * One line under the Inventory Hub heading inviting visitors to sign in to,
 * or create, their Woody's Paper website account. Hidden once signed in.
 */
export function AccountPrompt() {
  return (
    <Show when="signed-out">
      <p className="mx-auto mt-5 max-w-xl text-base text-slate-600">
        Already a customer?{' '}
        <Link href="/sign-in" className={linkClasses} data-testid="link-prompt-sign-in">
          Sign in
        </Link>{' '}
        to your Woody&rsquo;s Paper account for pricing benefits and order history. New here?{' '}
        <Link href="/sign-up" className={linkClasses} data-testid="link-prompt-sign-up">
          Create an account
        </Link>
        . The catalog stays open to everyone.
      </p>
    </Show>
  )
}
