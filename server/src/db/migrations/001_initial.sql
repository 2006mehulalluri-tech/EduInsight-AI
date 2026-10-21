CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('student', 'faculty', 'administrator')),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'suspended', 'disabled')),
  first_name TEXT,
  last_name TEXT,
  enrollment_number TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_login_at TEXT
);

CREATE TABLE IF NOT EXISTS faculty (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  employee_id TEXT UNIQUE,
  department TEXT,
  title TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS courses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE COLLATE NOCASE,
  title TEXT NOT NULL,
  department TEXT,
  academic_year TEXT,
  academic_term TEXT,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS course_faculty (
  course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  faculty_id INTEGER NOT NULL REFERENCES faculty(id) ON DELETE CASCADE,
  assigned_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (course_id, faculty_id)
);

CREATE TABLE IF NOT EXISTS questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  position INTEGER NOT NULL CHECK (position >= 1),
  prompt TEXT NOT NULL,
  question_type TEXT NOT NULL DEFAULT 'text',
  required INTEGER NOT NULL DEFAULT 0 CHECK (required IN (0, 1)),
  metadata_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (course_id, position)
);

CREATE TABLE IF NOT EXISTS reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  review_number INTEGER NOT NULL DEFAULT 1 CHECK (review_number >= 1),
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'submitted', 'cancelled')),
  started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  submitted_at TEXT,
  total_duration_ms INTEGER CHECK (total_duration_ms IS NULL OR total_duration_ms >= 0),
  client_timezone TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (course_id, student_id, review_number)
);

CREATE TABLE IF NOT EXISTS review_responses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  review_id INTEGER NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  answer_json TEXT,
  first_answered_at TEXT,
  last_answered_at TEXT,
  time_on_question_ms INTEGER CHECK (time_on_question_ms IS NULL OR time_on_question_ms >= 0),
  view_count INTEGER NOT NULL DEFAULT 0 CHECK (view_count >= 0),
  change_count INTEGER NOT NULL DEFAULT 0 CHECK (change_count >= 0),
  revisit_count INTEGER NOT NULL DEFAULT 0 CHECK (revisit_count >= 0),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (review_id, question_id)
);

CREATE TABLE IF NOT EXISTS behavioral_metrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  review_id INTEGER NOT NULL UNIQUE REFERENCES reviews(id) ON DELETE CASCADE,
  total_duration_ms INTEGER CHECK (total_duration_ms IS NULL OR total_duration_ms >= 0),
  average_question_time_ms REAL CHECK (
    average_question_time_ms IS NULL OR average_question_time_ms >= 0
  ),
  answer_change_count INTEGER NOT NULL DEFAULT 0 CHECK (answer_change_count >= 0),
  revisit_count INTEGER NOT NULL DEFAULT 0 CHECK (revisit_count >= 0),
  long_pause_count INTEGER NOT NULL DEFAULT 0 CHECK (long_pause_count >= 0),
  rapid_response_count INTEGER NOT NULL DEFAULT 0 CHECK (rapid_response_count >= 0),
  calculated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id INTEGER,
  details_json TEXT,
  occurred_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS system_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  setting_key TEXT NOT NULL UNIQUE,
  value_json TEXT NOT NULL,
  updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_role_status
  ON users(role, status);
CREATE INDEX IF NOT EXISTS idx_faculty_department
  ON faculty(department);
CREATE INDEX IF NOT EXISTS idx_courses_department_term
  ON courses(department, academic_year, academic_term);
CREATE INDEX IF NOT EXISTS idx_course_faculty_faculty
  ON course_faculty(faculty_id, course_id);
CREATE INDEX IF NOT EXISTS idx_questions_course
  ON questions(course_id, position);
CREATE INDEX IF NOT EXISTS idx_reviews_course_status
  ON reviews(course_id, status);
CREATE INDEX IF NOT EXISTS idx_reviews_student_started
  ON reviews(student_id, started_at);
CREATE INDEX IF NOT EXISTS idx_review_responses_review
  ON review_responses(review_id);
CREATE INDEX IF NOT EXISTS idx_review_responses_question
  ON review_responses(question_id);
CREATE INDEX IF NOT EXISTS idx_behavioral_metrics_review
  ON behavioral_metrics(review_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_time
  ON audit_logs(actor_id, occurred_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_time
  ON audit_logs(entity_type, entity_id, occurred_at);

CREATE TRIGGER IF NOT EXISTS users_set_updated_at
BEFORE UPDATE ON users
FOR EACH ROW
BEGIN
  UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS faculty_set_updated_at
BEFORE UPDATE ON faculty
FOR EACH ROW
BEGIN
  UPDATE faculty SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS courses_set_updated_at
BEFORE UPDATE ON courses
FOR EACH ROW
BEGIN
  UPDATE courses SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS questions_set_updated_at
BEFORE UPDATE ON questions
FOR EACH ROW
BEGIN
  UPDATE questions SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS reviews_set_updated_at
BEFORE UPDATE ON reviews
FOR EACH ROW
BEGIN
  UPDATE reviews SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS review_responses_set_updated_at
BEFORE UPDATE ON review_responses
FOR EACH ROW
BEGIN
  UPDATE review_responses SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;
