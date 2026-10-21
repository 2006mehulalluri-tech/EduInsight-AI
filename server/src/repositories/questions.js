import { getDatabase } from '../db/connection.js'

export function getQuestionsForCourse(courseId) {
  const db = getDatabase()
  return db
    .prepare(
      `SELECT 
        id,
        course_id,
        position,
        prompt,
        question_type,
        required,
        category,
        section,
        expected_response_time_ms,
        metadata_json
       FROM questions
       WHERE course_id = ?
       ORDER BY position ASC`,
    )
    .all(courseId)
}

export function listAllQuestions() {
  const db = getDatabase()
  return db
    .prepare(
      `SELECT 
        q.id,
        q.course_id,
        c.code AS course_code,
        c.title AS course_title,
        q.position,
        q.prompt,
        q.question_type,
        q.required,
        q.category,
        q.expected_response_time_ms,
        q.metadata_json
       FROM questions q
       LEFT JOIN courses c ON c.id = q.course_id
       ORDER BY q.course_id ASC, q.position ASC`,
    )
    .all()
}

export function getQuestionById(questionId) {
  const db = getDatabase()
  return db
    .prepare(
      `SELECT q.*, c.code AS course_code, c.title AS course_title
       FROM questions q
       LEFT JOIN courses c ON c.id = q.course_id
       WHERE q.id = ?`,
    )
    .get(questionId)
}

export function updateQuestionExpectedTime(questionId, expectedTimeMs) {
  const db = getDatabase()
  db.prepare(
    `UPDATE questions
     SET expected_response_time_ms = ?
     WHERE id = ?`,
  ).run(expectedTimeMs, questionId)

  return db.prepare('SELECT * FROM questions WHERE id = ?').get(questionId)
}


export function createQuestion({
  course_id,
  position,
  prompt,
  question_type = 'rating',
  required = 1,
  category = 'Theory',
  expected_response_time_ms = 10000,
  metadata_json = null,
  created_by = null,
}) {
  const db = getDatabase()
  const result = db
    .prepare(
      `INSERT INTO questions 
        (course_id, position, prompt, question_type, required, category, expected_response_time_ms, metadata_json, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      course_id,
      position,
      prompt,
      question_type,
      required,
      category,
      expected_response_time_ms,
      metadata_json,
      created_by,
    )

  return db.prepare('SELECT * FROM questions WHERE id = ?').get(result.lastInsertRowid)
}
