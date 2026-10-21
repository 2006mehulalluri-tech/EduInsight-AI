-- Migration 006: Machine Learning Recommendations, Model Metadata, and Configuration Audit
CREATE TABLE IF NOT EXISTS ml_model_metadata (
  model_id TEXT PRIMARY KEY,
  model_type TEXT NOT NULL,
  trained_at TEXT NOT NULL,
  training_sample_count INTEGER NOT NULL,
  features_used TEXT NOT NULL,
  metrics_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'trained',
  version TEXT NOT NULL DEFAULT '1.0.0'
);

CREATE TABLE IF NOT EXISTS ml_recommendations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  parameter_type TEXT NOT NULL,
  target_id TEXT,
  current_value_json TEXT NOT NULL,
  recommended_value_json TEXT NOT NULL,
  difference_json TEXT,
  recommendation_type TEXT NOT NULL,
  confidence_score REAL,
  explanation TEXT NOT NULL,
  detailed_basis_json TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  generated_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ml_recs_type_target ON ml_recommendations(parameter_type, target_id);

CREATE TABLE IF NOT EXISTS configuration_audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  setting_type TEXT NOT NULL,
  target_id TEXT,
  action TEXT NOT NULL,
  previous_value_json TEXT NOT NULL,
  new_value_json TEXT NOT NULL,
  recommendation_id INTEGER,
  admin_user_id INTEGER,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_config_audit_type ON configuration_audit(setting_type, created_at);
