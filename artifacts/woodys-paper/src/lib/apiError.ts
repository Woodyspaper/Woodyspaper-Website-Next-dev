/** Prefer the server's own message (e.g. provider denied) over the HTTP prefix. */
export function serverMessage(error: unknown, fallback = 'Something went wrong.'): string {
  if (error && typeof error === 'object') {
    const data = (error as { data?: unknown }).data
    if (data && typeof data === 'object') {
      for (const key of ['message', 'error', 'detail', 'title']) {
        const v = (data as Record<string, unknown>)[key]
        if (typeof v === 'string' && v.trim()) return v.trim()
      }
    }
    if (typeof data === 'string' && data.trim()) return data.trim()
    const msg = (error as { message?: unknown }).message
    if (typeof msg === 'string' && msg) return msg
  }
  return fallback
}

export function errorStatus(error: unknown): number | undefined {
  const s = (error as { status?: unknown } | null)?.status
  return typeof s === 'number' ? s : undefined
}
