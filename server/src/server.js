import { config } from './config/env.js'
import { closeDatabase, getDatabase } from './db/connection.js'
import { initializeDatabase } from './db/index.js'
import app from './app.js'

initializeDatabase()
getDatabase()

const server = app.listen(config.port, () => {
  console.log(`API server listening on http://localhost:${config.port}`)
})

function shutdown() {
  server.close(() => {
    closeDatabase()
    process.exit(0)
  })
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
