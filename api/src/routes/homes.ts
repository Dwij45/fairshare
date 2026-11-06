import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import type {Home,Member} from '../types'


type AppEnv = {
  Bindings: Env
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

  if (
    typeof body !== 'object' ||
    body === null ||
    Array.isArray(body) ||
    !('name' in body)
  ) {
    throw new HTTPException(422, {
      message: 'name is required',
    })
  }

  const name = body.name

  if (
    typeof name !== 'string' ||
    name.trim().length === 0
  ) {
    throw new HTTPException(422, {
      message: 'name must be a non-empty string',
    })
  }

  const home: Home = {
    id: crypto.randomUUID(),
    name: name.trim(),
  }
  try {
  await c.env.DB
    .prepare('INSERT INTO homes (id, name) VALUES (?, ?)')
    .bind(home.id, home.name)
    .run()
} catch (error) {
  if (
    error instanceof Error &&
    error.message.includes('UNIQUE constraint failed')
  ) {
    throw new HTTPException(409, {
      message: 'Home with this name already exists',
    })
  }

  throw error
}

  return c.json(home, 201)
})

homeRoutes.get('/', async (c) => {
  const { results } = await c.env.DB
    .prepare('SELECT id, name FROM homes')
    .all<Home>()

  return c.json({ homes: results }, 200)
})

homeRoutes.delete('/:id', async (c) => {
  const id = c.req.param('id')

  const home = await c.env.DB
    .prepare('SELECT id FROM homes WHERE id = ?')
    .bind(id)
    .first()

  if (!home) {
    throw new HTTPException(404, {
      message: 'Home not found',
    })
  }

  const members = await c.env.DB
    .prepare('SELECT COUNT(*) AS count FROM members WHERE home_id = ?')
    .bind(id)
    .first<{ count: number }>()

  const bills = await c.env.DB
    .prepare('SELECT COUNT(*) AS count FROM bills WHERE home_id = ?')
    .bind(id)
    .first<{ count: number }>()

  if ((members?.count ?? 0) > 0 || (bills?.count ?? 0) > 0) {
    throw new HTTPException(409, {
      message: 'Cannot delete a home that contains members or bills',
    })
  }

  const result = await c.env.DB
    .prepare('DELETE FROM homes WHERE id = ?')
    .bind(id)
    .run()

  if (result.meta.changes === 0) {
    throw new HTTPException(404, {
      message: 'Home not found',
    })
  }

  return c.json({
    message: 'Home deleted successfully',
  })
})




export default homeRoutes