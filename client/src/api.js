const apiBase = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '')
const fallbackApiBase = 'http://localhost:5000'

let authToken = localStorage.getItem('crq_token') || null

export function setAuthToken(token) {
  authToken = token
  if (token) {
    localStorage.setItem('crq_token', token)
  } else {
    localStorage.removeItem('crq_token')
  }
}

export function getAuthToken() {
  return authToken
}

async function request(endpoint, options = {}, attempt = 0) {
  const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`
  const targets = [
    `${apiBase}${normalizedEndpoint}`,
    ...(apiBase === '/api'
      ? [
          `${fallbackApiBase}/api${normalizedEndpoint}`,
          `${fallbackApiBase}${normalizedEndpoint}`,
        ]
      : []),
  ]

  const url = targets[Math.min(attempt, targets.length - 1)]

  const headers = {
    Accept: 'application/json',
    ...(options.headers || {}),
  }

  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`
  }

  if (options.body && typeof options.body === 'object' && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json'
    options.body = JSON.stringify(options.body)
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers,
      credentials: 'include',
    })

    if (!response.ok) {
      const isUpstreamIssue = [502, 503, 504].includes(response.status)
      const hasFallbackTarget = attempt < targets.length - 1

      if (isUpstreamIssue && hasFallbackTarget) {
        return request(endpoint, options, attempt + 1)
      }

      let errorData = {}
      try {
        const contentType = response.headers.get('content-type') || ''
        if (contentType.includes('application/json')) {
          errorData = await response.json()
        }
      } catch {
        // Non-JSON or empty upstream response.
      }

      const message =
        errorData.message ||
        ([502, 503, 504].includes(response.status)
          ? 'The backend server is temporarily unavailable. Please make sure the server is running on http://localhost:5000.'
          : `Request failed with status ${response.status}`)

      const error = new Error(message)
      error.status = response.status
      error.code = errorData.error
      throw error
    }

    return response.json()
  } catch (error) {
    if (attempt < targets.length - 1 && !error.status) {
      return request(endpoint, options, attempt + 1)
    }

    if (
      !error.status &&
      (error.name === 'TypeError' ||
        (error.message && error.message.toLowerCase().includes('fetch')))
    ) {
      const helpfulError = new Error(
        'Unable to connect to the backend server. Please make sure the server is running on http://localhost:5000.',
      )
      helpfulError.status = 0
      helpfulError.code = 'CONNECTION_FAILED'
      throw helpfulError
    }

    throw error
  }
}

// Health API
export function getHealth() {
  return request('/health')
}

// Auth APIs
export function login(email, password) {
  return request('/auth/login', {
    method: 'POST',
    body: { email, password },
  })
}

export function getMe() {
  return request('/auth/me')
}

export function logout() {
  setAuthToken(null)
  return request('/auth/logout', { method: 'POST' })
}

// Courses APIs
export function getCourses(department = '') {
  const q = department ? `?department=${encodeURIComponent(department)}` : ''
  return request(`/courses${q}`)
}

export function getCourse(id) {
  return request(`/courses/${id}`)
}

export function getCourseQuestions(courseId) {
  return request(`/courses/${courseId}/questions`)
}

export function createCourse(data) {
  return request('/courses', {
    method: 'POST',
    body: data,
  })
}

// Reviews APIs
export function submitReview(payload) {
  return request('/reviews', {
    method: 'POST',
    body: payload,
  })
}

export function getReviews(params = {}) {
  const query = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') {
      query.set(k, v)
    }
  }
  const qs = query.toString() ? `?${query.toString()}` : ''
  return request(`/reviews${qs}`)
}

export function getReviewById(id) {
  return request(`/reviews/${id}`)
}

export function getMySubmission(courseId) {
  return request(`/reviews/my-submission/${courseId}`)
}

// Analytics APIs
export function getAnalytics(threshold = 0, courseId = '') {
  const query = new URLSearchParams()
  if (threshold !== undefined && threshold !== null) {
    query.set('threshold', threshold)
  }
  if (courseId) {
    query.set('course_id', courseId)
  }
  return request(`/analytics?${query.toString()}`)
}

// Admin APIs
export function getAdminUsers(role = '') {
  const q = role ? `?role=${encodeURIComponent(role)}` : ''
  return request(`/admin/users${q}`)
}

export function createAdminUser(data) {
  return request('/admin/users', {
    method: 'POST',
    body: data,
  })
}

export function getAdminFaculty() {
  return request('/admin/faculty')
}

export function getAdminQuestions() {
  return request('/admin/questions')
}

export function updateQuestionExpectedTime(questionId, expectedTimeMs) {
  return request(`/admin/questions/${questionId}/expected-time`, {
    method: 'PUT',
    body: { expected_response_time_ms: expectedTimeMs },
  })
}

export function getRriWeights() {
  return request('/admin/settings/weights')
}

export function resetDemoStudentReviews() {
  return request('/admin/demo/reset-student-reviews', {
    method: 'POST',
  })
}

export function updateRriWeights(weights) {
  return request('/admin/settings/weights', {
    method: 'PUT',
    body: { weights },
  })
}

export function previewCsvImport(csvData) {
  return request('/admin/import/preview', {
    method: 'POST',
    body: { csv_data: csvData },
  })
}

export function commitCsvImport(validRecords) {
  return request('/admin/import/commit', {
    method: 'POST',
    body: { valid_records: validRecords },
  })
}
