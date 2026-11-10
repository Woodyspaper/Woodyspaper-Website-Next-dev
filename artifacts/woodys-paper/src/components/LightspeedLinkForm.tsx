import { useEffect, useState, type FormEvent } from 'react'
import { useReverification, useUser } from '@clerk/react'
import type { EmailAddressResource } from '@clerk/react/types'
import { useLinkLightspeedAccount } from '@workspace/api-client-react'
import { serverMessage } from '@/lib/apiError'

const normalize = (value: string) => value.trim().toLowerCase()
const button = 'inline-flex items-center justify-center rounded-full px-5 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-blue disabled:cursor-not-allowed disabled:opacity-50'
const primary = `${button} bg-brand-blue text-white hover:bg-brand-blue-dark`
const secondary = `${button} border border-brand-blue/30 bg-white text-brand-blue hover:bg-brand-mist`
const input = 'mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-ink focus-visible:outline-2 focus-visible:outline-brand-blue disabled:opacity-60'

function verificationError(error: unknown) {
  const errors = (error as { errors?: { code?: string; longMessage?: string; message?: string }[] } | null)?.errors
  if (errors?.[0]?.code === 'form_identifier_exists') return 'This email is already associated with another website account. Sign in to that account instead, or contact Woody’s Paper. Accounts are not merged automatically.'
  return errors?.[0]?.longMessage || errors?.[0]?.message || serverMessage(error, 'Email verification could not be completed. Please try again.')
}

