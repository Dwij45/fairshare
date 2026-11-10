import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import type { ShareRow } from '../types'

type AppEnv = {
  Bindings: Env
}

const billRoutes = new Hono<AppEnv>()

billRoutes.post('/:billId/shares/:shareId/pay', async (c) => {
  const billId = c.req.param('billId')
  const shareId = c.req.param('shareId')

  const paymentKey = c.req.header('Idempotency-Key')

  if (!paymentKey || !paymentKey.trim()) {
    throw new HTTPException(400, {
      message: 'Idempotency-Key header is required',
    })
  }

  const share = await c.env.DB.prepare(`
      SELECT
        id,
        bill_id AS billId,
        member_id AS memberId,
        amount_cents AS amountCents,
        paid_at AS paidAt,
        payment_key AS paymentKey
      FROM shares
      WHERE id = ? AND bill_id = ?
    `)
    .bind(shareId, billId)
    .first<ShareRow>()

  if (!share) {
    throw new HTTPException(404, {
      message: 'Share not found',
    })
  }

  if (share.paidAt !== null) {
    if (share.paymentKey !== paymentKey) {
      throw new HTTPException(409, {
        message: 'Share already paid',
      })
    }

    return c.json({
      id: share.id,
      memberId: share.memberId,
      amountCents: share.amountCents,
      paidAt: share.paidAt,
    })
  }

  const paidAt = new Date().toISOString()

  const result = await c.env.DB.prepare(`
      UPDATE shares
      SET paid_at = ?, payment_key = ?
      WHERE id = ?
        AND bill_id = ?
        AND paid_at IS NULL
    `)
    .bind(paidAt, paymentKey, shareId, billId)
    .run()

  if (result.meta.changes === 0) {
    const current = await c.env.DB.prepare(`
        SELECT
          id,
          bill_id AS billId,
          member_id AS memberId,
          amount_cents AS amountCents,
          paid_at AS paidAt,
          payment_key AS paymentKey
        FROM shares
        WHERE id = ? AND bill_id = ?
      `)
      .bind(shareId, billId)
      .first<ShareRow>()

    if (current?.paidAt && current.paymentKey === paymentKey) {
      return c.json({
        id: current.id,
        memberId: current.memberId,
        amountCents: current.amountCents,
        paidAt: current.paidAt,
      })
    }

    throw new HTTPException(409, {
      message: 'Share already paid',
    })
  }

  return c.json({
    id: share.id,
    memberId: share.memberId,
    amountCents: share.amountCents,
    paidAt,
  })
})

export default billRoutes
