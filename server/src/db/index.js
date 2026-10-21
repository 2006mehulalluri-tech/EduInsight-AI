import { getDatabase } from './connection.js'
import { runMigrations } from './migrate.js'

export function initializeDatabase() {
  runMigrations()
  return getDatabase()
}
