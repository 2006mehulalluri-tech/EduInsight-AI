-- Migration 002: RRI, Expected Response Times, Sentiment, and Behavioral Breakdown

ALTER TABLE questions ADD COLUMN expected_response_time_ms INTEGER NOT NULL DEFAULT 10000;
ALTER TABLE questions ADD COLUMN category TEXT DEFAULT 'Theory';

ALTER TABLE reviews ADD COLUMN rri_score REAL;
ALTER TABLE reviews ADD COLUMN sentiment_label TEXT CHECK (sentiment_label IS NULL OR sentiment_label IN ('positive', 'neutral', 'negative'));
ALTER TABLE reviews ADD COLUMN sentiment_score REAL;
ALTER TABLE reviews ADD COLUMN average_rating REAL;
ALTER TABLE reviews ADD COLUMN is_demo INTEGER NOT NULL DEFAULT 0;

ALTER TABLE behavioral_metrics ADD COLUMN time_score REAL;
ALTER TABLE behavioral_metrics ADD COLUMN time_variance_score REAL;
ALTER TABLE behavioral_metrics ADD COLUMN rush_score REAL;
ALTER TABLE behavioral_metrics ADD COLUMN reflection_score REAL;
ALTER TABLE behavioral_metrics ADD COLUMN behavioral_consistency_score REAL;
ALTER TABLE behavioral_metrics ADD COLUMN response_consistency_score REAL;
ALTER TABLE behavioral_metrics ADD COLUMN answer_changes_score REAL;
ALTER TABLE behavioral_metrics ADD COLUMN question_revisits_score REAL;
ALTER TABLE behavioral_metrics ADD COLUMN breakdown_json TEXT;

CREATE INDEX IF NOT EXISTS idx_reviews_rri_course ON reviews(course_id, rri_score);
CREATE INDEX IF NOT EXISTS idx_reviews_sentiment ON reviews(sentiment_label);
CREATE INDEX IF NOT EXISTS idx_reviews_status_rri ON reviews(status, rri_score);
