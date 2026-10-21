import { getDatabase } from '../db/connection.js'
import { DEFAULT_RRI_WEIGHTS } from '../services/rri-engine.js'

const SETTING_RRI_WEIGHTS = 'rri_weights'
const SETTING_EVALUATION_SETTINGS = 'evaluation_settings'

export const DEFAULT_EVALUATION_SETTINGS = {
  default_rri_threshold: 60,
  rush_threshold_ms: 1500,
}

export function getRriWeights() {
  const db = getDatabase()
  const row = db
    .prepare('SELECT value_json FROM system_settings WHERE setting_key = ?')
    .get(SETTING_RRI_WEIGHTS)

  if (!row) {
    return { ...DEFAULT_RRI_WEIGHTS }
  }

  try {
    return { ...DEFAULT_RRI_WEIGHTS, ...JSON.parse(row.value_json) }
  } catch {
    return { ...DEFAULT_RRI_WEIGHTS }
  }
}

export function saveRriWeights(weights, updatedBy = null) {
  const db = getDatabase()
  const total = Object.values(weights).reduce((sum, w) => sum + Number(w || 0), 0)
  if (Math.abs(total - 100) > 0.5) {
    throw new Error('Total sum of RRI weights must equal 100%.')
  }

  const json = JSON.stringify(weights)
  db.prepare(
    `INSERT INTO system_settings (setting_key, value_json, updated_by, updated_at)
     VALUES (?, ?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(setting_key) DO UPDATE SET
       value_json = excluded.value_json,
       updated_by = excluded.updated_by,
       updated_at = CURRENT_TIMESTAMP`,
  ).run(SETTING_RRI_WEIGHTS, json, updatedBy)

  return weights
}

export function getEvaluationSettings() {
  const db = getDatabase()
  const row = db
    .prepare('SELECT value_json FROM system_settings WHERE setting_key = ?')
    .get(SETTING_EVALUATION_SETTINGS)

  if (!row) {
    return { ...DEFAULT_EVALUATION_SETTINGS }
  }

  try {
    return { ...DEFAULT_EVALUATION_SETTINGS, ...JSON.parse(row.value_json) }
  } catch {
    return { ...DEFAULT_EVALUATION_SETTINGS }
  }
}

export function saveEvaluationSettings(settings, updatedBy = null) {
  const db = getDatabase()
  const current = getEvaluationSettings()
  const updated = {
    ...current,
    ...settings,
  }

  // Validate bounds
  if (updated.default_rri_threshold !== undefined) {
    const thresh = Number(updated.default_rri_threshold)
    if (Number.isNaN(thresh) || thresh < 0 || thresh > 100) {
      throw new Error('default_rri_threshold must be a number between 0 and 100.')
    }
    updated.default_rri_threshold = Math.round(thresh)
  }

  if (updated.rush_threshold_ms !== undefined) {
    const rush = Number(updated.rush_threshold_ms)
    if (Number.isNaN(rush) || rush < 500 || rush > 10000) {
      throw new Error('rush_threshold_ms must be an integer between 500ms and 10000ms.')
    }
    updated.rush_threshold_ms = Math.round(rush)
  }

  const json = JSON.stringify(updated)
  db.prepare(
    `INSERT INTO system_settings (setting_key, value_json, updated_by, updated_at)
     VALUES (?, ?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(setting_key) DO UPDATE SET
       value_json = excluded.value_json,
       updated_by = excluded.updated_by,
       updated_at = CURRENT_TIMESTAMP`,
  ).run(SETTING_EVALUATION_SETTINGS, json, updatedBy)

  return updated
}

