import { getDatabase } from '../db/connection.js'
import { calculateRRI } from '../services/rri-engine.js'
import { analyzeSentiment } from '../services/sentiment.js'
import { normalizeQuestionDurations } from '../services/telemetry.js'
import { getRriWeights } from './settings.js'

/**
 * Submits a new review with full question-level behavioral tracking,
 * calculates explainable RRI and independent sentiment analysis,
 * and persists to SQLite.
 */
export function submitReview({
  course_id,
  student_id,
  started_at = new Date().toISOString(),
  submitted_at = new Date().toISOString(),
  total_duration_ms = null,
  client_timezone = null,
  responses = [],
  is_demo = 0,
}) {
  const db = getDatabase()

  // Load question metadata to ensure expected_response_time_ms is accurate
  const questionsInDb = db
    .prepare('SELECT id, prompt, question_type, expected_response_time_ms FROM questions WHERE course_id = ?')
    .all(course_id)

  const questionMap = new Map(questionsInDb.map((q) => [q.id, q]))

  // Enrich responses with DB expected times and types
  const enrichedResponses = responses.map((r) => {
    const qMeta = questionMap.get(r.question_id) || {}
    return {
      ...r,
      prompt: qMeta.prompt || r.prompt || '',
      question_type: qMeta.question_type || r.question_type || 'rating',
      expected_response_time_ms:
        qMeta.expected_response_time_ms || r.expected_response_time_ms || 10000,
    }
  })

  // Extract open-text comments for sentiment analysis
  const textComments = enrichedResponses
    .filter((r) => r.question_type === 'text' && typeof r.answer === 'string' && r.answer.trim().length > 0)
    .map((r) => r.answer.trim())

  // Sentiment analysis (STRICTLY INDEPENDENT from RRI)
  const sentimentResult = analyzeSentiment(textComments)

  // Calculate RRI using current system weights
  const customWeights = getRriWeights()
  const rawRriResult = calculateRRI(enrichedResponses, customWeights)
  const finalDurationMs = Number(total_duration_ms) > 0 ? Number(total_duration_ms) : rawRriResult.total_duration_ms
  const normalizedResponses = normalizeQuestionDurations(enrichedResponses, finalDurationMs)
  const rriResult = calculateRRI(normalizedResponses, customWeights)

  // Calculate average rating
  const ratings = enrichedResponses
    .filter((r) => r.question_type === 'rating' && r.answer !== null && r.answer !== undefined)
    .map((r) => Number(r.answer))
    .filter((n) => !Number.isNaN(n) && n >= 1 && n <= 5)

  const averageRating =
    ratings.length > 0
      ? Number((ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(2))
      : null

  // Check if review already submitted by this student for this course (Single-Submission Lock)
  const existingSubmitted = db
    .prepare(
      `SELECT id, submitted_at FROM reviews 
       WHERE course_id = ? AND student_id = ?`,
    )
    .get(course_id, student_id)

  if (existingSubmitted) {
    const err = new Error('Review already submitted for this course.')
    err.code = 'ALREADY_SUBMITTED'
    err.statusCode = 409
    throw err
  }

  // Determine review_number for this student and course
  const existingReview = db
    .prepare(
      `SELECT MAX(review_number) AS max_num FROM reviews 
       WHERE course_id = ? AND student_id = ?`,
    )
    .get(course_id, student_id)
  const reviewNumber = (existingReview?.max_num || 0) + 1

  let createdReviewId = null

  // Transaction to persist review, responses, and metrics atomically
  const submitTx = db.transaction(() => {
    const reviewInsert = db
      .prepare(
        `INSERT INTO reviews (
          course_id,
          student_id,
          review_number,
          status,
          started_at,
          submitted_at,
          total_duration_ms,
          client_timezone,
          rri_score,
          sentiment_label,
          sentiment_score,
          average_rating,
          is_demo
        ) VALUES (?, ?, ?, 'submitted', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        course_id,
        student_id,
        reviewNumber,
        started_at,
        submitted_at,
        finalDurationMs,
        client_timezone,
        rriResult.rri,
        sentimentResult.label,
        sentimentResult.comparative,
        averageRating,
        is_demo,
      )

    createdReviewId = reviewInsert.lastInsertRowid

    // Insert review responses
    const responseStmt = db.prepare(
      `INSERT INTO review_responses (
        review_id,
        question_id,
        answer_json,
        first_answered_at,
        last_answered_at,
        time_on_question_ms,
        view_count,
        change_count,
        revisit_count
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )

    for (const r of normalizedResponses) {
      responseStmt.run(
        createdReviewId,
        r.question_id,
        JSON.stringify(r.answer),
        r.entered_at || started_at,
        r.answered_at || submitted_at,
        r.time_on_question_ms || 0,
        r.view_count || (r.revisit_count ? r.revisit_count + 1 : 1),
        r.change_count || 0,
        r.revisit_count || 0,
      )
    }

    // Insert behavioral metrics
    db.prepare(
      `INSERT INTO behavioral_metrics (
        review_id,
        total_duration_ms,
        average_question_time_ms,
        answer_change_count,
        revisit_count,
        long_pause_count,
        rapid_response_count,
        time_score,
        time_variance_score,
        rush_score,
        reflection_score,
        behavioral_consistency_score,
        response_consistency_score,
        answer_changes_score,
        question_revisits_score,
        breakdown_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      createdReviewId,
      finalDurationMs,
      rriResult.average_question_time_ms,
      rriResult.answer_change_count,
      rriResult.revisit_count,
      0,
      rriResult.rapid_response_count,
      rriResult.components.time_score,
      rriResult.components.time_variance,
      rriResult.components.rush_score,
      rriResult.components.reflection_score,
      rriResult.components.behavioral_consistency,
      rriResult.components.response_consistency,
      rriResult.components.answer_changes,
      rriResult.components.question_revisits,
      JSON.stringify({
        components: rriResult.components,
        weights: rriResult.weights,
        reasons: rriResult.reasons,
        sentiment: sentimentResult,
      }),
    )
  })

  submitTx()

  return getReviewById(createdReviewId)
}

/**
 * Retrieves full details for an individual review, with student anonymization for faculty.
 */
export function getReviewById(reviewId, options = {}) {
  const db = getDatabase()
  const review = db
    .prepare(
      `SELECT 
        r.*,
        c.code AS course_code,
        c.title AS course_title,
        c.department AS course_department,
        u.first_name AS student_first_name,
        u.last_name AS student_last_name,
        u.enrollment_number AS student_enrollment_number
       FROM reviews r
       JOIN courses c ON c.id = r.course_id
       JOIN users u ON u.id = r.student_id
       WHERE r.id = ?`,
    )
    .get(reviewId)

  if (!review) return null

  // Fetch responses with question prompt and timing
  const responses = db
    .prepare(
      `SELECT 
        rr.*,
        q.prompt,
        q.question_type,
        q.category,
        q.expected_response_time_ms,
        q.position
       FROM review_responses rr
       JOIN questions q ON q.id = rr.question_id
       WHERE rr.review_id = ?
       ORDER BY q.position ASC`,
    )
    .all(reviewId)
    .map((r) => {
      let parsedAnswer = r.answer_json
      try {
        parsedAnswer = JSON.parse(r.answer_json)
      } catch {
        // keep string
      }
      return {
        ...r,
        answer: parsedAnswer,
      }
    })

  // Fetch behavioral metrics
  const metrics = db
    .prepare('SELECT * FROM behavioral_metrics WHERE review_id = ?')
    .get(reviewId)

  let breakdown = null
  if (metrics?.breakdown_json) {
    try {
      breakdown = JSON.parse(metrics.breakdown_json)
    } catch {
      breakdown = null
    }
  }

  // Student Anonymization Safeguard:
  // Faculty must NOT see student personal information
  const isFaculty = options.userRole === 'faculty'
  const studentInfo = isFaculty
    ? {
        student_id: `STUDENT-${String(review.student_id).padStart(4, '0')}`,
        student_name: 'Anonymous Student',
        student_enrollment_number: 'REDACTED',
      }
    : {
        student_id: review.student_id,
        student_name: `${review.student_first_name || ''} ${review.student_last_name || ''}`.trim(),
        student_enrollment_number: review.student_enrollment_number,
      }

  return {
    id: review.id,
    course_id: review.course_id,
    course_code: review.course_code,
    course_title: review.course_title,
    course_department: review.course_department,
    status: review.status,
    started_at: review.started_at,
    submitted_at: review.submitted_at,
    total_duration_ms: review.total_duration_ms,
    rri_score: review.rri_score,
    sentiment_label: review.sentiment_label,
    sentiment_score: review.sentiment_score,
    average_rating: review.average_rating,
    is_demo: review.is_demo,
    student: studentInfo,
    responses,
    metrics: metrics
      ? {
          total_duration_ms: metrics.total_duration_ms,
          average_question_time_ms: metrics.average_question_time_ms,
          answer_change_count: metrics.answer_change_count,
          revisit_count: metrics.revisit_count,
          rapid_response_count: metrics.rapid_response_count,
          time_score: metrics.time_score,
          time_variance_score: metrics.time_variance_score,
          rush_score: metrics.rush_score,
          reflection_score: metrics.reflection_score,
          behavioral_consistency_score: metrics.behavioral_consistency_score,
          response_consistency_score: metrics.response_consistency_score,
          answer_changes_score: metrics.answer_changes_score,
          question_revisits_score: metrics.question_revisits_score,
          breakdown,
        }
      : null,
  }
}

/**
 * Lists reviews with filtering (course, RRI threshold, sentiment, search).
 */
export function listReviews(filters = {}, options = {}) {
  const db = getDatabase()
  let sql = `
    SELECT 
      r.id,
      r.course_id,
      c.code AS course_code,
      c.title AS course_title,
      r.rri_score,
      r.sentiment_label,
      r.sentiment_score,
      r.average_rating,
      r.total_duration_ms,
      r.submitted_at,
      r.is_demo,
      bm.rapid_response_count,
      bm.answer_change_count,
      bm.revisit_count,
      u.first_name AS student_first_name,
      u.last_name AS student_last_name,
      u.enrollment_number AS student_enrollment_number
    FROM reviews r
    JOIN courses c ON c.id = r.course_id
    JOIN users u ON u.id = r.student_id
    LEFT JOIN behavioral_metrics bm ON bm.review_id = r.id
    WHERE r.status = 'submitted'
  `
  const params = []

  if (filters.course_id) {
    sql += ` AND r.course_id = ?`
    params.push(filters.course_id)
  }

  if (filters.facultyUserId) {
    sql += ` AND r.course_id IN (
      SELECT cf.course_id FROM course_faculty cf
      JOIN faculty f ON f.id = cf.faculty_id
      WHERE f.user_id = ?
    )`
    params.push(filters.facultyUserId)
  }

  if (filters.rri_threshold !== undefined && filters.rri_threshold !== null && filters.rri_threshold !== '') {
    sql += ` AND r.rri_score >= ?`
    params.push(Number(filters.rri_threshold))
  }

  if (filters.sentiment_label) {
    sql += ` AND r.sentiment_label = ?`
    params.push(filters.sentiment_label)
  }

  if (filters.min_rating) {
    sql += ` AND r.average_rating >= ?`
    params.push(Number(filters.min_rating))
  }

  if (filters.search) {
    sql += ` AND (c.code LIKE ? OR c.title LIKE ?)`
    const term = `%${filters.search}%`
    params.push(term, term)
  }

  sql += ` ORDER BY r.submitted_at DESC`

  const limit = Math.min(200, Number(filters.limit) || 100)
  const offset = Math.max(0, Number(filters.offset) || 0)
  sql += ` LIMIT ? OFFSET ?`
  params.push(limit, offset)

  const rows = db.prepare(sql).all(...params)

  const isFaculty = options.userRole === 'faculty'

  return rows.map((row) => ({
    id: row.id,
    course_id: row.course_id,
    course_code: row.course_code,
    course_title: row.course_title,
    rri_score: row.rri_score,
    sentiment_label: row.sentiment_label,
    sentiment_score: row.sentiment_score,
    average_rating: row.average_rating,
    total_duration_ms: row.total_duration_ms,
    submitted_at: row.submitted_at,
    is_demo: row.is_demo,
    rapid_response_count: row.rapid_response_count,
    answer_change_count: row.answer_change_count,
    revisit_count: row.revisit_count,
    student_display: isFaculty
      ? `Student #${row.id}`
      : `${row.student_first_name || ''} ${row.student_last_name || ''}`.trim() || `Student #${row.id}`,
  }))
}

/**
 * Retrieves a student's own submitted review for a specific course,
 * including question responses and metrics for read-only viewing.
 */
export function getStudentReviewForCourse(courseId, studentId) {
  const db = getDatabase()
  const review = db
    .prepare(
      `SELECT id FROM reviews 
       WHERE course_id = ? AND student_id = ? 
       ORDER BY id DESC LIMIT 1`,
    )
    .get(courseId, studentId)

  if (!review) return null

  return getReviewById(review.id, { userRole: 'student' })
}

