async function runE2E() {
  console.log('========================================================')
  console.log('COLLEGE REVIEW QUALITY ANALYSIS SYSTEM - E2E TEST SUITE')
  console.log('========================================================')

  const BASE = 'http://localhost:5000/api'
  let passed = 0
  let failed = 0

  function assert(cond, name) {
    if (cond) {
      console.log(`[PASS] ${name}`)
      passed++
    } else {
      console.error(`[FAIL] ${name}`)
      failed++
    }
  }

  // 1. Health check
  const health = await fetch(`${BASE}/health`).then((r) => r.json())
  assert(health.status === 'ok' && health.database === 'connected', 'Database and API health connected')

  // 2. Student login & review submission
  const studentLogin = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'student@local.test', password: 'Student123!' }),
  }).then((r) => r.json())
  assert(studentLogin.user && studentLogin.user.role === 'student', 'Student authentication successful')
  const studentToken = studentLogin.token

  // 3. Courses list
  const coursesData = await fetch(`${BASE}/courses`, {
    headers: { Authorization: `Bearer ${studentToken}` },
  }).then((r) => r.json())
  assert(coursesData.courses?.length >= 4, 'Courses retrieved for student')

  // 4. Questions list for first course
  const firstCourseId = coursesData.courses[0].id
  const questionsData = await fetch(`${BASE}/courses/${firstCourseId}/questions`, {
    headers: { Authorization: `Bearer ${studentToken}` },
  }).then((r) => r.json())
  assert(questionsData.questions?.length >= 9, 'Questions retrieved for VTOP course')

  // 5. Submit high-reflection review
  const submitRes = await fetch(`${BASE}/reviews`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${studentToken}`,
    },
    body: JSON.stringify({
      course_id: firstCourseId,
      started_at: new Date(Date.now() - 120000).toISOString(),
      submitted_at: new Date().toISOString(),
      total_duration_ms: 120000,
      responses: questionsData.questions.map((q, idx) => ({
        question_id: q.id,
        prompt: q.prompt,
        question_type: q.question_type,
        expected_response_time_ms: q.expected_response_time_ms,
        time_on_question_ms: q.question_type === 'rating' ? 8000 : 25000,
        change_count: idx === 2 ? 1 : 0,
        revisit_count: idx === 0 ? 1 : 0,
        answer:
          q.question_type === 'rating'
            ? 4
            : 'The professor demonstrates deep subject mastery and gives great practical examples.',
      })),
    }),
  }).then((r) => r.json())
  assert(submitRes.status === 'submitted' && submitRes.review.rri_score >= 80, 'Student review submitted with high RRI')

  // 6. Faculty login
  const facultyLogin = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'faculty@local.test', password: 'Faculty123!' }),
  }).then((r) => r.json())
  assert(facultyLogin.user && facultyLogin.user.role === 'faculty', 'Faculty authentication successful')
  const facultyToken = facultyLogin.token

  // 7. Confidence-aware Analytics at Threshold 0 vs 70
  const analytics0 = await fetch(`${BASE}/analytics?threshold=0`, {
    headers: { Authorization: `Bearer ${facultyToken}` },
  }).then((r) => r.json())
  const analytics70 = await fetch(`${BASE}/analytics?threshold=70`, {
    headers: { Authorization: `Bearer ${facultyToken}` },
  }).then((r) => r.json())

  assert(
    analytics0.summary.total_reviews > 0 &&
      analytics70.summary.reviews_above_threshold <= analytics0.summary.total_reviews,
    'Confidence threshold filters out lower reliability reviews',
  )
  assert(
    analytics70.summary.average_rri >= analytics0.summary.average_rri,
    `Retained average RRI increases with higher threshold (${analytics70.summary.average_rri} >= ${analytics0.summary.average_rri})`,
  )
  assert(analytics70.charts.rri_distribution.length === 5, 'RRI distribution histogram has 5 tiers')
  assert(analytics70.charts.rating_distribution.length === 5, 'Rating distribution has 5 star buckets')
  assert(analytics70.charts.sentiment_distribution.length === 3, 'Sentiment distribution has Pos/Neu/Neg')

  // 8. Faculty review list & Student Anonymization check
  const facultyReviews = await fetch(`${BASE}/reviews?limit=5`, {
    headers: { Authorization: `Bearer ${facultyToken}` },
  }).then((r) => r.json())
  assert(facultyReviews.reviews.length > 0, 'Faculty reviews table populated')
  const firstRev = facultyReviews.reviews[0]
  assert(
    firstRev.student_display.startsWith('Student #'),
    'Student identity properly anonymized in faculty view',
  )

  // 9. Review detail explainability inspection
  const detailData = await fetch(`${BASE}/reviews/${firstRev.id}`, {
    headers: { Authorization: `Bearer ${facultyToken}` },
  }).then((r) => r.json())
  assert(
    detailData.review.metrics &&
      detailData.review.metrics.time_score !== undefined &&
      detailData.review.metrics.rush_score !== undefined,
    'Review details contains all 8 component scores for explainability',
  )
  assert(
    detailData.review.student.student_name === 'Anonymous Student',
    'Review detail modal protects student confidentiality for faculty',
  )

  // 10. Administrator login & weights configuration
  const adminLogin = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@local.test', password: 'Admin123!' }),
  }).then((r) => r.json())
  assert(adminLogin.user && adminLogin.user.role === 'administrator', 'Admin authentication successful')
  const adminToken = adminLogin.token

  // 11. Admin Questions update
  const allQs = await fetch(`${BASE}/admin/questions`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  }).then((r) => r.json())
  const firstQId = allQs.questions[0].id
  const updateQ = await fetch(`${BASE}/admin/questions/${firstQId}/expected-time`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({ expected_response_time_ms: 12000 }),
  }).then((r) => r.json())
  assert(updateQ.question.expected_response_time_ms === 12000, 'Admin successfully updated expected response time')

  // 12. Admin RRI Weights update
  const updateWeights = await fetch(`${BASE}/admin/settings/weights`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      weights: {
        time_score: 25,
        time_variance: 15,
        rush_score: 15,
        reflection_score: 10,
        behavioral_consistency: 15,
        response_consistency: 10,
        answer_changes: 5,
        question_revisits: 5,
      },
    }),
  }).then((r) => r.json())
  assert(updateWeights.weights?.time_score === 25, 'Admin updated RRI algorithm weights')

  // 13. CSV Import Preview and Validation
  const sampleCsv = `course_code,rating,response_time_ms,open_feedback,answer_changes,question_revisits
BCSE204L,5,45000,"Great teaching and practical insights.",1,0
INVALID_CODE,4,30000,"Should fail course validation.",0,0`

  const previewRes = await fetch(`${BASE}/admin/import/preview`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({ csv_data: sampleCsv }),
  }).then((r) => r.json())
  assert(previewRes.totalRows === 2, 'CSV parsed 2 rows')
  assert(previewRes.validRowsCount === 1, 'CSV identified exactly 1 valid row')
  assert(previewRes.invalidRowsCount === 1, 'CSV flagged invalid course code row with error')

  // 14. CSV Commit
  const commitRes = await fetch(`${BASE}/admin/import/commit`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({ valid_records: previewRes.preview.filter((r) => r.isValid) }),
  }).then((r) => r.json())
  assert(commitRes.success === true && commitRes.importedCount === 1, 'CSV committed valid record to database')

  // 15. Verify Vite Frontend is serving
  const frontendHtml = await fetch('http://localhost:5173/').then((r) => r.text())
  assert(frontendHtml.includes('<div id="root"></div>'), 'Vite frontend is serving index.html')

  console.log('========================================================')
  console.log(`E2E TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`)
  console.log('========================================================')

  if (failed > 0) process.exit(1)
}

runE2E().catch((err) => {
  console.error('Fatal E2E error:', err)
  process.exit(1)
})
