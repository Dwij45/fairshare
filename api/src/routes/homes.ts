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

export default homeRoutes