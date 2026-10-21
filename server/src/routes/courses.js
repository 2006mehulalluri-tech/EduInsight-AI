import { Router } from 'express'
import { authenticate, requireRoles } from '../middleware/auth.js'
import {
  assignFacultyToCourse,
  createCourse,
  getCourseById,
  listCourses,
} from '../repositories/courses.js'
import { getQuestionsForCourse } from '../repositories/questions.js'

const router = Router()

// List courses (students see all available; faculty see theirs; admin sees all)
router.get('/', authenticate, (request, response) => {
  try {
    const filters = {}
    if (request.auth.role === 'faculty') {
      filters.facultyUserId = request.auth.id
    }
    if (request.auth.role === 'student') {
      filters.studentUserId = request.auth.id
    }
    if (request.query.department) {
      filters.department = request.query.department
    }

    const courses = listCourses(filters)
    return response.json({ courses })
  } catch (err) {
    return response.status(500).json({
      error: 'courses_fetch_failed',
      message: err.message,
    })
  }
})

// Get single course details
router.get('/:id', authenticate, (request, response) => {
  try {
    const courseId = Number(request.params.id)
    const studentUserId = request.auth.role === 'student' ? request.auth.id : null
    const course = getCourseById(courseId, studentUserId)
    if (!course) {
      return response.status(404).json({ error: 'course_not_found', message: 'Course not found' })
    }
    return response.json({ course })
  } catch (err) {
    return response.status(500).json({ error: 'course_fetch_failed', message: err.message })
  }
})

// Get questions for this course questionnaire
router.get('/:id/questions', authenticate, (request, response) => {
  try {
    const courseId = Number(request.params.id)
    const questions = getQuestionsForCourse(courseId)
    return response.json({ course_id: courseId, questions })
  } catch (err) {
    return response.status(500).json({ error: 'questions_fetch_failed', message: err.message })
  }
})

// Admin: Create new course
router.post('/', authenticate, requireRoles('administrator'), (request, response) => {
  try {
    const { code, title, department, academic_year, academic_term, faculty_id } = request.body
    if (!code || !title) {
      return response.status(400).json({ error: 'validation_error', message: 'Course code and title are required.' })
    }

    const course = createCourse({
      code: code.trim().toUpperCase(),
      title: title.trim(),
      department: department?.trim(),
      academic_year: academic_year?.trim(),
      academic_term: academic_term?.trim(),
      created_by: request.auth.id,
    })

    if (faculty_id) {
      assignFacultyToCourse(course.id, Number(faculty_id))
    }

    return response.status(201).json({ course: getCourseById(course.id) })
  } catch (err) {
    return response.status(500).json({ error: 'course_creation_failed', message: err.message })
  }
})

export default router
