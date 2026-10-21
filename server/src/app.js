import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import cookieParser from 'cookie-parser'
import cors from 'cors'
import express from 'express'
import { getDatabase } from './db/connection.js'
import adminRoutes from './routes/admin.js'
import analyticsRoutes from './routes/analytics.js'
import authRoutes from './routes/auth.js'
import coursesRoutes from './routes/courses.js'
import reviewsRoutes from './routes/reviews.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const clientDistPath = path.resolve(__dirname, '../../client/dist')

function renderLandingPage() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>College Review Quality Analysis API Server</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0b1120; color: #f8fafc; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 24px; box-sizing: border-box; }
    .card { background: #1e293b; border: 1px solid #334155; border-radius: 14px; padding: 36px; max-width: 600px; width: 100%; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.4); }
    .badge { display: inline-flex; align-items: center; gap: 8px; padding: 6px 14px; border-radius: 9999px; font-size: 13px; font-weight: 600; background: #064e3b; color: #34d399; border: 1px solid #059669; margin-bottom: 20px; }
    .dot { width: 8px; height: 8px; border-radius: 50%; background: #34d399; display: inline-block; }
    h1 { margin: 0 0 10px; font-size: 24px; color: #ffffff; letter-spacing: -0.02em; }
    p { color: #94a3b8; font-size: 15px; line-height: 1.6; margin: 0 0 20px; }
    .btn { display: inline-flex; align-items: center; gap: 8px; background: #2563eb; color: #ffffff; text-decoration: none; font-weight: 600; padding: 12px 24px; border-radius: 8px; font-size: 15px; transition: background 0.15s ease; }
    .btn:hover { background: #1d4ed8; }
    .links-box { margin-top: 28px; padding-top: 20px; border-top: 1px solid #334155; }
    .links-title { font-size: 13px; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600; margin-bottom: 12px; }
    .links-grid { display: flex; flex-wrap: wrap; gap: 12px; }
    .links-grid a { color: #60a5fa; text-decoration: none; font-size: 14px; background: #0f172a; padding: 6px 12px; border-radius: 6px; border: 1px solid #334155; transition: border-color 0.15s; }
    .links-grid a:hover { border-color: #60a5fa; }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge"><span class="dot"></span> Backend API Server Online (Port 5000)</div>
    <h1>College Review Quality Analysis System</h1>
    <p>The backend API server is actively running and connected to the database. Access the frontend application or explore API endpoints below:</p>
    <a class="btn" href="http://localhost:5173" target="_blank" rel="noopener noreferrer">Launch Frontend Web App (Port 5173) &rarr;</a>
    <div class="links-box">
      <div class="links-title">API Endpoints</div>
      <div class="links-grid">
        <a href="/api/health">System Health (/api/health)</a>
        <a href="/api">API Info (/api)</a>
        <a href="/api/courses">Courses List (/api/courses)</a>
      </div>
    </div>
  </div>
</body>
</html>`
}

export function createApp() {
  const app = express()

  app.disable('x-powered-by')

  // Enable CORS with credentials for local dev clients
  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps, curl, or same-origin)
        if (!origin) return callback(null, true)
        // Allow localhost and 127.0.0.1 on any port
        if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
          return callback(null, true)
        }
        return callback(null, true)
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
      allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-Requested-With'],
    }),
  )

  app.use(express.json({ limit: '10mb' }))
  app.use(cookieParser())

  // Mount API endpoints with and without /api prefix for maximum reliability
  app.use('/api/auth', authRoutes)
  app.use('/auth', authRoutes)

  app.use('/api/courses', coursesRoutes)
  app.use('/courses', coursesRoutes)

  app.use('/api/reviews', reviewsRoutes)
  app.use('/reviews', reviewsRoutes)

  app.use('/api/analytics', analyticsRoutes)
  app.use('/analytics', analyticsRoutes)

  app.use('/api/admin', adminRoutes)
  app.use('/admin', adminRoutes)

  const handleHealth = (request, response) => {
    try {
      getDatabase().prepare('SELECT 1 AS ok').get()
      response.json({
        status: 'ok',
        service: 'college-review-system-api',
        database: 'connected',
      })
    } catch {
      response.status(503).json({
        status: 'error',
        service: 'college-review-system-api',
        database: 'unavailable',
      })
    }
  }

  app.get('/api/health', handleHealth)
  app.get('/health', handleHealth)

  app.get('/api', (request, response) => {
    response.json({
      name: 'College Review Quality Analysis API',
      version: '1.0.0',
      status: 'online',
      port: 5000,
      frontend: 'http://localhost:5173',
      endpoints: {
        health: '/api/health',
        auth: '/api/auth',
        courses: '/api/courses',
        reviews: '/api/reviews',
        analytics: '/api/analytics',
        admin: '/api/admin',
      },
    })
  })

  // Serve static assets from built frontend if available
  if (fs.existsSync(clientDistPath)) {
    app.use(express.static(clientDistPath))
  }

  // Handle SPA routing & root requests so GET / never returns "Cannot GET /"
  app.use((request, response, next) => {
    if (request.method !== 'GET') return next()

    const apiPrefixes = ['/api', '/auth', '/courses', '/reviews', '/analytics', '/admin', '/health']
    const isApi = apiPrefixes.some(
      (prefix) => request.path === prefix || request.path.startsWith(`${prefix}/`),
    )
    if (isApi) {
      return next()
    }

    const indexPath = path.join(clientDistPath, 'index.html')
    if (fs.existsSync(indexPath)) {
      return response.sendFile(indexPath)
    }

    return response.type('html').send(renderLandingPage())
  })

  return app
}

export default createApp()
