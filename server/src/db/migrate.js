import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { closeDatabase, getDatabase } from './connection.js'

const migrationsDirectory = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'migrations',
)

export function runMigrations() {
  const db = getDatabase()

  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
  `)

  const appliedMigrations = new Set(
    db.prepare('SELECT name FROM schema_migrations').all().map((row) => row.name),
  )

  const migrationFiles = fs
    .readdirSync(migrationsDirectory)
    .filter((fileName) => fileName.endsWith('.sql'))
    .sort()

  for (const fileName of migrationFiles) {
    if (appliedMigrations.has(fileName)) {
      continue
    }

    const sql = fs.readFileSync(path.join(migrationsDirectory, fileName), 'utf8')
    const applyMigration = db.transaction(() => {
      db.exec(sql)
      db.prepare(
        'INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?)',
      ).run(fileName, new Date().toISOString())
    })

    applyMigration()
    console.log(`Applied migration ${fileName}`)
  }
}

const isDirectRun =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))

if (isDirectRun) {
  try {
    runMigrations()
    console.log('Database migrations completed.')
  } finally {
    closeDatabase()
  }
}