export function LightspeedLinkForm({ initialEmail, onLinked }: { initialEmail: string; onLinked: () => void }) {
  const { user } = useUser()
  const [email, setEmail] = useState(initialEmail)
  const [consent, setConsent] = useState(false)
  const [address, setAddress] = useState<EmailAddressResource | null>(null)
  const [verifiedEmail, setVerifiedEmail] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [cooldown, setCooldown] = useState(0)
  const link = useLinkLightspeedAccount()
  const createEmail = useReverification(async (emailAddress: string) => {
    if (!user) throw new Error('Please sign in again before linking.')
    return user.createEmailAddress({ email: emailAddress })
  })
  const alreadyVerified = user?.emailAddresses.some(e => normalize(e.emailAddress) === normalize(email) && e.verification.status === 'verified')

  useEffect(() => {
    if (cooldown <= 0) return
    const timer = window.setTimeout(() => setCooldown(value => Math.max(0, value - 1)), 1000)
    return () => window.clearTimeout(timer)
  }, [cooldown])

  async function finish(selectedEmail: string) {
    // This is only a request: the backend independently rechecks Clerk ownership.
    await link.mutateAsync({ data: { email: normalize(selectedEmail) } })
    setCode('')
    onLinked()
  }

  async function start(event: FormEvent) {
    event.preventDefault()
    if (!user || busy || !consent) return
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const current = await user.reload()
      const selected = normalize(email)
      let candidate = current.emailAddresses.find(e => normalize(e.emailAddress) === selected)
      if (candidate?.verification.status === 'verified') {
        setVerifiedEmail(candidate.emailAddress)
        await finish(candidate.emailAddress)
        return
      }
      candidate ??= await createEmail(selected)
      if (!candidate) throw new Error('Adding the email was cancelled. Please try again.')
      // Keep the address on a send failure so resend can retry without creating duplicates.
      setAddress(candidate)
      await candidate.prepareVerification({ strategy: 'email_code' })
      setCooldown(30)
      setMessage('Verification code requested. Check your inbox and Spam folder; delivery can take a few minutes.')
    } catch (e) { setError(verificationError(e)) }
    finally { setBusy(false) }
  }

  async function verify(event: FormEvent) {
    event.preventDefault()
    if (!address || !user || busy || !consent) return
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const result = await address.attemptVerification({ code: code.trim() })
      if (result.verification.status !== 'verified') throw new Error('The email is not verified yet. Check the code and try again.')
      setCode('')
      setVerifiedEmail(result.emailAddress)
      await user.reload()
      await finish(result.emailAddress)
    } catch (e) { setError(verificationError(e)) }
    finally { setBusy(false) }
  }

  async function resend() {
    if (!address || busy || cooldown > 0) return
    setBusy(true)
    setError('')
    setMessage('')
    try {
      await address.prepareVerification({ strategy: 'email_code' })
      setCode('')
      setCooldown(30)
      setMessage('A new code was requested. Enter the most recent code from your email.')
    } catch (e) { setError(verificationError(e)) }
    finally { setBusy(false) }
  }

  async function retryLink() {
    if (!verifiedEmail || busy || !consent) return
    setBusy(true)
    setError('')
    try { await finish(verifiedEmail) }
    catch (e) { setError(verificationError(e)) }
    finally { setBusy(false) }
  }

  function changeEmail() {
    setAddress(null)
    setVerifiedEmail(null)
    setCode('')
    setError('')
    setMessage('')
    setConsent(false)
  }

  return (
    <div className="mt-3" data-testid="lightspeed-link-form">
      <p className="text-slate-700">Enter the email on your Lightspeed customer account. If it is not already verified on this website account, we’ll send it a verification code before linking.</p>
      <p className="mt-2 text-xs text-slate-600">A new address is also added to your website account and, once verified, can be used to sign in. Your primary email stays unchanged. Unlinking Lightspeed does not remove the email; manage it in Profile &amp; security.</p>

      {!address && !verifiedEmail ? (
        <form onSubmit={start} className="mt-4">
          <label htmlFor="lightspeed-email" className="font-semibold text-ink">Lightspeed account email</label>
          <input id="lightspeed-email" type="email" autoComplete="email" required maxLength={254} value={email} disabled={busy} onChange={e => { setEmail(e.target.value); setConsent(false); setError('') }} className={input} data-testid="input-lightspeed-email" />
          {alreadyVerified ? <p className="mt-2 text-xs text-emerald-800">This email is already verified on your website account. No additional code is needed.</p> : null}
          <label className="mt-4 flex items-start gap-3 text-slate-700">
            <input type="checkbox" checked={consent} disabled={busy} onChange={e => setConsent(e.target.checked)} className="mt-1 size-4 accent-brand-blue" data-testid="checkbox-link-consent" />
            <span>I agree to verify this email, add it to my website account if needed, and link my Lightspeed customer record.</span>
          </label>
          <button type="submit" className={`${primary} mt-4`} disabled={!consent || !user || busy} data-testid="button-link-lightspeed">{busy ? 'Please wait…' : alreadyVerified ? 'Link verified email' : 'Send verification code'}</button>
        </form>
      ) : verifiedEmail ? (
        <div className="mt-4">
          <p className="break-words text-emerald-800">Verified: <strong>{verifiedEmail}</strong></p>
          <p className="mt-2 text-slate-700">Your email is verified. Linking completes only when a matching Lightspeed customer is found.</p>
          <button type="button" onClick={retryLink} disabled={busy} className={`${primary} mt-4`} data-testid="button-retry-link">{busy ? 'Linking…' : 'Retry linking'}</button>
        </div>
      ) : (
        <form onSubmit={verify} className="mt-4">
          <p className="break-words text-slate-700">Verify <strong>{address?.emailAddress}</strong></p>
          <label htmlFor="lightspeed-code" className="mt-4 block font-semibold text-ink">Verification code</label>
          <input id="lightspeed-code" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" required minLength={6} maxLength={6} value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} disabled={busy} className={`${input} font-mono tracking-widest`} data-testid="input-lightspeed-code" />
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="submit" disabled={busy || code.length !== 6} className={primary} data-testid="button-verify-link">{busy ? 'Please wait…' : 'Verify & link account'}</button>
            <button type="button" onClick={resend} disabled={busy || cooldown > 0} className={secondary} data-testid="button-resend-link-code">{cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}</button>
          </div>
        </form>
      )}
      {(address || verifiedEmail) ? <button type="button" onClick={changeEmail} disabled={busy} className="mt-3 text-sm font-semibold text-brand-blue underline disabled:opacity-50" data-testid="button-change-link-email">Use a different email</button> : null}
      {message ? <p role="status" className="mt-3 text-slate-700">{message}</p> : null}
      {error ? <p role="alert" className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-red-900" data-testid="link-error">{error}</p> : null}
    </div>
  )
}
