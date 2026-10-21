import { getDatabase } from '../db/connection.js'

export function findUserByEmail(email) {
  return getDatabase()
    .prepare(
      `SELECT id, email, password, password AS password_hash, role, status, first_name, last_name,
              enrollment_number, created_at, updated_at, last_login_at
         FROM users
        WHERE email = ? COLLATE NOCASE`,
    )
    .get(email)
}

export function findUserById(id) {
  return getDatabase()
    .prepare(
      `SELECT id, email, role, status, first_name, last_name, enrollment_number,
              created_at, updated_at, last_login_at
         FROM users
        WHERE id = ?`,
    )
    .get(id)
}

export function createUser({
  email,
  password,
  passwordHash,
  role,
  firstName = null,
  lastName = null,
  enrollmentNumber = null,
}) {
  const plainPassword = password ?? passwordHash
  const result = getDatabase()
    .prepare(
      `INSERT INTO users
         (email, password, role, first_name, last_name, enrollment_number)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(email, plainPassword, role, firstName, lastName, enrollmentNumber)

  return findUserById(Number(result.lastInsertRowid))
}

export function updateUserLastLogin(id) {
  getDatabase()
    .prepare('UPDATE users SET last_login_at = ? WHERE id = ?')
    .run(new Date().toISOString(), id)
}

export function toPublicUser(user) {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    status: user.status,
    firstName: user.first_name,
    lastName: user.last_name,
    enrollmentNumber: user.enrollment_number,
  }
}

export function listUsers(role = null) {
  const db = getDatabase()
  let sql = `
    SELECT u.id, u.email, u.password, u.role, u.status, u.first_name, u.last_name,
           u.enrollment_number, u.created_at, u.last_login_at,
           f.employee_id, f.department, f.title
      FROM users u
      LEFT JOIN faculty f ON f.user_id = u.id
  `
  const params = []
  if (role) {
    sql += ` WHERE u.role = ?`
    params.push(role)
  }
  sql += ` ORDER BY u.id DESC`
  return db.prepare(sql).all(...params).map((row) => ({
    id: row.id,
    email: row.email,
    password: row.password,
    role: row.role,
    status: row.status,
    firstName: row.first_name,
    lastName: row.last_name,
    enrollmentNumber: row.enrollment_number,
    employeeId: row.employee_id,
    department: row.department,
    title: row.title,
    createdAt: row.created_at,
    lastLoginAt: row.last_login_at,
  }))
}

export function listFacultyMembers() {
  const db = getDatabase()
  return db
    .prepare(
      `SELECT f.id AS faculty_id, f.employee_id, f.department, f.title,
        u.id AS user_id, u.email, u.first_name, u.last_name,
        COUNT(DISTINCT cf.course_id) AS assigned_courses_count
       FROM faculty f
       JOIN users u ON u.id = f.user_id
       LEFT JOIN course_faculty cf ON cf.faculty_id = f.id
       GROUP BY f.id
       ORDER BY u.first_name ASC`,
    )
    .all()
}
