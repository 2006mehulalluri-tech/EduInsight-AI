import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getCourses } from '../../api.js'
import {
  AlertCircle,
  Award,
  BookOpen,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  Eye,
  FlaskConical,
  GraduationCap,
  Lock,
  MapPin,
  Sparkles,
  User,
} from 'lucide-react'

export default function CourseList() {
  const [courses, setCourses] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  const openReview = (courseId) => navigate(`/student/evaluate/${courseId}`, { replace: true })

  useEffect(() => {
    let isCurrent = true
    setLoading(true)

    getCourses()
      .then((data) => {
        if (isCurrent) setCourses(data.courses || [])
      })
      .catch((err) => {
        if (isCurrent) setError(err.message || 'Failed to load curriculum courses')
      })
      .finally(() => {
        if (isCurrent) setLoading(false)
      })

    return () => {
      isCurrent = false
    }
  }, [])

  const theoryCourses = courses.filter(
    (c) => c.course_type === 'Theory Only' || (!c.course_type && !c.code.endsWith('P')),
  )
  const labCourses = courses.filter(
    (c) => c.course_type === 'Lab Only' || (!c.course_type && c.code.endsWith('P')),
  )
  const otherCourses = courses.filter(
    (c) => c.course_type === 'Soft Skill' || (c.course_type !== 'Theory Only' && c.course_type !== 'Lab Only'),
  )

  const renderCourseTable = (courseGroup, groupTitle, icon, badgeClass) => (
    <div className="vtop-course-section">
      <div className="vtop-section-header">
        <div className="vtop-header-left">
          {icon}
          <h3>{groupTitle}</h3>
        </div>
        <span className={`badge ${badgeClass}`}>{courseGroup.length} Registered</span>
      </div>

      <div className="table-responsive">
        <table className="vtop-table">
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
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {courseGroup.length === 0 ? (
              <tr>
                <td colSpan="9" className="text-center py-4 text-muted">
                  No courses registered in this category.
                </td>
              </tr>
            ) : (
              courseGroup.map((c) => (
                <tr key={c.id}>
                  <td className="font-mono text-center">{c.class_nbr || `10${c.id}`}</td>
                  <td className="font-mono font-bold text-primary">{c.code}</td>
                  <td className="course-title-cell font-semibold">{c.title}</td>
                  <td>
                    <span className="badge badge-outline">{c.course_type || 'Theory Only'}</span>
                  </td>
                  <td className="font-mono text-center text-muted">{c.ltpjc || '3-0-0-0-3'}</td>
                  <td className="font-mono font-medium">{c.slot || 'A1+TA1'}</td>
                  <td className="text-muted">{c.venue || 'SJT 101'}</td>
                  <td className="faculty-name-cell">
                    <User size={14} className="inline-icon text-muted" />
                    <span>{c.faculty_names || 'Faculty Instructor'}</span>
                  </td>
                  <td>
                    {c.has_submitted ? (
                      <div className="course-action-submitted-group" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <button
                          type="button"
                          className="btn btn-sm btn-submitted"
                          disabled
                          title="Review already submitted for this course"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            background: '#ecfdf5',
                            color: '#059669',
                            border: '1px solid #a7f3d0',
                            fontWeight: 600,
                            cursor: 'not-allowed',
                            padding: '4px 10px',
                            borderRadius: '4px',
                            fontSize: '0.8125rem',
                          }}
                        >
                          <CheckCircle2 size={14} />
                          <span>Submitted</span>
                        </button>
                        <button
                          type="button"
                          className="btn btn-outline btn-sm"
                          onClick={() => openReview(c.id)}
                          title="View submitted evaluation (read-only)"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '4px 8px',
                            fontSize: '0.75rem',
                          }}
                        >
                          <Eye size={13} />
                          <span>View</span>
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="btn btn-primary btn-sm evaluate-btn"
                        onClick={() => openReview(c.id)}
                      >
                        <span>Give Feedback</span>
                        <ChevronRight size={14} />
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )

  return (
    <div className="course-list-page container">
      <div className="vtop-page-banner">
        <div className="banner-left">
          <span className="vtop-portal-tag">VTOP STUDENT FEEDBACK PORTAL</span>
          <h2 className="vtop-page-title">Course & Faculty Evaluation System</h2>
          <p className="vtop-page-sub">
            Academic Year: <strong>2025 - 2026</strong> | Term: <strong>Winter Semester</strong> |
            Please select a course below to submit your continuous institutional feedback.
          </p>
        </div>
      </div>

      {loading && (
        <div className="loading-state">
          <div className="spinner" />
          <p>Loading curriculum course schedule...</p>
        </div>
      )}

      {error && (
        <div className="alert alert-error">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {!loading && (
        <div className="vtop-courses-container">
          {/* 1. Theory Courses */}
          {renderCourseTable(
            theoryCourses,
            'Theory Courses (Theory Only)',
            <BookOpen size={20} className="text-primary" />,
            'badge-primary',
          )}

          {/* 2. Laboratory Courses */}
          {renderCourseTable(
            labCourses,
            'Laboratory Courses (Lab Only)',
            <FlaskConical size={20} className="text-success" />,
            'badge-success',
          )}

          {/* 3. Soft Skills / Other Courses */}
          {otherCourses.length > 0 &&
            renderCourseTable(
              otherCourses,
              'Career Development / Soft Skills',
              <Award size={20} className="text-warning" />,
              'badge-warning',
            )}
        </div>
      )}
    </div>
  )
}
