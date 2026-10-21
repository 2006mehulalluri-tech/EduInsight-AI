import { Router } from 'express'
import { getDatabase } from '../db/connection.js'
import { authenticate, requireRoles } from '../middleware/auth.js'
import { getQuestionById, getQuestionsForCourse, listAllQuestions, updateQuestionExpectedTime } from '../repositories/questions.js'
import { getConfigurationAuditHistory, recordConfigurationAudit } from '../repositories/recommendations.js'
import { submitReview } from '../repositories/reviews.js'
import { getEvaluationSettings, getRriWeights, saveEvaluationSettings, saveRriWeights } from '../repositories/settings.js'
import { createUser, findUserByEmail, listFacultyMembers, listUsers } from '../repositories/users.js'
import { recommendationService } from '../services/recommendation/index.js'
import { parseCsv } from '../utils/csv.js'

const router = Router()

// Protect all admin endpoints with authentication and administrator role check
router.use(authenticate, requireRoles('administrator'))


// List all users
router.get('/users', (request, response) => {
  try {
    const users = listUsers(request.query.role || null)
    return response.json({ users })
  } catch (err) {
    return response.status(500).json({ error: 'users_fetch_failed', message: err.message })
  }
})

// Create user
router.post('/users', async (request, response) => {
  try {
    const {
      email,
      password,
      role,
      firstName,
      lastName,
      enrollmentNumber,
      department,
      title,
      employeeId,
    } = request.body

    if (!email || !password || !role) {
      return response.status(400).json({
        error: 'validation_error',
        message: 'email, password, and role are required.',
      })
    }

    const validRoles = ['student', 'faculty', 'administrator']
    if (!validRoles.includes(role)) {
      return response.status(400).json({
        error: 'invalid_role',
        message: `Role must be one of: ${validRoles.join(', ')}`,
      })
    }

    const cleanEmail = email.trim().toLowerCase()
    const existing = findUserByEmail(cleanEmail)
    if (existing) {
      return response.status(409).json({
        error: 'user_exists',
        message: 'A user with this email already exists.',
      })
    }

    const user = createUser({
      email: cleanEmail,
      password: String(password).trim(),
      role,
      firstName: firstName?.trim() || null,
      lastName: lastName?.trim() || null,
      enrollmentNumber: role === 'student' ? enrollmentNumber?.trim() || null : null,
    })

    if (role === 'faculty') {
      const db = getDatabase()
      const empId = employeeId?.trim() || `EMP${1000 + user.id}`
      const dept = department?.trim() || 'SCOPE - Computer Science & Engineering'
      const facultyTitle = title?.trim() || 'Assistant Professor'

      db.prepare(
        `INSERT INTO faculty (user_id, employee_id, department, title)
         VALUES (?, ?, ?, ?)`
      ).run(user.id, empId, dept, facultyTitle)
    }

    return response.status(201).json({
      user: {
        ...user,
        password: String(password).trim(),
      },
    })
  } catch (err) {
    return response.status(500).json({ error: 'user_creation_failed', message: err.message })
  }
})

// List faculty
router.get('/faculty', (request, response) => {
  try {
    const faculty = listFacultyMembers()
    return response.json({ faculty })
  } catch (err) {
    return response.status(500).json({ error: 'faculty_fetch_failed', message: err.message })
  }
})

// List questions
router.get('/questions', (request, response) => {
  try {
    const questions = listAllQuestions()
    return response.json({ questions })
  } catch (err) {
    return response.status(500).json({ error: 'questions_fetch_failed', message: err.message })
  }
})

// Update expected response time (ms) for a question
router.put('/questions/:id/expected-time', (request, response) => {
  try {
    const questionId = Number(request.params.id)
    const expectedTimeMs = Number(request.body.expected_response_time_ms)

    if (!Number.isInteger(expectedTimeMs) || expectedTimeMs < 1000) {
      return response.status(400).json({
        error: 'validation_error',
        message: 'expected_response_time_ms must be an integer of at least 1000ms (1 second).',
      })
    }

    const updated = updateQuestionExpectedTime(questionId, expectedTimeMs)
    return response.json({ question: updated })
  } catch (err) {
    return response.status(500).json({ error: 'question_update_failed', message: err.message })
  }
})

// Get current RRI weights
router.get('/settings/weights', (request, response) => {
  try {
    const weights = getRriWeights()
    return response.json({ weights })
  } catch (err) {
    return response.status(500).json({ error: 'weights_fetch_failed', message: err.message })
  }
})

router.post('/demo/reset-student-reviews', (request, response) => {
  try {
    const db = getDatabase()
    const demoStudent = db
      .prepare("SELECT id, email FROM users WHERE email = ? COLLATE NOCASE")
      .get('student@local.test')

    if (!demoStudent) {
      return response.status(404).json({
        error: 'demo_student_not_found',
        message: 'The demo student account was not found.',
      })
    }

    const result = db
      .prepare('DELETE FROM reviews WHERE student_id = ?')
      .run(demoStudent.id)

    return response.json({
      success: true,
      message: 'Demo student review submissions were reset successfully.',
      deletedCount: result.changes || 0,
    })
  } catch (err) {
    return response.status(500).json({
      error: 'demo_reset_failed',
      message: err.message || 'Failed to reset demo student reviews.',
    })
  }
})

// Save RRI weights
router.put('/settings/weights', (request, response) => {
  try {
    const weights = request.body.weights
    if (!weights || typeof weights !== 'object') {
      return response.status(400).json({
        error: 'validation_error',
        message: 'Weights object is required.',
      })
    }

    const updated = saveRriWeights(weights, request.auth.id)
    return response.json({
      message: 'RRI weights updated successfully.',
      weights: updated,
    })
  } catch (err) {
    return response.status(400).json({ error: 'weights_update_failed', message: err.message })
  }
})

