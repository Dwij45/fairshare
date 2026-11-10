import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import type {
  BalanceRow,
  Bill,
  BillRow,
  BillWithMembers,
  Home,
  Member,
  Share,
  ShareWithMemberRow,
} from '../types'

type AppEnv = {
  Bindings: Env
}
type MemberRow = {
  id: string
  sequence: number
}
const homeRoutes = new Hono<AppEnv>()

homeRoutes.post('/', async (c) => {
  let body: unknown

  try {
    body = await c.req.json()
  } catch {
    throw new HTTPException(400, {
      message: 'Invalid JSON body',
    })
  }

  if (typeof body !== 'object' || body === null || Array.isArray(body) || !('name' in body)) {
    throw new HTTPException(422, {
      message: 'name is required',
    })
  }

  const name = body.name

  if (typeof name !== 'string' || name.trim().length === 0) {
    throw new HTTPException(422, {
      message: 'name must be a non-empty string',
    })
  }

  const home: Home = {
    id: crypto.randomUUID(),
    name: name.trim(),
  }
  try {
    await c.env.DB.prepare('INSERT INTO homes (id, name) VALUES (?, ?)')
      .bind(home.id, home.name)
      .run()
  } catch (error) {
    if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) {
      throw new HTTPException(409, {
        message: 'Home with this name already exists',
      })
    }

    throw error
  }

  return c.json(home, 201)
})

homeRoutes.post('/:homeId/members', async (c) => {
  const homeId = c.req.param('homeId')

  let body: unknown

  try {
    body = await c.req.json()
  } catch {
    throw new HTTPException(400, {
      message: 'Invalid/No JSON body',
    })
  }

  if (typeof body !== 'object' || body === null || Array.isArray(body) || !('name' in body)) {
    throw new HTTPException(422, {
      message: 'name is required',
    })
  }

  const name = body.name

  if (typeof name !== 'string' || name.trim().length === 0) {
    throw new HTTPException(422, {
      message: 'name must be a non-empty string',
    })
  }

  const home = await c.env.DB.prepare('SELECT id FROM homes WHERE id = ?').bind(homeId).first()

  if (!home) {
    throw new HTTPException(404, {
      message: 'Home not found',
    })
  }

  const member: Member = {
    id: crypto.randomUUID(),
    homeId,
    name: name.trim(),
  }

  await c.env.DB.prepare('INSERT INTO members (id, home_id, name) VALUES (?, ?, ?)')
    .bind(member.id, member.homeId, member.name)
    .run()

  return c.json(member, 201)
})

homeRoutes.get('/', async (c) => {
  const { results } = await c.env.DB.prepare('SELECT id, name FROM homes').all<Home>()

  return c.json({ homes: results }, 200)
})

homeRoutes.delete('/:id', async (c) => {
  const id = c.req.param('id')

  const home = await c.env.DB.prepare('SELECT id FROM homes WHERE id = ?').bind(id).first()

  if (!home) {
    throw new HTTPException(404, {
      message: 'Home not found',
    })
  }

  const members = await c.env.DB.prepare('SELECT COUNT(*) AS count FROM members WHERE home_id = ?')
    .bind(id)
    .first<{ count: number }>()

  const bills = await c.env.DB.prepare('SELECT COUNT(*) AS count FROM bills WHERE home_id = ?')
    .bind(id)
    .first<{ count: number }>()

  if ((members?.count ?? 0) > 0 || (bills?.count ?? 0) > 0) {
    throw new HTTPException(409, {
      message: 'Cannot delete a home that contains members or bills',
    })
  }

  const result = await c.env.DB.prepare('DELETE FROM homes WHERE id = ?').bind(id).run()

  if (result.meta.changes === 0) {
    throw new HTTPException(404, {
      message: 'Home not found',
    })
  }

  return c.json({
    message: 'Home deleted successfully',
  })
})

