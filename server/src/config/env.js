import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const serverRoot = path.resolve(__dirname, '../..')
const rootDir = path.resolve(serverRoot, '..')

// Attempt loading from server/.env, root/.env, and process.cwd()/.env
if (fs.existsSync(path.join(serverRoot, '.env'))) {
  dotenv.config({ path: path.join(serverRoot, '.env') })
}
if (fs.existsSync(path.join(rootDir, '.env'))) {
  dotenv.config({ path: path.join(rootDir, '.env') })
}
dotenv.config()

const parsedPort = Number.parseInt(process.env.PORT ?? '', 10)
const jwtSecret =
  process.env.JWT_SECRET ||
  '4eaa1786bf40422a9edd986a571b59c7d35dfc95be5c3cf29d9ffef29ea82962'

const rawDbPath = process.env.DB_PATH || './data/college_review.db'
let resolvedDbPath
if (path.isAbsolute(rawDbPath)) {
  resolvedDbPath = rawDbPath
} else if (fs.existsSync(path.resolve(serverRoot, rawDbPath))) {
  resolvedDbPath = path.resolve(serverRoot, rawDbPath)
} else if (fs.existsSync(path.resolve(process.cwd(), rawDbPath))) {
  resolvedDbPath = path.resolve(process.cwd(), rawDbPath)
} else {
  resolvedDbPath = path.resolve(serverRoot, rawDbPath)
}

export const config = Object.freeze({
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number.isInteger(parsedPort) && parsedPort > 0 ? parsedPort : 5000,
  dbPath: resolvedDbPath,
  jwtSecret,
  sessionTtl: process.env.SESSION_TTL || '8h',
  authCookieName: process.env.AUTH_COOKIE_NAME || 'crq_session',
})
