-- Migration 004: Enforce single review submission per student per course
CREATE UNIQUE INDEX IF NOT EXISTS idx_reviews_student_course ON reviews(course_id, student_id);
