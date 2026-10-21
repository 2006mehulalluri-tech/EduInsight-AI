import { getDatabase } from '../db/connection.js'

export function listCourses(filters = {}) {
  const db = getDatabase()
  let sql = `
    SELECT 
      c.id,
      c.code,
      c.title,
      c.department,
      c.academic_year,
      c.academic_term,
      c.class_nbr,
      c.course_type,
      c.ltpjc,
      c.slot,
      c.venue,
      c.created_at,
      COUNT(DISTINCT r.id) AS review_count,
      ROUND(AVG(r.average_rating), 2) AS average_rating,
      ROUND(AVG(r.rri_score), 1) AS average_rri,
      GROUP_CONCAT(DISTINCT u.first_name || ' ' || u.last_name) AS faculty_names,
      ${filters.studentUserId ? `(SELECT COUNT(1) FROM reviews sr WHERE sr.course_id = c.id AND sr.student_id = ${Number(filters.studentUserId)})` : `0`} AS has_submitted
    FROM courses c
    LEFT JOIN course_faculty cf ON cf.course_id = c.id
    LEFT JOIN faculty f ON f.id = cf.faculty_id
    LEFT JOIN users u ON u.id = f.user_id
    LEFT JOIN reviews r ON r.course_id = c.id AND r.status = 'submitted'
  `
  const params = []
  const conditions = []

  if (filters.department) {
    conditions.push('c.department = ?')
    params.push(filters.department)
  }

  if (filters.facultyUserId) {
    conditions.push('f.user_id = ?')
    params.push(filters.facultyUserId)
  }

  if (conditions.length > 0) {
    sql += ` WHERE ` + conditions.join(' AND ')
  }

  sql += `
    GROUP BY c.id
    ORDER BY c.code ASC
  `

  return db.prepare(sql).all(...params)
}

export function getCourseById(courseId, studentUserId = null) {
  const db = getDatabase()
  const studentSql = studentUserId
    ? `, (SELECT COUNT(1) FROM reviews sr WHERE sr.course_id = c.id AND sr.student_id = ${Number(studentUserId)}) AS has_submitted,
         (SELECT sr.submitted_at FROM reviews sr WHERE sr.course_id = c.id AND sr.student_id = ${Number(studentUserId)} ORDER BY sr.id DESC LIMIT 1) AS submitted_at`
    : `, 0 AS has_submitted, NULL AS submitted_at`

  const course = db
    .prepare(
      `SELECT c.*,
        GROUP_CONCAT(DISTINCT u.first_name || ' ' || u.last_name) AS faculty_names,
        GROUP_CONCAT(DISTINCT f.id) AS faculty_ids
        ${studentSql}
       FROM courses c
       LEFT JOIN course_faculty cf ON cf.course_id = c.id
       LEFT JOIN faculty f ON f.id = cf.faculty_id
       LEFT JOIN users u ON u.id = f.user_id
       WHERE c.id = ?
       GROUP BY c.id`,
    )
    .get(courseId)

  return course || null
}

export function createCourse({ code, title, department, academic_year, academic_term, created_by }) {
  const db = getDatabase()
  const result = db
    .prepare(
      `INSERT INTO courses (code, title, department, academic_year, academic_term, created_by)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(code, title, department, academic_year, academic_term, created_by)

  return getCourseById(result.lastInsertRowid)
}

export function assignFacultyToCourse(courseId, facultyId) {
  const db = getDatabase()
  db.prepare(
    `INSERT OR IGNORE INTO course_faculty (course_id, faculty_id)
     VALUES (?, ?)`,
  ).run(courseId, facultyId)
}
