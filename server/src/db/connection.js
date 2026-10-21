import fs from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'
import { config } from '../config/env.js'

let database

export function getDatabase() {
  if (!database) {
    fs.mkdirSync(path.dirname(config.dbPath), { recursive: true })
    database = new Database(config.dbPath)
    database.pragma('foreign_keys = ON')
    database.pragma('journal_mode = WAL')
    database.pragma('synchronous = NORMAL')
    database.pragma('busy_timeout = 5000')
  }

  return database
}

export function closeDatabase() {
  if (database) {
    database.close()
    database = undefined
  }
}
