import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getCourse, getCourseQuestions, getMySubmission, submitReview } from '../../api.js'
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  FileCheck,
  Lock,
  Send,
  ShieldCheck,
  User,
} from 'lucide-react'

export default function ReviewRunner() {
  const { courseId } = useParams()
  const navigate = useNavigate()
  const goToCourseList = () => navigate('/student', { replace: true })

  const [course, setCourse] = useState(null)
  const [questions, setQuestions] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [submittedSuccess, setSubmittedSuccess] = useState(false)
  const [alreadySubmitted, setAlreadySubmitted] = useState(false)
  const [submittedReviewData, setSubmittedReviewData] = useState(null)

  // Answers map: questionId -> answer (number 1-5 or string)
  const [answers, setAnswers] = useState({})

  // SILENT BACKGROUND TELEMETRY (Hidden from student to prevent gamification)
  const startTimeRef = useRef(Date.now())
  const questionFocusTimesRef = useRef({}) // questionId -> timestamp when focused/interacted
  const questionDwellTimesRef = useRef({}) // questionId -> cumulative ms
  const questionChangesRef = useRef({}) // questionId -> count of changes
  const questionRevisitsRef = useRef({}) // questionId -> count of revisits
  const typingDurationsRef = useRef({}) // questionId -> typing ms
  const lastKeyTimeRef = useRef({})

  useEffect(() => {
    let isCurrent = true
    setLoading(true)

    Promise.all([
      getCourse(courseId),
      getCourseQuestions(courseId),
      getMySubmission(courseId).catch(() => ({ submitted: false, review: null })),
    ])
      .then(([courseData, qData, subData]) => {
        if (!isCurrent) return
        setCourse(courseData.course)
        setQuestions(qData.questions || [])

        const isSub = Boolean(courseData.course?.has_submitted || subData?.submitted)
        setAlreadySubmitted(isSub)

        if (isSub && subData?.review) {
          setSubmittedReviewData(subData.review)
          const loadedAnswers = {}
          for (const r of subData.review.responses || []) {
            if (r.answer !== undefined && r.answer !== null) {
              loadedAnswers[r.question_id] = r.answer
            }
          }
          setAnswers(loadedAnswers)
        } else {
          // Initialize silent tracking maps
          startTimeRef.current = Date.now()
          const now = Date.now()
          for (const q of qData.questions || []) {
            questionFocusTimesRef.current[q.id] = now
            questionDwellTimesRef.current[q.id] = 0
            questionChangesRef.current[q.id] = 0
            questionRevisitsRef.current[q.id] = 0
            typingDurationsRef.current[q.id] = 0
          }
        }
      })
      .catch((err) => {
        if (isCurrent) setError(err.message || 'Failed to load evaluation questionnaire')
      })
      .finally(() => {
        if (isCurrent) setLoading(false)
      })

    return () => {
      isCurrent = false
    }
  }, [courseId])

  // Track interaction dwell time silently
  const recordQuestionInteraction = (qId) => {
    if (alreadySubmitted) return
    const now = Date.now()
    const lastFocus = questionFocusTimesRef.current[qId] || now
    const delta = Math.min(60000, Math.max(0, now - lastFocus)) // cap 60s per burst to prevent idle skew
    if (delta > 0 && delta < 15000) {
      questionDwellTimesRef.current[qId] = (questionDwellTimesRef.current[qId] || 0) + delta
    }
    questionFocusTimesRef.current[qId] = now
  }

  // Handle rating selection (Silent telemetry)
  const handleRatingSelect = (qId, val) => {
    if (alreadySubmitted) return
    recordQuestionInteraction(qId)

    const prevVal = answers[qId]
    if (prevVal !== undefined && prevVal !== null) {
      if (prevVal !== val) {
        questionChangesRef.current[qId] = (questionChangesRef.current[qId] || 0) + 1
      }
      questionRevisitsRef.current[qId] = (questionRevisitsRef.current[qId] || 0) + 1
    }

    setAnswers((prev) => ({
      ...prev,
      [qId]: val,
    }))
  }

  // Handle text change (Silent telemetry)
  const handleTextChange = (qId, text) => {
    if (alreadySubmitted) return
    recordQuestionInteraction(qId)

    const now = Date.now()
    const lastKey = lastKeyTimeRef.current[qId]
    if (lastKey && now - lastKey < 3000) {
      typingDurationsRef.current[qId] = (typingDurationsRef.current[qId] || 0) + (now - lastKey)
    }
    lastKeyTimeRef.current[qId] = now

    const prevText = answers[qId] || ''
    if (prevText && Math.abs(text.length - prevText.length) > 5) {
      questionChangesRef.current[qId] = (questionChangesRef.current[qId] || 0) + 1
    }

    setAnswers((prev) => ({
      ...prev,
      [qId]: text,
    }))
  }

  // Submit completed single-page form
  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (alreadySubmitted) {
      setError('Review already submitted for this course.')
      return
    }

    // Validate required questions
    const unansweredRequired = questions.filter(
      (q) => q.required && (answers[q.id] === undefined || answers[q.id] === null || answers[q.id] === ''),
    )

    if (unansweredRequired.length > 0) {
      setError(`Please complete all required evaluation parameters (${unansweredRequired.length} remaining).`)
      window.scrollTo({ top: 300, behavior: 'smooth' })
      return
    }

    setSubmitting(true)

    try {
      const now = Date.now()
      const totalDurationMs = Math.max(5000, now - startTimeRef.current)

      // Convert silent telemetry into review response payloads
      const responsesPayload = questions.map((q) => {
        const trackedDwellMs = Number(questionDwellTimesRef.current[q.id]) || 0
        const dwellTime = Math.max(
          1200,
          Math.min(totalDurationMs, trackedDwellMs > 0 ? trackedDwellMs : Math.round(totalDurationMs / questions.length)),
        )
        const answerVal = answers[q.id]
        const isText = q.question_type === 'text'

        return {
          question_id: q.id,
          prompt: q.prompt,
          question_type: q.question_type,
          expected_response_time_ms: q.expected_response_time_ms || (isText ? 30000 : 10000),
          time_on_question_ms: dwellTime,
          change_count: questionChangesRef.current[q.id] || 0,
          revisit_count: questionRevisitsRef.current[q.id] || 0,
          answer: answerVal !== undefined ? answerVal : null,
          text_metadata: isText
            ? {
                typing_duration_ms: typingDurationsRef.current[q.id] || Math.round(dwellTime * 0.7),
                char_count: typeof answerVal === 'string' ? answerVal.length : 0,
                word_count:
                  typeof answerVal === 'string'
                    ? answerVal.trim().split(/\s+/).filter(Boolean).length
                    : 0,
              }
            : null,
        }
      })

      const payload = {
        course_id: Number(courseId),
        started_at: new Date(startTimeRef.current).toISOString(),
        submitted_at: new Date().toISOString(),
        total_duration_ms: totalDurationMs,
        responses: responsesPayload,
      }

      const res = await submitReview(payload)
      setSubmittedSuccess(true)
      setAlreadySubmitted(true)
      if (res?.review) {
        setSubmittedReviewData(res.review)
      }
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (err) {
      if (
        err.status === 409 ||
        err.code === 'already_submitted' ||
        err.message?.includes('already submitted')
      ) {
        setAlreadySubmitted(true)
        setError('Review already submitted for this course.')
        try {
          const mySub = await getMySubmission(courseId)
          if (mySub?.review) {
            setSubmittedReviewData(mySub.review)
            const ans = {}
            for (const r of mySub.review.responses || []) {
              if (r.answer !== undefined && r.answer !== null) {
                ans[r.question_id] = r.answer
              }
            }
            setAnswers(ans)
          }
        } catch {
          // ignore
        }
      } else {
        setError(err.message || 'Submission failed. Please try again.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="container loading-state">
        <div className="spinner" />
        <p>Loading course evaluation form...</p>
      </div>
    )
  }

  const sectionsMap = new Map()
  for (const q of questions) {
    const sec = q.section || 'FEEDBACK - CLASS WISE'
    if (!sectionsMap.has(sec)) {
      sectionsMap.set(sec, [])
    }
    sectionsMap.get(sec).push(q)
  }

  const sections = Array.from(sectionsMap.entries())

  if (alreadySubmitted && !submittedSuccess) {
    return (
      <div className="container vtop-evaluation-page">
        <div className="vtop-nav-row">
          <button
            type="button"
            className="btn btn-secondary btn-sm back-nav-btn"
            onClick={goToCourseList}
          >
            <ArrowLeft size={16} />
            <span>Back to Registered Courses</span>
          </button>
        </div>

        <div
          className="vtop-already-submitted-card"
          style={{
            background: '#f0fdf4',
            border: '1px solid #86efac',
            borderRadius: '8px',
            padding: '20px 24px',
            marginBottom: '24px',
            boxShadow: '0 2px 8px rgba(16, 185, 129, 0.08)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
            <div
              style={{
                background: '#dcfce7',
                color: '#15803d',
                borderRadius: '50%',
                padding: '10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <CheckCircle2 size={30} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px', flexWrap: 'wrap' }}>
                <span
                  className="badge badge-success"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    fontWeight: 700,
                    fontSize: '0.8125rem',
                    padding: '4px 10px',
                    background: '#16a34a',
                    color: '#ffffff',
                  }}
                >
                  <Lock size={12} />
                  SUBMITTED &bull; READ-ONLY LOCK
                </span>
                <span style={{ fontSize: '0.8125rem', color: '#166534', fontWeight: 600 }}>
                  Single-Submission Rule Enforced
                </span>
              </div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#14532d', margin: '0 0 6px 0' }}>
                Review already submitted for this course.
              </h3>
              <p style={{ color: '#166534', margin: '0 0 14px 0', fontSize: '0.9375rem', lineHeight: 1.5 }}>
                Your feedback evaluation for <strong>{course.code} — {course.title}</strong> was recorded
                {submittedReviewData?.submitted_at || course.submitted_at
                  ? ` on ${new Date(submittedReviewData?.submitted_at || course.submitted_at).toLocaleString()}`
                  : ''}.
                Under institutional evaluation rules, student submissions are final and locked to prevent duplicate entries. All inputs below are displayed in read-only mode, and no further modifications or resubmissions are allowed.
              </p>
              <div>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={goToCourseList}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  <ArrowLeft size={14} />
                  <span>Return to Registered Courses</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="vtop-metadata-panel">
          <div className="vtop-panel-title">
            <span>COURSE REGISTRATION & FACULTY DETAILS</span>
          </div>
          <div className="table-responsive">
            <table className="vtop-meta-table">
              <thead>
                <tr>
                  <th>Class Nbr</th>
                  <th>Course Code</th>
                  <th>Course Title</th>
                  <th>Course Type</th>
                  <th>L-T-P-J-C</th>
                  <th>Slot</th>
                  <th>Venue</th>
                  <th>Faculty Name</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="font-mono text-center font-bold">{course.class_nbr || '1102'}</td>
                  <td className="font-mono font-bold text-primary">{course.code}</td>
                  <td className="font-semibold">{course.title}</td>
                  <td>
                    <span className="badge badge-outline">{course.course_type || 'Theory Only'}</span>
                  </td>
                  <td className="font-mono text-center">{course.ltpjc || '3-0-0-0-3'}</td>
                  <td className="font-mono font-medium">{course.slot || 'A1+TA1'}</td>
                  <td>{course.venue || 'SJT 101'}</td>
                  <td className="faculty-name-bold">{course.faculty_names || 'Faculty Instructor'}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="vtop-instructions-box">
          <h4>General Instructions</h4>
          <ul>
            <li>Please evaluate each parameter on a scale of <strong>1 (Strongly Disagree / Poor)</strong> to <strong>5 (Strongly Agree / Excellent)</strong>.</li>
            <li>Your ratings and comments are strictly confidential and will be analyzed anonymously for institutional quality improvements.</li>
            <li>All rating items are mandatory before submission.</li>
          </ul>
        </div>

        <div className="vtop-evaluation-form" style={{ opacity: 0.96 }}>
          {sections.map(([sectionTitle, sectionQuestions], secIdx) => {
            const ratingQuestions = sectionQuestions.filter((q) => q.question_type === 'rating')
            const textQuestions = sectionQuestions.filter((q) => q.question_type === 'text')

            return (
              <div key={sectionTitle} className="vtop-question-section-card">
                <div className="vtop-section-banner">
                  <span className="section-index-tag">SECTION {String.fromCharCode(65 + secIdx)}</span>
                  <h3 className="section-heading">{sectionTitle}</h3>
                </div>

                {ratingQuestions.length > 0 && (
                  <div className="table-responsive">
                    <table className="vtop-question-matrix-table">
                      <thead>
                        <tr>
                          <th style={{ width: '60px' }}>S.No</th>
                          <th>Parameters / Questions</th>
                          <th className="rating-col"><span>1</span><small>Strongly Disagree</small></th>
                          <th className="rating-col"><span>2</span><small>Disagree</small></th>
                          <th className="rating-col"><span>3</span><small>Neutral</small></th>
                          <th className="rating-col"><span>4</span><small>Agree</small></th>
                          <th className="rating-col"><span>5</span><small>Strongly Agree</small></th>
                        </tr>
                      </thead>
                      <tbody>
                        {ratingQuestions.map((q, idx) => {
                          const currentVal = answers[q.id]
                          return (
                            <tr
                              key={q.id}
                              className={currentVal !== undefined && currentVal !== null ? 'row-answered' : ''}
                            >
                              <td className="font-mono text-center">{q.position || idx + 1}</td>
                              <td className="question-prompt-cell">
                                <span>{q.prompt}</span>
                                {q.required === 1 && <span className="text-danger ml-1">*</span>}
                              </td>
                              {[1, 2, 3, 4, 5].map((starVal) => {
                                const isChecked = currentVal === starVal
                                return (
                                  <td key={starVal} className="rating-radio-cell">
                                    <label className="radio-label" style={{ cursor: 'not-allowed' }}>
                                      <input
                                        type="radio"
                                        name={`question_${q.id}`}
                                        value={starVal}
                                        checked={isChecked}
                                        disabled
                                        className="vtop-radio"
                                        style={{ cursor: 'not-allowed', opacity: 0.85 }}
                                      />
                                      <span className="custom-radio" />
                                    </label>
                                  </td>
                                )
                              })}
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {textQuestions.length > 0 && (
                  <div className="text-questions-container">
                    {textQuestions.map((q) => (
                      <div key={q.id} className="text-question-block">
                        <label htmlFor={`text-q-${q.id}`} className="text-q-label">
                          <span>{q.prompt}</span>
                          {q.required === 1 && <span className="text-danger ml-1">*</span>}
                        </label>
                        <textarea
                          id={`text-q-${q.id}`}
                          className="form-textarea vtop-textarea"
                          rows={4}
                          value={answers[q.id] || ''}
                          readOnly
                          disabled
                          style={{
                            cursor: 'not-allowed',
                            backgroundColor: '#f8fafc',
                            color: '#1e293b',
                            borderColor: '#cbd5e1',
                          }}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <div className="vtop-submit-bar">
          <button type="button" className="btn btn-secondary" onClick={goToCourseList}>
            Back to Courses
          </button>
          <button type="button" className="btn btn-secondary btn-lg vtop-submit-btn" disabled style={{ cursor: 'not-allowed', opacity: 0.75, display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
            <Lock size={18} />
            <span>Review Already Submitted (Locked)</span>
          </button>
        </div>
      </div>
    )
  }

  if (submittedSuccess) {
    return (
      <div className="container vtop-success-container">
        <div className="vtop-success-card">
          <div className="success-icon-circle">
            <CheckCircle2 size={52} />
          </div>
          <span className="success-badge">CONFIRMATION OF SUBMISSION</span>
          <h2 className="success-title">Student Feedback Submitted Successfully</h2>
          <p className="success-text">
            Thank you for participating in the course and faculty quality evaluation. Your responses
            have been recorded into the institutional database.
          </p>

          <div className="vtop-receipt-table">
            <div className="receipt-row">
              <span className="receipt-label">Course:</span>
              <span className="receipt-val font-semibold">
                {course?.code} - {course?.title}
              </span>
            </div>
            <div className="receipt-row">
              <span className="receipt-label">Faculty:</span>
              <span className="receipt-val">{course?.faculty_names}</span>
            </div>
            <div className="receipt-row">
              <span className="receipt-label">Submission Date & Time:</span>
              <span className="receipt-val font-mono">
                {submittedReviewData?.submitted_at
                  ? new Date(submittedReviewData.submitted_at).toLocaleString()
                  : new Date().toLocaleString()}
              </span>
            </div>
            <div className="receipt-row">
              <span className="receipt-label">Student Anonymity:</span>
              <span className="receipt-val text-success">
                <ShieldCheck size={16} className="inline-icon" /> Confirmed (Protected by Institutional Privacy Policy)
              </span>
            </div>
          </div>

          <div className="success-actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={goToCourseList}
            >
              Return to Registered Course List
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (!course) {
    return (
      <div className="container py-8">
        <div className="alert alert-error">Course not found.</div>
        <button type="button" className="btn btn-secondary" onClick={goToCourseList}>
          Back to Courses
        </button>
      </div>
    )
  }

  return (
    <div className="vtop-evaluation-page container">
      {/* Back navigation */}
      <div className="vtop-nav-row">
        <button
          type="button"
          className="btn btn-secondary btn-sm back-nav-btn"
          onClick={goToCourseList}
        >
          <ArrowLeft size={16} />
          <span>Back to Registered Courses</span>
        </button>
      </div>

      {/* Read-Only Status & Confirmation Banner (Single-Submission Lock) */}
      {alreadySubmitted && (
        <div
          className="vtop-already-submitted-card"
          style={{
            background: '#f0fdf4',
            border: '1px solid #86efac',
            borderRadius: '8px',
            padding: '20px 24px',
            marginBottom: '24px',
            boxShadow: '0 2px 8px rgba(16, 185, 129, 0.08)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
            <div
              style={{
                background: '#dcfce7',
                color: '#15803d',
                borderRadius: '50%',
                padding: '10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <CheckCircle2 size={30} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px', flexWrap: 'wrap' }}>
                <span
                  className="badge badge-success"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    fontWeight: 700,
                    fontSize: '0.8125rem',
                    padding: '4px 10px',
                    background: '#16a34a',
                    color: '#ffffff',
                  }}
                >
                  <Lock size={12} />
                  SUBMITTED &bull; READ-ONLY LOCK
                </span>
                <span style={{ fontSize: '0.8125rem', color: '#166534', fontWeight: 600 }}>
                  Single-Submission Rule Enforced
                </span>
              </div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#14532d', margin: '0 0 6px 0' }}>
                Review already submitted for this course.
              </h3>
              <p style={{ color: '#166534', margin: '0 0 14px 0', fontSize: '0.9375rem', lineHeight: 1.5 }}>
                Your feedback evaluation for <strong>{course.code} — {course.title}</strong> was recorded
                {submittedReviewData?.submitted_at || course.submitted_at
                  ? ` on ${new Date(submittedReviewData?.submitted_at || course.submitted_at).toLocaleString()}`
                  : ''}.
                Under institutional evaluation rules, student submissions are final and locked to prevent duplicate entries. All inputs below are displayed in read-only mode, and no further modifications or resubmissions are allowed.
              </p>
              <div>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={goToCourseList}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  <ArrowLeft size={14} />
                  <span>Return to Registered Courses</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 1. Course Header Metadata Table (Exact VTOP Format) */}
      <div className="vtop-metadata-panel">
        <div className="vtop-panel-title">
          <span>COURSE REGISTRATION & FACULTY DETAILS</span>
        </div>
        <div className="table-responsive">
          <table className="vtop-meta-table">
            <thead>
              <tr>
                <th>Class Nbr</th>
                <th>Course Code</th>
                <th>Course Title</th>
                <th>Course Type</th>
                <th>L-T-P-J-C</th>
                <th>Slot</th>
                <th>Venue</th>
                <th>Faculty Name</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="font-mono text-center font-bold">{course.class_nbr || '1102'}</td>
                <td className="font-mono font-bold text-primary">{course.code}</td>
                <td className="font-semibold">{course.title}</td>
                <td>
                  <span className="badge badge-outline">{course.course_type || 'Theory Only'}</span>
                </td>
                <td className="font-mono text-center">{course.ltpjc || '3-0-0-0-3'}</td>
                <td className="font-mono font-medium">{course.slot || 'A1+TA1'}</td>
                <td>{course.venue || 'SJT 101'}</td>
                <td className="faculty-name-bold">{course.faculty_names || 'Faculty Instructor'}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Evaluation Instructions Banner */}
      <div className="vtop-instructions-box">
        <h4>General Instructions</h4>
        <ul>
          <li>Please evaluate each parameter on a scale of <strong>1 (Strongly Disagree / Poor)</strong> to <strong>5 (Strongly Agree / Excellent)</strong>.</li>
          <li>Your ratings and comments are strictly confidential and will be analyzed anonymously for institutional quality improvements.</li>
          <li>All rating items are mandatory before submission.</li>
        </ul>
      </div>

      {error && (
        <div className="alert alert-error">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* 2. Single Continuous Scrollable Evaluation Form (VTOP Layout) */}
      <form onSubmit={handleSubmit} className="vtop-evaluation-form">
        {sections.map(([sectionTitle, sectionQuestions], secIdx) => {
          const ratingQuestions = sectionQuestions.filter((q) => q.question_type === 'rating')
          const textQuestions = sectionQuestions.filter((q) => q.question_type === 'text')

          return (
            <div key={sectionTitle} className="vtop-question-section-card">
              <div className="vtop-section-banner">
                <span className="section-index-tag">SECTION {String.fromCharCode(65 + secIdx)}</span>
                <h3 className="section-heading">{sectionTitle}</h3>
              </div>

              {/* Rating Questions Table */}
              {ratingQuestions.length > 0 && (
                <div className="table-responsive">
                  <table className="vtop-question-matrix-table">
                    <thead>
                      <tr>
                        <th style={{ width: '60px' }}>S.No</th>
                        <th>Parameters / Questions</th>
                        <th className="rating-col">
                          <span>1</span>
                          <small>Strongly Disagree</small>
                        </th>
                        <th className="rating-col">
                          <span>2</span>
                          <small>Disagree</small>
                        </th>
                        <th className="rating-col">
                          <span>3</span>
                          <small>Neutral</small>
                        </th>
                        <th className="rating-col">
                          <span>4</span>
                          <small>Agree</small>
                        </th>
                        <th className="rating-col">
                          <span>5</span>
                          <small>Strongly Agree</small>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {ratingQuestions.map((q, idx) => {
                        const currentVal = answers[q.id]

                        return (
                          <tr
                            key={q.id}
                            className={currentVal !== undefined && currentVal !== null ? 'row-answered' : ''}
                            onMouseEnter={() => !alreadySubmitted && recordQuestionInteraction(q.id)}
                          >
                            <td className="font-mono text-center">{q.position || idx + 1}</td>
                            <td className="question-prompt-cell">
                              <span>{q.prompt}</span>
                              {q.required === 1 && <span className="text-danger ml-1">*</span>}
                            </td>

                            {[1, 2, 3, 4, 5].map((starVal) => {
                              const isChecked = currentVal === starVal

                              return (
                                <td key={starVal} className="rating-radio-cell">
                                  <label
                                    className="radio-label"
                                    style={alreadySubmitted ? { cursor: 'not-allowed' } : {}}
                                  >
                                    <input
                                      type="radio"
                                      name={`question_${q.id}`}
                                      value={starVal}
                                      checked={isChecked}
                                      disabled={alreadySubmitted}
                                      onChange={() => !alreadySubmitted && handleRatingSelect(q.id, starVal)}
                                      className="vtop-radio"
                                      style={alreadySubmitted ? { cursor: 'not-allowed', opacity: 0.85 } : {}}
                                    />
                                    <span className="custom-radio" />
                                  </label>
                                </td>
                              )
                            })}
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Open-Text Questions in Section */}
              {textQuestions.length > 0 && (
                <div className="text-questions-container">
                  {textQuestions.map((q) => (
                    <div
                      key={q.id}
                      className="text-question-block"
                      onFocus={() => !alreadySubmitted && recordQuestionInteraction(q.id)}
                    >
                      <label htmlFor={`text-q-${q.id}`} className="text-q-label">
                        <span>{q.prompt}</span>
                        {q.required === 1 && <span className="text-danger ml-1">*</span>}
                      </label>
                      <textarea
                        id={`text-q-${q.id}`}
                        className="form-textarea vtop-textarea"
                        rows={4}
                        placeholder={
                          alreadySubmitted
                            ? 'No additional qualitative comments recorded.'
                            : 'Please enter constructive feedback, observations, or suggestions...'
                        }
                        value={answers[q.id] || ''}
                        disabled={alreadySubmitted}
                        readOnly={alreadySubmitted}
                        onChange={(e) => !alreadySubmitted && handleTextChange(q.id, e.target.value)}
                        style={
                          alreadySubmitted
                            ? {
                                cursor: 'not-allowed',
                                backgroundColor: '#f8fafc',
                                color: '#1e293b',
                                borderColor: '#cbd5e1',
                              }
                            : {}
                        }
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}

        {/* Form Submit Footer */}
        <div className="vtop-submit-bar">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={goToCourseList}
          >
            {alreadySubmitted ? 'Back to Courses' : 'Cancel'}
          </button>

          {alreadySubmitted ? (
            <button
              type="button"
              className="btn btn-secondary btn-lg vtop-submit-btn"
              disabled
              style={{
                cursor: 'not-allowed',
                opacity: 0.75,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <Lock size={18} />
              <span>Review Already Submitted (Locked)</span>
            </button>
          ) : (
            <button
              type="submit"
              className="btn btn-primary btn-lg vtop-submit-btn"
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <div className="spinner spinner-sm" />
                  <span>Recording Institutional Feedback...</span>
                </>
              ) : (
                <>
                  <FileCheck size={18} />
                  <span>Submit Evaluation</span>
                </>
              )}
            </button>
          )}
        </div>
      </form>
    </div>
  )
}
