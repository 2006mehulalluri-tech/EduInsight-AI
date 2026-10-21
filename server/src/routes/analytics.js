import { Router } from 'express'
import { authenticate, requireRoles } from '../middleware/auth.js'
import { getConfidenceAwareAnalytics } from '../repositories/analytics.js'

const router = Router()

// Confidence-aware analytics filtered by RRI threshold
router.get('/', authenticate, requireRoles('faculty', 'administrator'), (request, response) => {
  try {
    const threshold = request.query.threshold !== undefined ? Number(request.query.threshold) : 0
    const courseId = request.query.course_id ? Number(request.query.course_id) : undefined

    const filters = {
      rri_threshold: threshold,
      course_id: courseId,
    }

    if (request.auth.role === 'faculty') {
      filters.facultyUserId = request.auth.id
    }

    const analytics = getConfidenceAwareAnalytics(filters)
    return response.json(analytics)
  } catch (err) {
    console.error('Analytics computation error:', err)
    return response.status(500).json({
      error: 'analytics_failed',
      message: err.message,
    })
  }
})

export default router
