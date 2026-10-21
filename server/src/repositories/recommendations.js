import { getDatabase } from '../db/connection.js'

export function saveModelMetadata(metadata) {
  const db = getDatabase()
  const featuresJson = JSON.stringify(metadata.features_used || [])
  const metricsJson = JSON.stringify(metadata.metrics || {})

  db.prepare(`
    INSERT INTO ml_model_metadata (
      model_id, model_type, trained_at, training_sample_count, features_used, metrics_json, status, version
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(model_id) DO UPDATE SET
      model_type = excluded.model_type,
      trained_at = excluded.trained_at,
      training_sample_count = excluded.training_sample_count,
      features_used = excluded.features_used,
      metrics_json = excluded.metrics_json,
      status = excluded.status,
      version = excluded.version
  `).run(
    metadata.model_id,
    metadata.model_type,
    metadata.trained_at,
    metadata.training_sample_count || 0,
    featuresJson,
    metricsJson,
    metadata.status || 'trained',
    metadata.version || '1.0.0',
  )
}

export function getAllModelMetadata() {
  const db = getDatabase()
  const rows = db.prepare('SELECT * FROM ml_model_metadata ORDER BY trained_at DESC').all()
  return rows.map((r) => ({
    ...r,
    features_used: JSON.parse(r.features_used || '[]'),
    metrics: JSON.parse(r.metrics_json || '{}'),
  }))
}

export function saveCachedRecommendations(recs) {
  if (!Array.isArray(recs) || recs.length === 0) return

  const db = getDatabase()
  const insertStmt = db.prepare(`
    INSERT INTO ml_recommendations (
      parameter_type, target_id, current_value_json, recommended_value_json,
      difference_json, recommendation_type, confidence_score, explanation,
      detailed_basis_json, status, generated_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)
  `)

  const transaction = db.transaction((items) => {
    // Delete existing active recommendations of these parameter types
    const types = [...new Set(items.map((i) => i.parameter_type))]
    for (const type of types) {
      db.prepare('DELETE FROM ml_recommendations WHERE parameter_type = ?').run(type)
    }

    const now = new Date().toISOString()
    for (const item of items) {
      insertStmt.run(
        item.parameter_type,
        item.target_id || null,
        JSON.stringify(item.current_value),
        JSON.stringify(item.recommended_value),
        JSON.stringify(item.difference),
        item.recommendation_type,
        item.confidence_score || null,
        item.explanation,
        JSON.stringify(item.detailed_basis || {}),
        now,
        now,
      )
    }
  })

  transaction(recs)
}

export function getCachedRecommendations(parameterType = null) {
  const db = getDatabase()
  let rows
  if (parameterType) {
    rows = db.prepare('SELECT * FROM ml_recommendations WHERE parameter_type = ? ORDER BY id ASC').all(parameterType)
  } else {
    rows = db.prepare('SELECT * FROM ml_recommendations ORDER BY parameter_type, id ASC').all()
  }

  return rows.map((r) => ({
    id: r.id,
    parameter_type: r.parameter_type,
    target_id: r.target_id,
    current_value: JSON.parse(r.current_value_json || 'null'),
    recommended_value: JSON.parse(r.recommended_value_json || 'null'),
    difference: JSON.parse(r.difference_json || 'null'),
    recommendation_type: r.recommendation_type,
    confidence_score: r.confidence_score,
    explanation: r.explanation,
    detailed_basis: JSON.parse(r.detailed_basis_json || '{}'),
    status: r.status,
    generated_at: r.generated_at,
  }))
}

export function recordConfigurationAudit({
  setting_type,
  target_id = null,
  action,
  previous_value,
  new_value,
  recommendation_id = null,
  admin_user_id = null,
}) {
  const db = getDatabase()
  const res = db.prepare(`
    INSERT INTO configuration_audit (
      setting_type, target_id, action, previous_value_json, new_value_json,
      recommendation_id, admin_user_id, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    setting_type,
    target_id ? String(target_id) : null,
    action,
    JSON.stringify(previous_value),
    JSON.stringify(new_value),
    recommendation_id,
    admin_user_id,
    new Date().toISOString(),
  )

  return res.lastInsertRowid
}

export function getConfigurationAuditHistory(limit = 50) {
  const db = getDatabase()
  const rows = db.prepare(`
    SELECT ca.*, u.email as admin_email, u.first_name, u.last_name
    FROM configuration_audit ca
    LEFT JOIN users u ON ca.admin_user_id = u.id
    ORDER BY ca.id DESC
    LIMIT ?
  `).all(limit)

  return rows.map((r) => ({
    id: r.id,
    setting_type: r.setting_type,
    target_id: r.target_id,
    action: r.action,
    previous_value: JSON.parse(r.previous_value_json || 'null'),
    new_value: JSON.parse(r.new_value_json || 'null'),
    recommendation_id: r.recommendation_id,
    admin_user_id: r.admin_user_id,
    admin_name: r.first_name ? `${r.first_name} ${r.last_name || ''}`.trim() : (r.admin_email || 'System'),
    created_at: r.created_at,
  }))
}