homeRoutes.post('/:homeId/bills', async (c) => {
  const homeId = c.req.param('homeId')

  const home = await c.env.DB.prepare('SELECT id FROM homes WHERE id = ?').bind(homeId).first()

  if (!home) {
    throw new HTTPException(404, {
      message: 'Home not found',
    })
  }

  let body: unknown

  try {
    body = await c.req.json()
  } catch {
    throw new HTTPException(400, {
      message: 'Invalid JSON body',
    })
  }

  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new HTTPException(400, {
      message: 'Request body must be an object',
    })
  }

  const input = body as Record<string, unknown>

  const title = input.title
  const totalCents = input.totalCents

  if (typeof title !== 'string' || title.trim().length === 0) {
    throw new HTTPException(422, {
      message: 'title must be a non-empty string',
    })
  }

  if (typeof totalCents !== 'number' || !Number.isSafeInteger(totalCents) || totalCents <= 0) {
    throw new HTTPException(422, {
      message: 'totalCents must be a positive safe integer',
    })
  }

  const { results: members } = await c.env.DB.prepare(`
      SELECT id, sequence
      FROM members
      WHERE home_id = ?
      ORDER BY sequence ASC
    `)
    .bind(homeId)
    .all<MemberRow>()

  if (members.length === 0) {
    throw new HTTPException(422, {
      message: 'Cannot create a bill without members',
    })
  }

  const base = Math.floor(totalCents / members.length)
  const remainder = totalCents % members.length

  const billId = crypto.randomUUID()

  const shares: Share[] = members.map((member, index) => ({
    id: crypto.randomUUID(),
    memberId: member.id,
    amountCents: base + (index < remainder ? 1 : 0),
    paidAt: null,
  }))

  const statements = [
    c.env.DB.prepare(`
        INSERT INTO bills (id, home_id, title, total_cents)
        VALUES (?, ?, ?, ?)
      `).bind(billId, homeId, title.trim(), totalCents),

    ...shares.map((share) =>
      c.env.DB.prepare(`
          INSERT INTO shares (id, bill_id, member_id, amount_cents)
          VALUES (?, ?, ?, ?)
        `).bind(share.id, billId, share.memberId, share.amountCents),
    ),
  ]

  await c.env.DB.batch(statements)

  const bill: Bill = {
    id: billId,
    homeId,
    title: title.trim(),
    totalCents,
    shares,
  }

  return c.json(bill, 201)
})

homeRoutes.get('/:homeId/bills', async (c) => {
  const homeId = c.req.param('homeId')

  // 1. Check whether the home exists
  const home = await c.env.DB.prepare('SELECT id FROM homes WHERE id = ?').bind(homeId).first()

  if (!home) {
    throw new HTTPException(404, {
      message: 'Home not found',
    })
  }

  // 2. Fetch bills
  const { results: billRows } = await c.env.DB.prepare(`
      SELECT
        id,
        home_id AS homeId,
        title,
        total_cents AS totalCents
      FROM bills
      WHERE home_id = ?
      ORDER BY rowid DESC
    `)
    .bind(homeId)
    .all<BillRow>()

  // 3. Fetch shares with member names
  const { results: shareRows } = await c.env.DB.prepare(`
      SELECT
        s.id,
        s.bill_id AS billId,
        s.member_id AS memberId,
        m.name AS memberName,
        s.amount_cents AS amountCents,
        s.paid_at AS paidAt
      FROM shares s
      JOIN bills b ON b.id = s.bill_id
      JOIN members m ON m.id = s.member_id
      WHERE b.home_id = ?
      ORDER BY m.sequence ASC
    `)
    .bind(homeId)
    .all<ShareWithMemberRow>()

  // 4. Group shares by bill ID
  const sharesByBill = new Map<string, ShareWithMemberRow[]>()

  for (const share of shareRows) {
    const group = sharesByBill.get(share.billId) ?? []
    group.push(share)
    sharesByBill.set(share.billId, group)
  }

  // 5. Attach shares to bills
  const bills: BillWithMembers[] = billRows.map((bill) => ({
    ...bill,
    shares: (sharesByBill.get(bill.id) ?? []).map(({ billId, ...share }) => share),
  }))

  return c.json({ bills }, 200)
})

homeRoutes.get('/:homeId/balances', async (c) => {
  const homeId = c.req.param('homeId')

  const home = await c.env.DB.prepare('SELECT id FROM homes WHERE id = ?').bind(homeId).first()

  if (!home) {
    throw new HTTPException(404, {
      message: 'Home not found',
    })
  }

  const { results: balances } = await c.env.DB.prepare(`
      SELECT
        m.id AS memberId,
        m.name AS name,
        COALESCE(SUM(
          CASE
            WHEN s.paid_at IS NULL THEN s.amount_cents
            ELSE 0
          END
        ), 0) AS outstandingCents
      FROM members m
      LEFT JOIN shares s ON s.member_id = m.id
      LEFT JOIN bills b ON b.id = s.bill_id
      WHERE m.home_id = ?
      GROUP BY m.id, m.name, m.sequence
      ORDER BY m.sequence ASC
    `)
    .bind(homeId)
    .all<BalanceRow>()

  return c.json({ balances }, 200)
})
export default homeRoutes
