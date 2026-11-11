import { createFileRoute } from '@tanstack/react-router'
import { type FormEvent, useEffect, useRef, useState } from 'react'
import { type Bill, errorMessage, type Home, post, request, type Share } from '../lib/api'
import '../styles.css'

export const Route = createFileRoute('/')({ component: Dashboard })

const dollars = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })
const money = (cents: number) => dollars.format(cents / 100)

function useResource<T>(path: string) {
  const [data, setData] = useState<T>()
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [version, setVersion] = useState(0)

  // biome-ignore lint/correctness/useExhaustiveDependencies: Reload increments version to fetch the same URL again.
  useEffect(() => {
    const controller = new AbortController()
    request<T>(path, { signal: controller.signal })
      .then((result) => {
        if (!controller.signal.aborted) setData(result)
      })
      .catch((failure: unknown) => {
        if (!controller.signal.aborted) setError(errorMessage(failure))
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [path, version])

  return {
    data,
    setData,
    error,
    loading,
    reload() {
      setLoading(true)
      setError('')
      setVersion((current) => current + 1)
    },
  }
}

function Dashboard() {
  const homes = useResource<{ homes: Home[] }>('/homes')
  const [selected, setSelected] = useState('')
  const options = homes.data?.homes ?? []
  const home = options.find(({ id }) => id === selected) ?? options[0]

  return (
    <>
      <header className="topbar">
        <div className="shell brand">
          <span className="mark" aria-hidden="true">
            ≋
          </span>{' '}
          FairShare
        </div>
      </header>
      <main className="shell dashboard">
        <div className="intro">
          <div>
            <h1>FairShare</h1>
            <p>See what everyone owes and mark shares as paid.</p>
          </div>
          {home && (
            <label className="home-picker">
              Homes
              <select value={home.id} onChange={(event) => setSelected(event.target.value)}>
                {options.map(({ id, name }) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>

        {homes.loading && (
          <p className="state" role="status">
            Loading Homes…
          </p>
        )}
        {homes.error && <LoadError message={homes.error} retry={homes.reload} />}
        {home && <Bills key={home.id} home={home} />}
        {homes.data && (
          <details className="setup" open={home ? undefined : true}>
            <summary>{home ? 'Create another Home' : 'Create your first Home'}</summary>
            <ActionForm
              action="Create Home"
              onSubmit={async (values) => {
                const created = await post<Home>('/homes', { name: values.get('name') })
                homes.setData((previous) => ({ homes: [...(previous?.homes ?? []), created] }))
                setSelected(created.id)
              }}
            >
              <label>
                Home name
                <input name="name" placeholder="e.g. Flat 4B" required />
              </label>
            </ActionForm>
          </details>
        )}
      </main>
    </>
  )
}

function Bills({ home }: { home: Home }) {
  const path = `/homes/${encodeURIComponent(home.id)}`
  const ledger = useResource<{ bills: Bill[] }>(`${path}/bills`)
  const [confirmedPayments, setConfirmedPayments] = useState<Record<string, string>>({})
  const bills = (ledger.data?.bills ?? []).map((bill) => ({
    ...bill,
    shares: bill.shares.map((share) => ({
      ...share,
      paidAt: share.paidAt ?? confirmedPayments[share.id] ?? null,
    })),
  }))
  const shares = bills.flatMap((bill) => bill.shares)
  const outstanding = shares.reduce((sum, share) => sum + (share.paidAt ? 0 : share.amountCents), 0)

  function updateShare({ id, paidAt }: Share) {
    if (paidAt) setConfirmedPayments((current) => ({ ...current, [id]: paidAt }))
  }

  return (
    <section aria-label={`Bills for ${home.name}`}>
      {ledger.data && (
        <div className="overview">
          <div>
            <span>Outstanding</span>
            <strong>{money(outstanding)}</strong>
          </div>
          <div>
            <span>Total billed</span>
            <strong>{money(bills.reduce((sum, bill) => sum + bill.totalCents, 0))}</strong>
          </div>
          <div>
            <span>Shares paid</span>
            <strong>
              {shares.filter((share) => share.paidAt).length} <small>/ {shares.length}</small>
            </strong>
          </div>
        </div>
      )}
      <div className="section-heading">
        <h2>
          Bills <span>{ledger.data ? bills.length : ''}</span>
        </h2>
        <button className="quiet" type="button" disabled={ledger.loading} onClick={ledger.reload}>
          Refresh
        </button>
      </div>
      {ledger.loading && (
        <p className="state" role="status">
          Loading bills…
        </p>
      )}
      {ledger.error && <LoadError message={ledger.error} retry={ledger.reload} />}
      {ledger.data && !ledger.loading && !ledger.error && !bills.length && (
        <div className="state empty">
          <h3>No bills yet</h3>
          <p>Add members and create a bill below to split your first expense.</p>
        </div>
      )}
      {bills.map((bill) => (
        <article className="bill" key={bill.id}>
          <div className="bill-heading">
            <div>
              <h3>{bill.title}</h3>
              <p>
                {bill.shares.length} {bill.shares.length === 1 ? 'share' : 'shares'}
              </p>
            </div>
            <strong>{money(bill.totalCents)}</strong>
          </div>
          <ul className="shares">
            {bill.shares.map((share) => (
              <ShareRow
                key={share.id}
                share={share}
                billId={bill.id}
                billTitle={bill.title}
                onPaid={updateShare}
              />
            ))}
          </ul>
        </article>
      ))}
      <details className="setup">
        <summary>Add members or a bill</summary>
        <div className="forms">
          <ActionForm
            action="Add member"
            success="Member added."
            onSubmit={async (values) => {
              await post(`${path}/members`, { name: values.get('name') })
            }}
          >
            <label>
              Member name
              <input name="name" placeholder="e.g. Asha" required />
            </label>
          </ActionForm>
          <ActionForm
            action="Create bill"
            success="Bill created."
            onSubmit={async (values) => {
              await post(`${path}/bills`, {
                title: values.get('title'),
                totalCents: Number(values.get('cents')),
              })
              ledger.reload()
            }}
          >
            <label>
              Bill title
              <input name="title" placeholder="e.g. Electricity" required />
            </label>
            <label>
              Amount in cents
              <input
                name="cents"
                type="number"
                min="1"
                max={Number.MAX_SAFE_INTEGER}
                step="1"
                placeholder="e.g. 2500 for $25"
                required
              />
            </label>
          </ActionForm>
        </div>
      </details>
    </section>
  )
}

function ShareRow({
  share,
  billId,
  billTitle,
  onPaid,
}: {
  share: Share
  billId: string
  billTitle: string
  onPaid: (share: Share) => void
}) {
  const key = useRef<string>(undefined)
  const inFlight = useRef(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')

  async function pay() {
    if (inFlight.current) return
    inFlight.current = true
    setPending(true)
    setError('')
    try {
      key.current ??= crypto.randomUUID()
      const paid = await request<Share>(
        `/bills/${encodeURIComponent(billId)}/shares/${encodeURIComponent(share.id)}/pay`,
        { method: 'POST', headers: { 'Idempotency-Key': key.current } },
      )
      onPaid(paid)
    } catch (failure) {
      setError(errorMessage(failure))
    } finally {
      inFlight.current = false
      setPending(false)
    }
  }

  return (
    <li className="share">
      <div className="share-row">
        <div className="person">
          <span className="avatar" aria-hidden="true">
            {share.memberName.slice(0, 1).toUpperCase()}
          </span>
          <div>
            <strong>{share.memberName}</strong>
            <span className={share.paidAt ? 'paid' : 'unpaid'}>
              {share.paidAt ? 'Paid' : 'Unpaid'}
            </span>
          </div>
        </div>
        <strong className="amount">{money(share.amountCents)}</strong>
        {share.paidAt ? (
          <span className="settled" aria-hidden="true">
            ✓
          </span>
        ) : (
          <button
            type="button"
            disabled={pending}
            onClick={pay}
            aria-label={`${pending ? 'Paying' : error ? 'Retry payment for' : 'Pay'} ${share.memberName}’s share of ${billTitle}`}
          >
            {pending ? 'Paying…' : error ? 'Retry' : 'Pay'}
          </button>
        )}
      </div>
      {error && !share.paidAt && (
        <p className="payment-error" role="alert">
          {error}
        </p>
      )}
    </li>
  )
}

function LoadError({ message, retry }: { message: string; retry: () => void }) {
  return (
    <div className="state error">
      <p role="alert">{message}</p>
      <button type="button" onClick={retry}>
        Try again
      </button>
    </div>
  )
}

function ActionForm({
  action,
  success,
  onSubmit,
  children,
}: {
  action: string
  success?: string
  onSubmit: (values: FormData) => Promise<void>
  children: React.ReactNode
}) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return
    const form = event.currentTarget
    setPending(true)
    setError('')
    setDone(false)
    try {
      await onSubmit(new FormData(form))
      form.reset()
      setDone(true)
    } catch (failure) {
      setError(errorMessage(failure))
    } finally {
      setPending(false)
    }
  }

  return (
    <form onSubmit={submit}>
      <fieldset disabled={pending}>
        {children}
        <button type="submit">{pending ? 'Saving…' : action}</button>
      </fieldset>
      {error && (
        <p className="payment-error" role="alert">
          {error}
        </p>
      )}
      {done && success && (
        <p className="paid" role="status">
          {success}
        </p>
      )}
    </form>
  )
}
