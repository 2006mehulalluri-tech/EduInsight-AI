import { Router } from 'express'
import { authenticate, requireRoles } from '../middleware/auth.js'
import {
  getReviewById,
  getStudentReviewForCourse,
  listReviews,
  submitReview,
} from '../repositories/reviews.js'

const router = Router()

// Student submits completed review with question-level behavioral tracking
router.post('/', authenticate, requireRoles('student'), (request, response) => {
  try {
    const {
      course_id,
      started_at,
      submitted_at,
      total_duration_ms,
      client_timezone,
      responses,
    } = request.body

    if (!course_id || !Array.isArray(responses) || responses.length === 0) {
      return response.status(400).json({
        error: 'invalid_submission',
        message: 'course_id and a non-empty responses array are required.',
      })
    }

    const courseIdNum = Number(course_id)

    // Upfront check for existing review by this student for this course
    const existing = getStudentReviewForCourse(courseIdNum, request.auth.id)
    if (existing) {
      return response.status(409).json({
        error: 'already_submitted',
        message: 'Review already submitted for this course.',
      })
    }

    const review = submitReview({
      course_id: courseIdNum,
      student_id: request.auth.id,
      started_at,
      submitted_at: submitted_at || new Date().toISOString(),
      total_duration_ms,
      client_timezone,
      responses,
      is_demo: 0,
    })

    return response.status(201).json({
      status: 'submitted',
      message: 'Review successfully submitted.',
      review,
    })
  } catch (err) {
    if (
      err.code === 'ALREADY_SUBMITTED' ||
      err.statusCode === 409 ||
      err.message?.includes('already submitted') ||
      err.message?.includes('UNIQUE constraint failed')
    ) {
      return response.status(409).json({
        error: 'already_submitted',
        message: 'Review already submitted for this course.',
      })
    }
    console.error('Failed to submit review:', err)
    return response.status(500).json({
      error: 'review_submission_failed',
      message: err.message,
    })
  }
})

// Student: Check and get their own submitted review for a course (read-only verification)
router.get('/my-submission/:courseId', authenticate, requireRoles('student'), (request, response) => {
  try {
    const courseId = Number(request.params.courseId)
    const review = getStudentReviewForCourse(courseId, request.auth.id)
    return response.json({
      submitted: !!review,
      review: review || null,
    })
  } catch (err) {
    return response.status(500).json({
      error: 'review_fetch_failed',
      message: err.message,
    })
  }
})

// Faculty & Admin: List reviews with filters
router.get('/', authenticate, requireRoles('faculty', 'administrator'), (request, response) => {
  try {
    const filters = {
      course_id: request.query.course_id ? Number(request.query.course_id) : undefined,
      rri_threshold: request.query.rri_threshold,
      sentiment_label: request.query.sentiment_label,
      min_rating: request.query.min_rating,
      search: request.query.search,
      limit: request.query.limit,
      offset: request.query.offset,
    }

    if (request.auth.role === 'faculty') {
      filters.facultyUserId = request.auth.id
    }

    const reviews = listReviews(filters, { userRole: request.auth.role })
    return response.json({ reviews, count: reviews.length })
  } catch (err) {
    return response.status(500).json({
      error: 'reviews_fetch_failed',
      message: err.message,
    })
  }
})

// Get detailed review by ID (student privacy protected for faculty)
router.get('/:id', authenticate, requireRoles('faculty', 'administrator'), (request, response) => {
  try {
    const reviewId = Number(request.params.id)
    const review = getReviewById(reviewId, { userRole: request.auth.role })

    if (!review) {
      return response.status(404).json({
        error: 'review_not_found',
        message: 'Review not found',
      })
    }

    return response.json({ review })
  } catch (err) {
    return response.status(500).json({
      error: 'review_fetch_failed',
      message: err.message,
    })
  }
})

export default router
