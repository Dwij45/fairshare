export type Home = { id: string; name: string }

export type Share = {
  id: string
  memberId: string
  memberName: string
  amountCents: number
  paidAt: string | null
}

export type Bill = { id: string; title: string; totalCents: number; shares: Share[] }

export async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const timeout = AbortSignal.timeout(12000)
  const signal = options.signal ? AbortSignal.any([options.signal, timeout]) : timeout
  try {
    const response = await fetch(`/api${path}`, { ...options, signal })
    if (!response.ok) {
      if (response.status >= 500) throw new Error('The server is unavailable. Try again.')
      const body: unknown = await response.json().catch(() => null)
      if (body && typeof body === 'object' && 'error' in body && typeof body.error === 'string') {
        throw new Error(body.error)
      }
      const messages: Record<number, string> = {
        404: 'This item could not be found.',
        409: 'This share has already been paid. Refresh to see the latest status.',
        422: 'Check the details and make sure the home has members before adding a bill.',
      }
      throw new Error(
        messages[response.status] ?? `Request failed (${response.status}). Try again.`,
      )
    }
    return await response.json()
  } catch (error) {
    if (timeout.aborted) throw new Error('The server took too long to respond. Try again.')
    if (error instanceof TypeError) throw new Error('Could not connect to the server. Try again.')
    throw error
  }
}

export function post<T>(path: string, body: object) {
  return request<T>(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

export function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Something went wrong. Try again.'
}