// CSV Import: Step 1 & 2 - Parse, Preview, and Validate
router.post('/import/preview', (request, response) => {
  try {
    const { csv_data } = request.body
    if (!csv_data || typeof csv_data !== 'string') {
      return response.status(400).json({
        error: 'missing_data',
        message: 'csv_data string is required.',
      })
    }

    const rawRecords = parseCsv(csv_data)
    if (rawRecords.length === 0) {
      return response.status(400).json({
        error: 'empty_csv',
        message: 'No data rows found in CSV. Please check formatting and headers.',
      })
    }

    const db = getDatabase()
    const allCourses = db.prepare('SELECT id, code, title FROM courses').all()
    const courseCodeMap = new Map(allCourses.map((c) => [c.code.toUpperCase(), c]))

    const previewRows = []
    const validationErrors = []

    for (const record of rawRecords) {
      const rowNum = record._rowNumber
      const errors = []

      const courseCode = (record.course_code || record.course || '').trim().toUpperCase()
      const course = courseCodeMap.get(courseCode)
      if (!course) {
        errors.push(`Course '${courseCode || '(empty)'}' does not exist in database.`)
      }

      // Check rating
      const ratingVal = Number(record.average_rating || record.rating || record.rating_1 || 4)
      if (Number.isNaN(ratingVal) || ratingVal < 1 || ratingVal > 5) {
        errors.push(`Rating must be a number between 1 and 5. Got '${record.rating || record.average_rating}'.`)
      }

      // Check response time
      const responseTime = Number(record.response_time_ms || record.total_duration_ms || 35000)
      if (Number.isNaN(responseTime) || responseTime < 500) {
        errors.push(`Response time must be at least 500ms. Got '${record.response_time_ms}'.`)
      }

      const isValid = errors.length === 0

      if (!isValid) {
        validationErrors.push({ rowNumber: rowNum, errors })
      }

      previewRows.push({
        rowNumber: rowNum,
        courseCode,
        courseTitle: course ? course.title : 'Unknown',
        rating: ratingVal,
        responseTimeMs: responseTime,
        comment: record.open_feedback || record.comment || record.comments || '',
        answerChanges: Number(record.answer_changes || 0),
        questionRevisits: Number(record.question_revisits || record.revisits || 0),
        isValid,
        errors,
      })
    }

    return response.json({
      totalRows: previewRows.length,
      validRowsCount: previewRows.filter((r) => r.isValid).length,
      invalidRowsCount: validationErrors.length,
      preview: previewRows.slice(0, 50),
      validationErrors,
    })
  } catch (err) {
    return response.status(500).json({ error: 'preview_failed', message: err.message })
  }
})

// CSV Import: Step 3 - Commit valid records to SQLite
router.post('/import/commit', async (request, response) => {
  try {
    const { valid_records } = request.body
    if (!Array.isArray(valid_records) || valid_records.length === 0) {
      return response.status(400).json({
        error: 'missing_records',
        message: 'Array of valid_records is required.',
      })
    }

    const db = getDatabase()
    const allCourses = db.prepare('SELECT id, code FROM courses').all()
    const courseCodeMap = new Map(allCourses.map((c) => [c.code.toUpperCase(), c]))

    // Find or create synthetic student for imports
    let importStudent = db
      .prepare("SELECT id FROM users WHERE email = 'import.student@local.test'")
      .get()
    if (!importStudent) {
      importStudent = createUser({
        email: 'import.student@local.test',
        password: 'ImportPass123!',
        role: 'student',
        firstName: 'Imported',
        lastName: 'Student',
        enrollmentNumber: 'STU-IMPORT-CSV',
      })
    }

    let importedCount = 0

    for (const item of valid_records) {
      const course = courseCodeMap.get((item.courseCode || '').toUpperCase())
      if (!course) continue

      const questions = getQuestionsForCourse(course.id)
      if (questions.length === 0) continue

      const ratingVal = Math.min(5, Math.max(1, Number(item.rating) || 4))
      const timeMs = Number(item.responseTimeMs) || 45000
      const changes = Number(item.answerChanges) || 0
      const revisits = Number(item.questionRevisits) || 0
      const timePerQ = Math.round(timeMs / questions.length)

      const responses = questions.map((q, idx) => {
        const isRating = q.question_type === 'rating'
        // Add realistic slight variation to ratings
        const variedRating = isRating
          ? Math.min(5, Math.max(1, Math.round(ratingVal + (Math.random() > 0.6 ? (Math.random() > 0.5 ? 1 : -1) : 0))))
          : null

        return {
          question_id: q.id,
          question_type: q.question_type,
          prompt: q.prompt,
          expected_response_time_ms: q.expected_response_time_ms,
          time_on_question_ms: timePerQ,
          change_count: idx === 0 ? changes : 0,
          revisit_count: idx === 0 ? revisits : 0,
          answer: isRating ? variedRating : (item.comment || 'Good course delivery and coverage.'),
        }
      })

      submitReview({
        course_id: course.id,
        student_id: importStudent.id,
        started_at: new Date(Date.now() - timeMs).toISOString(),
        submitted_at: new Date().toISOString(),
        total_duration_ms: timeMs,
        responses,
        is_demo: 1,
      })

      importedCount++
    }

    return response.json({
      success: true,
      message: `Successfully imported ${importedCount} review records into SQLite.`,
      importedCount,
    })
  } catch (err) {
    console.error('Import commit error:', err)
    return response.status(500).json({ error: 'import_failed', message: err.message })
  }
})

export default router
