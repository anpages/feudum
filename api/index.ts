import { Hono } from 'hono'
import { handle } from 'hono/vercel'
import { cors } from 'hono/cors'

const app = new Hono().basePath('/api')

app.use('*', cors({ origin: process.env.BETTER_AUTH_URL ?? 'http://localhost:5173' }))

app.get('/health', (c) => c.json({ status: 'ok', game: 'Feudum' }))

// Routes will be mounted here as modules are built:
// app.route('/kingdoms', kingdomsRouter)
// app.route('/auth', authRouter)
// app.route('/buildings', buildingsRouter)
// app.route('/research', researchRouter)
// app.route('/armies', armiesRouter)

export default handle(app)
