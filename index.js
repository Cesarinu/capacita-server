// server/index.js
import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'

// DB e rotas
import { initDb } from './src/db.js'
import authRoutes from './routes/auth.js'
import courseRoutes from './routes/courses.js'
import mentorRoutes from './routes/mentor.js'
import payRoutes from './routes/payments.js'
import certRoutes from './routes/certificates.js'
import analyticsRoutes from './routes/analytics.js'

dotenv.config()
const app = express()

// CORS e JSON
app.use(cors({ origin: true }))
app.use(express.json())

// Banco
export const db = initDb()

// Healthcheck simples
app.get('/health', (req, res) => {
  res.json({ ok: true, version: '0.4.0' })
})

// Status de integrações (usado pelo front)
app.get('/status', (req, res) => {
  res.json({
    openai: !!process.env.OPENAI_API_KEY,
    stripe: !!process.env.STRIPE_SECRET,
    mercadopago: !!process.env.MP_ACCESS_TOKEN,
    web_url: process.env.WEB_URL || null
  })
})

// Rotas principais
app.use('/auth', authRoutes)
app.use('/courses', courseRoutes)
app.use('/mentor', mentorRoutes)
app.use('/payments', payRoutes)
app.use('/certificates', certRoutes)
app.use('/analytics', analyticsRoutes)

// Seed (cria usuário demo) — executar uma vez
app.get('/seed', (req, res) => {
  try {
    db.prepare(`
      INSERT OR IGNORE INTO users (email, password_hash, name)
      VALUES ('demo@cap.ci',
              '$2a$10$Qxnnn7mQf0sF2f9b0l1U5eG9wS0FQw5h8e7kGzVYf3QFQ8KPMpAq2',
              'Demo User')
    `).run()
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

const PORT = process.env.PORT || 4000
app.listen(PORT, () => {
  console.log(`API on http://localhost:${PORT}`)
})
