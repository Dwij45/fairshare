import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import billRoutes from './routes/bills'
import homeRoutes from './routes/homes'

type AppEnv = {
  Bindings: Env
}

const app = new Hono<{ Bindings: Env }>()

app.route('/api/homes', homeRoutes)
app.route('/api/bills', billRoutes)

app.get('/api/health', (c) => {
  return c.json({ status: 'ok' })
})

app.get('/api/db-health', async (c) => {
  const result = await c.env.DB.prepare('SELECT COUNT(*) AS count FROM homes').first()

  return c.json({
    status: 'ok',
    database: 'connected',
    result,
  })
})

export default app
