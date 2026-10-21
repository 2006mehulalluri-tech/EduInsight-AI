import { useEffect, useState } from 'react'
import {
  commitCsvImport,
  createAdminUser,
  getAdminFaculty,
  getAdminQuestions,
  getAdminUsers,
  getAnalytics,
  getCourses,
  getRriWeights,
  previewCsvImport,
  resetDemoStudentReviews,
  updateQuestionExpectedTime,
  updateRriWeights,
} from '../../api.js'
import {
  AlertCircle,
  BarChart3,
  BookOpen,
  Briefcase,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  Copy,
  Database,
  Eye,
  EyeOff,
  FileSpreadsheet,
  GraduationCap,
  HelpCircle,
  Key,
  PlusCircle,
  Save,
  Search,
  Shield,
  Sliders,
  Sparkles,
  TrendingUp,
  Upload,
  User,
  UserPlus,
  Users,
  X,
} from 'lucide-react'
import FacultyDashboard from '../faculty/FacultyDashboard.jsx'

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('analytics')

  // Course drill-down state for course-wise hierarchy
  const [selectedCourseForDrilldown, setSelectedCourseForDrilldown] = useState(null)

  // Data states
  const [questions, setQuestions] = useState([])
  const [facultyMembers, setFacultyMembers] = useState([])
  const [usersList, setUsersList] = useState([])
  const [coursesList, setCoursesList] = useState([])
  const [rriWeights, setRriWeights] = useState({
    time_score: 25,
    time_variance: 15,
    rush_score: 15,
    reflection_score: 10,
    behavioral_consistency: 15,
    response_consistency: 10,
    answer_changes: 5,
    question_revisits: 5,
  })

  // Status feedback
  const [feedbackMsg, setFeedbackMsg] = useState('')
  const [feedbackType, setFeedbackType] = useState('success') // 'success' | 'error'

  // CSV Import State
  const [csvInput, setCsvInput] = useState('')
  const [csvPreviewData, setCsvPreviewData] = useState(null)
  const [importing, setImporting] = useState(false)
  const [previewLoading, setPreviewLoading] = useState(false)

  // User Management State
  const [isAddUserOpen, setIsAddUserOpen] = useState(false)
  const [userFormLoading, setUserFormLoading] = useState(false)
  const [userFormError, setUserFormError] = useState('')
  const [userSearchQuery, setUserSearchQuery] = useState('')
  const [userRoleFilter, setUserRoleFilter] = useState('all') // 'all' | 'student' | 'faculty' | 'administrator'
  const [showPasswords, setShowPasswords] = useState(false)
  const [copiedUserId, setCopiedUserId] = useState(null)
  const [newUserForm, setNewUserForm] = useState({
    role: 'student',
    email: '',
    password: 'Password123!',
    firstName: '',
    lastName: '',
    enrollmentNumber: '',
    department: 'SCOPE - School of Computer Science & Engineering',
    title: 'Assistant Professor',
    employeeId: '',
  })

  // Load initial configurations
  useEffect(() => {
    getRriWeights()
      .then((data) => {
        if (data.weights) setRriWeights(data.weights)
      })
      .catch(console.error)

    getAdminQuestions()
      .then((data) => {
        if (data.questions) setQuestions(data.questions)
      })
      .catch(console.error)

    getAdminFaculty()
      .then((data) => {
        if (data.faculty) setFacultyMembers(data.faculty)
      })
      .catch(console.error)

    getAdminUsers()
      .then((data) => {
        if (data.users) setUsersList(data.users)
      })
      .catch(console.error)

    getCourses()
      .then((data) => {
        if (data.courses) setCoursesList(data.courses)
      })
      .catch(console.error)
  }, [])

  const notify = (msg, type = 'success') => {
    setFeedbackMsg(msg)
    setFeedbackType(type)
    setTimeout(() => setFeedbackMsg(''), 5000)
  }

  // Handle Question Expected Response Time Update
  const handleUpdateExpectedTime = async (qId, newTimeSec) => {
    const timeMs = Math.round(Number(newTimeSec) * 1000)
    try {
      await updateQuestionExpectedTime(qId, timeMs)
      setQuestions((prev) =>
        prev.map((q) => (q.id === qId ? { ...q, expected_response_time_ms: timeMs } : q)),
      )
      notify(`Updated expected response time for Question #${qId} to ${newTimeSec}s.`)
    } catch (err) {
      notify(err.message || 'Failed to update response time.', 'error')
    }
  }

  // Handle RRI Weight Save
  const totalWeight = Object.values(rriWeights).reduce((sum, w) => sum + Number(w || 0), 0)

  const handleSaveWeights = async () => {
    if (Math.abs(totalWeight - 100) > 0.1) {
      notify('Total weight sum must equal exactly 100%.', 'error')
      return
    }
    try {
      await updateRriWeights(rriWeights)
      notify('RRI mathematical weights updated and saved to SQLite.')
    } catch (err) {
      notify(err.message || 'Failed to update weights.', 'error')
    }
  }

  const handleResetDemoStudentReviews = async () => {
    const confirmed = window.confirm(
      'This will delete all review submissions for the demo student account so they can submit again. Continue?',
    )
    if (!confirmed) return

    try {
      const result = await resetDemoStudentReviews()
      notify(result.message || `Reset ${result.deletedCount || 0} demo submissions.`)
    } catch (err) {
      notify(err.message || 'Failed to reset the demo student reviews.', 'error')
    }
  }

  // Sample CSV Template Generator
  const handleLoadSampleCsv = () => {
    const sample = `course_code,rating,response_time_ms,open_feedback,answer_changes,question_revisits
BCSE204L,5,48000,"The professor explains algorithm trace tables with great clarity and real-world examples.",1,1
BCSE204L,4,42000,"Good pace and clear dynamic programming exercises during lecture hours.",0,1
BCSE204P,5,55000,"Comprehensive lab assistance and timely debugging guidance.",2,2
BCSE209L,1,8000,"good",0,0
BCSE301L,4,50000,"Clear software architecture explanations with illustrative diagrams.",1,0
BMAT202L,5,44000,"Solid probability derivations and practical engineering problem solving.",0,1
INVALID_COURSE,4,40000,"Should trigger validation error because course does not exist.",0,0`
    setCsvInput(sample)
    setCsvPreviewData(null)
  }

  // Preview CSV
  const handlePreviewCsv = async () => {
    if (!csvInput.trim()) {
      notify('Please enter or paste CSV content first.', 'error')
      return
    }
    setPreviewLoading(true)
    try {
      const data = await previewCsvImport(csvInput)
      setCsvPreviewData(data)
      notify(`Parsed ${data.totalRows} rows. ${data.validRowsCount} valid, ${data.invalidRowsCount} invalid.`)
    } catch (err) {
      notify(err.message || 'Failed to parse CSV.', 'error')
    } finally {
      setPreviewLoading(false)
    }
  }

  // Commit Valid CSV Rows
  const handleCommitCsv = async () => {
    if (!csvPreviewData || !csvPreviewData.preview) return
    const validRows = csvPreviewData.preview.filter((r) => r.isValid)
    if (validRows.length === 0) {
      notify('No valid rows available to import.', 'error')
      return
    }

    setImporting(true)
    try {
      const res = await commitCsvImport(validRows)
      notify(res.message || `Imported ${res.importedCount} records successfully.`)
      setCsvPreviewData(null)
      setCsvInput('')
      // Refresh courses list to reflect updated counts
      getCourses().then((d) => setCoursesList(d.courses || []))
    } catch (err) {
      notify(err.message || 'Import commit failed.', 'error')
    } finally {
      setImporting(false)
    }
  }

  const handleCopyPassword = (userId, pwd) => {
    if (!pwd) return
    navigator.clipboard?.writeText(pwd)
    setCopiedUserId(userId)
    notify(`Password copied for user ID #${userId}!`, 'success')
    setTimeout(() => {
      setCopiedUserId((prev) => (prev === userId ? null : prev))
    }, 2500)
  }

  const handleCreateUser = async (e) => {
    e.preventDefault()
    setUserFormError('')

    if (!newUserForm.email.trim()) {
      setUserFormError('Email address is required.')
      return
    }
    if (!newUserForm.password.trim()) {
      setUserFormError('Password is required.')
      return
    }

    setUserFormLoading(true)
    try {
      const payload = {
        email: newUserForm.email.trim(),
        password: newUserForm.password.trim(),
        role: newUserForm.role,
        firstName: newUserForm.firstName.trim() || undefined,
        lastName: newUserForm.lastName.trim() || undefined,
        enrollmentNumber:
          newUserForm.role === 'student' ? newUserForm.enrollmentNumber.trim() || undefined : undefined,
        department:
          newUserForm.role === 'faculty' ? newUserForm.department.trim() || undefined : undefined,
        title:
          newUserForm.role === 'faculty' ? newUserForm.title.trim() || undefined : undefined,
        employeeId:
          newUserForm.role === 'faculty' ? newUserForm.employeeId.trim() || undefined : undefined,
      }

      await createAdminUser(payload)
      notify(
        `User ${newUserForm.email} (${newUserForm.role}) created successfully!`,
        'success',
      )
      setIsAddUserOpen(false)

      // Reset form
      setNewUserForm({
        role: 'student',
        email: '',
        password: 'Password123!',
        firstName: '',
        lastName: '',
        enrollmentNumber: '',
        department: 'SCOPE - School of Computer Science & Engineering',
        title: 'Assistant Professor',
        employeeId: '',
      })

      // Refresh users and faculty
      const usersData = await getAdminUsers()
      if (usersData.users) setUsersList(usersData.users)

      if (payload.role === 'faculty') {
        const facData = await getAdminFaculty()
        if (facData.faculty) setFacultyMembers(facData.faculty)
      }
    } catch (err) {
      setUserFormError(err.message || 'Failed to create user.')
    } finally {
      setUserFormLoading(false)
    }
  }

  const filteredUsers = usersList.filter((u) => {
    if (userRoleFilter !== 'all' && u.role !== userRoleFilter) {
      return false
    }
    if (!userSearchQuery.trim()) return true
    const q = userSearchQuery.toLowerCase()
    const name = `${u.firstName || ''} ${u.lastName || ''}`.toLowerCase()
    const email = (u.email || '').toLowerCase()
    const idNum = (u.enrollmentNumber || u.employeeId || '').toLowerCase()
    const dept = (u.department || '').toLowerCase()
    return name.includes(q) || email.includes(q) || idNum.includes(q) || dept.includes(q)
  })

  const studentCount = usersList.filter((u) => u.role === 'student').length
  const facultyCount = usersList.filter((u) => u.role === 'faculty').length
  const adminCount = usersList.filter((u) => u.role === 'administrator').length

  return (
    <div className="admin-dashboard container">
      {/* Top Banner & Tab Navigation */}
      <div className="admin-header">
        <div>
          <span className="page-eyebrow">Institutional Quality Assurance</span>
          <h2 className="page-title">Administrator Control Center</h2>
          <p className="page-description">
            Course-level aggregated analytics hierarchy, cognitive response time benchmarks, RRI
            weight tuning, and CSV evaluation batch ingestion.
          </p>
        </div>

        <div className="admin-actions-stack">
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => {
              setIsAddUserOpen(true)
              setUserFormError('')
            }}
          >
            <UserPlus size={15} />
            <span>Add New User</span>
          </button>
          <button
            type="button"
            className="btn btn-warning btn-sm"
            onClick={handleResetDemoStudentReviews}
          >
            Reset Demo Student Reviews
          </button>
        </div>

        <div className="admin-tabs-nav">
          <button
            type="button"
            className={`admin-tab-btn ${activeTab === 'analytics' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('analytics')
              setSelectedCourseForDrilldown(null)
            }}
          >
            <BarChart3 size={16} />
            <span>Course-Level Analytics</span>
          </button>
          <button
            type="button"
            className={`admin-tab-btn ${activeTab === 'users' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('users')
              setSelectedCourseForDrilldown(null)
            }}
          >
            <Users size={16} />
            <span>User Management ({usersList.length})</span>
          </button>
          <button
            type="button"
            className={`admin-tab-btn ${activeTab === 'questions' ? 'active' : ''}`}
            onClick={() => setActiveTab('questions')}
          >
            <Clock size={16} />
            <span>Response Benchmarks</span>
          </button>
          <button
            type="button"
            className={`admin-tab-btn ${activeTab === 'weights' ? 'active' : ''}`}
            onClick={() => setActiveTab('weights')}
          >
            <Sliders size={16} />
            <span>RRI Weights</span>
          </button>
          <button
            type="button"
            className={`admin-tab-btn ${activeTab === 'courses' ? 'active' : ''}`}
            onClick={() => setActiveTab('courses')}
          >
            <BookOpen size={16} />
            <span>Curriculum & Faculty</span>
          </button>
          <button
            type="button"
            className={`admin-tab-btn ${activeTab === 'csv' ? 'active' : ''}`}
            onClick={() => setActiveTab('csv')}
          >
            <FileSpreadsheet size={16} />
            <span>CSV Batch Import</span>
          </button>
        </div>
      </div>

      {feedbackMsg && (
        <div className={`alert alert-${feedbackType}`}>
          {feedbackType === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          <span>{feedbackMsg}</span>
        </div>
      )}

      {/* TAB 1: Course-Wise Aggregated Analytics Hierarchy (Requirement 4) */}
      {activeTab === 'analytics' && (
        <>
          {selectedCourseForDrilldown ? (
            <FacultyDashboard
              overrideCourseId={selectedCourseForDrilldown.id}
              onBackToCourseList={() => setSelectedCourseForDrilldown(null)}
            />
          ) : (
            <div className="admin-section-card">
              <div className="card-header-with-action">
                <div>
                  <h3 className="section-title">
                    <BarChart3 size={18} />
                    <span>Curriculum Course Evaluations Hierarchy</span>
                  </h3>
                  <p className="card-subtitle">
                    Select a course below to drill into its dedicated Review Reliability Index
                    threshold slider, Recharts visualizations, qualitative summaries, and individual
                    evaluation audits.
                  </p>
                </div>
                <span className="badge badge-primary">{coursesList.length} Active Courses</span>
              </div>

              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Class Nbr</th>
                      <th>Course Code</th>
                      <th>Course Title</th>
                      <th>Type</th>
                      <th>Faculty Instructor</th>
                      <th>Slot / Venue</th>
                      <th>Total Reviews</th>
                      <th>Mean RRI</th>
                      <th>Avg Rating</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {coursesList.map((c) => (
                      <tr key={c.id}>
                        <td className="font-mono text-center">{c.class_nbr || `10${c.id}`}</td>
                        <td className="font-mono font-bold text-primary">{c.code}</td>
                        <td className="font-semibold">{c.title}</td>
                        <td>
                          <span className="badge badge-outline">{c.course_type || 'Theory Only'}</span>
                        </td>
                        <td>
                          <User size={13} className="inline-icon text-muted" />
                          <span>{c.faculty_names || 'Faculty Instructor'}</span>
                        </td>
                        <td className="font-mono text-sm text-muted">
                          {c.slot} ({c.venue})
                        </td>
                        <td className="text-center font-bold">
                          <span className="badge badge-outline">{c.review_count || 0} reviews</span>
                        </td>
                        <td>
                          <span
                            className={`rri-badge ${
                              (c.average_rri || 0) >= 80
                                ? 'rri-high'
                                : (c.average_rri || 0) >= 60
                                ? 'rri-mid'
                                : 'rri-low'
                            }`}
                          >
                            {c.average_rri ? `${c.average_rri} / 100` : 'N/A'}
                          </span>
                        </td>
                        <td className="font-bold text-amber-600">
                          ⭐ {c.average_rating ? `${c.average_rating} / 5` : 'N/A'}
                        </td>
                        <td>
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            onClick={() => setSelectedCourseForDrilldown(c)}
                          >
                            <span>Inspect Course</span>
                            <ChevronRight size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* TAB 2: Expected Response Times Configuration */}
      {activeTab === 'questions' && (
        <div className="admin-section-card">
          <div className="card-header-with-action">
            <div>
              <h3 className="section-title">
                <Clock size={18} />
                <span>Configurable Expected Response Times (Novelty Core)</span>
              </h3>
              <p className="card-subtitle">
                The RRI engine benchmarks actual student dwell time against these calibrated cognitive
                expectations per question to identify rushed or mechanical submissions.
              </p>
            </div>
            <span className="badge badge-outline">{questions.length} Configured Questions</span>
          </div>

          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Course</th>
                  <th>#</th>
                  <th>Section</th>
                  <th>Question Prompt</th>
                  <th>Type</th>
                  <th>Expected Duration (Seconds)</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {questions.map((q) => (
                  <tr key={q.id}>
                    <td className="font-mono">
                      <strong>{q.course_code}</strong>
                    </td>
                    <td className="font-mono">{q.position}</td>
                    <td>
                      <span className="badge badge-sm">{q.section || 'FEEDBACK - CLASS WISE'}</span>
                    </td>
                    <td className="prompt-cell">{q.prompt}</td>
                    <td>
                      <span className={`badge badge-sm badge-${q.question_type}`}>
                        {q.question_type}
                      </span>
                    </td>
                    <td>
                      <div className="input-with-unit">
                        <input
                          type="number"
                          min="1"
                          max="120"
                          step="1"
                          defaultValue={Math.round((q.expected_response_time_ms || 10000) / 1000)}
                          id={`q-time-${q.id}`}
                          className="form-input input-sm text-center"
                        />
                        <span className="unit-label">sec</span>
                      </div>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        onClick={() => {
                          const input = document.getElementById(`q-time-${q.id}`)
                          if (input) handleUpdateExpectedTime(q.id, input.value)
                        }}
                      >
                        <Save size={14} />
                        <span>Save</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: RRI Weight Algorithm Configuration */}
      {activeTab === 'weights' && (
        <div className="admin-section-card">
          <div className="card-header-with-action">
            <div>
              <h3 className="section-title">
                <Sliders size={18} />
                <span>RRI Mathematical Formulation Weights</span>
              </h3>
              <p className="card-subtitle">
                Configure the weight contribution of each normalized behavioral metric in the Review
                Reliability Index calculation. The sum of all weights must equal 100%.
              </p>
            </div>
            <div
              className={`weight-total-badge ${
                Math.abs(totalWeight - 100) < 0.1 ? 'weight-valid' : 'weight-invalid'
              }`}
            >
              Total Weight: <strong>{totalWeight}%</strong>{' '}
              {Math.abs(totalWeight - 100) < 0.1 ? '✓ Balanced' : '⚠️ Must equal 100%'}
            </div>
          </div>

          <div className="weights-editor-grid">
            <div className="weight-input-group">
              <label htmlFor="w-time">
                <span>1. Time Score Weight</span>
                <span className="weight-pct">{rriWeights.time_score}%</span>
              </label>
              <input
                id="w-time"
                type="range"
                min="0"
                max="50"
                value={rriWeights.time_score}
                onChange={(e) =>
                  setRriWeights({ ...rriWeights, time_score: Number(e.target.value) })
                }
              />
              <p className="weight-note">Comparing actual response time against expected benchmark.</p>
            </div>

            <div className="weight-input-group">
              <label htmlFor="w-variance">
                <span>2. Time Variance Weight</span>
                <span className="weight-pct">{rriWeights.time_variance}%</span>
              </label>
              <input
                id="w-variance"
                type="range"
                min="0"
                max="50"
                value={rriWeights.time_variance}
                onChange={(e) =>
                  setRriWeights({ ...rriWeights, time_variance: Number(e.target.value) })
                }
              />
              <p className="weight-note">Coefficient of variation detecting uniform bot-like clicking.</p>
            </div>

            <div className="weight-input-group">
              <label htmlFor="w-rush">
                <span>3. Rush Score Weight</span>
                <span className="weight-pct">{rriWeights.rush_score}%</span>
              </label>
              <input
                id="w-rush"
                type="range"
                min="0"
                max="50"
                value={rriWeights.rush_score}
                onChange={(e) =>
                  setRriWeights({ ...rriWeights, rush_score: Number(e.target.value) })
                }
              />
              <p className="weight-note">Proportion of questions answered with adequate reading time.</p>
            </div>

            <div className="weight-input-group">
              <label htmlFor="w-reflection">
                <span>4. Reflection Score Weight</span>
                <span className="weight-pct">{rriWeights.reflection_score}%</span>
              </label>
              <input
                id="w-reflection"
                type="range"
                min="0"
                max="50"
                value={rriWeights.reflection_score}
                onChange={(e) =>
                  setRriWeights({ ...rriWeights, reflection_score: Number(e.target.value) })
                }
              />
              <p className="weight-note">Open-text typing depth, word count, and qualitative richness.</p>
            </div>

            <div className="weight-input-group">
              <label htmlFor="w-behavioral">
                <span>5. Behavioral Consistency Weight</span>
                <span className="weight-pct">{rriWeights.behavioral_consistency}%</span>
              </label>
              <input
                id="w-behavioral"
                type="range"
                min="0"
                max="50"
                value={rriWeights.behavioral_consistency}
                onChange={(e) =>
                  setRriWeights({ ...rriWeights, behavioral_consistency: Number(e.target.value) })
                }
              />
              <p className="weight-note">Pacing stability between survey beginning and completion.</p>
            </div>

            <div className="weight-input-group">
              <label htmlFor="w-response">
                <span>6. Response Consistency Weight</span>
                <span className="weight-pct">{rriWeights.response_consistency}%</span>
              </label>
              <input
                id="w-response"
                type="range"
                min="0"
                max="50"
                value={rriWeights.response_consistency}
                onChange={(e) =>
                  setRriWeights({ ...rriWeights, response_consistency: Number(e.target.value) })
                }
              />
              <p className="weight-note">Straight-lining penalty across diverse rating questions.</p>
            </div>

            <div className="weight-input-group">
              <label htmlFor="w-changes">
                <span>7. Answer Changes Weight</span>
                <span className="weight-pct">{rriWeights.answer_changes}%</span>
              </label>
              <input
                id="w-changes"
                type="range"
                min="0"
                max="20"
                value={rriWeights.answer_changes}
                onChange={(e) =>
                  setRriWeights({ ...rriWeights, answer_changes: Number(e.target.value) })
                }
              />
              <p className="weight-note">Deliberative answer modification tracking.</p>
            </div>

            <div className="weight-input-group">
              <label htmlFor="w-revisits">
                <span>8. Question Revisits Weight</span>
                <span className="weight-pct">{rriWeights.question_revisits}%</span>
              </label>
              <input
                id="w-revisits"
                type="range"
                min="0"
                max="20"
                value={rriWeights.question_revisits}
                onChange={(e) =>
                  setRriWeights({ ...rriWeights, question_revisits: Number(e.target.value) })
                }
              />
              <p className="weight-note">Reviewing previous questions before submitting.</p>
            </div>
          </div>

          <div className="weights-actions-footer">
            <button
              type="button"
              className="btn btn-primary"
              disabled={Math.abs(totalWeight - 100) > 0.1}
              onClick={handleSaveWeights}
            >
              <Save size={16} />
              <span>Save Algorithm Weights to Database</span>
            </button>
          </div>
        </div>
      )}

      {/* TAB 4: Courses & Faculty Management */}
      {activeTab === 'courses' && (
        <div className="admin-two-column-layout">
          <div className="admin-section-card">
            <h3 className="section-title">
              <BookOpen size={18} />
              <span>Registered Curriculum Courses</span>
            </h3>
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Class Nbr</th>
                    <th>Code</th>
                    <th>Title</th>
                    <th>Type</th>
                    <th>Slot</th>
                  </tr>
                </thead>
                <tbody>
                  {coursesList.map((c) => (
                    <tr key={c.id}>
                      <td className="font-mono text-center">{c.class_nbr}</td>
                      <td className="font-mono">
                        <strong>{c.code}</strong>
                      </td>
                      <td>{c.title}</td>
                      <td>
                        <span className="badge badge-outline">{c.course_type}</span>
                      </td>
                      <td className="font-mono text-sm">{c.slot}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="admin-section-card">
            <h3 className="section-title">
              <Users size={18} />
              <span>Faculty Directory</span>
            </h3>
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Faculty Member</th>
                    <th>Department</th>
                    <th>Title</th>
                    <th>Assigned Subjects</th>
                  </tr>
                </thead>
                <tbody>
                  {facultyMembers.map((f) => (
                    <tr key={f.faculty_id}>
                      <td>
                        <strong>
                          {f.first_name} {f.last_name}
                        </strong>
                        <span className="sub-text block font-mono text-sm">{f.email}</span>
                      </td>
                      <td className="text-muted text-sm">{f.department}</td>
                      <td className="text-sm">{f.title}</td>
                      <td className="text-center">
                        <span className="badge badge-primary">{f.assigned_courses_count} subjects</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: CSV Batch Import Tool */}
      {activeTab === 'csv' && (
        <div className="admin-section-card">
          <div className="card-header-with-action">
            <div>
              <h3 className="section-title">
                <FileSpreadsheet size={18} />
                <span>CSV Evaluation Data Importer</span>
              </h3>
              <p className="card-subtitle">
                Upload or paste evaluation batches. The system validates course codes, rating
                bounds, and duration benchmarks before importing into the SQLite database.
              </p>
            </div>
            <button type="button" className="btn btn-outline btn-sm" onClick={handleLoadSampleCsv}>
              <span>Load Sample CSV Template</span>
            </button>
          </div>

          <div className="csv-input-area">
            <label htmlFor="csv-textarea">Paste CSV Data or Load Template:</label>
            <textarea
              id="csv-textarea"
              className="form-textarea font-mono text-sm"
              rows={8}
              placeholder="course_code,rating,response_time_ms,open_feedback,answer_changes,question_revisits..."
              value={csvInput}
              onChange={(e) => setCsvInput(e.target.value)}
            />
          </div>

          <div className="csv-action-row">
            <button
              type="button"
              className="btn btn-secondary"
              disabled={previewLoading || !csvInput.trim()}
              onClick={handlePreviewCsv}
            >
              {previewLoading ? (
                <span>Parsing CSV...</span>
              ) : (
                <>
                  <Upload size={16} />
                  <span>Parse & Validate CSV</span>
                </>
              )}
            </button>
          </div>

          {/* CSV Preview & Validation Table */}
          {csvPreviewData && (
            <div className="csv-preview-results">
              <div className="validation-summary-strip">
                <span className="badge badge-outline">Total: {csvPreviewData.totalRows} Rows</span>
                <span className="badge badge-success">
                  Valid: {csvPreviewData.validRowsCount} Rows
                </span>
                {csvPreviewData.invalidRowsCount > 0 && (
                  <span className="badge badge-danger">
                    Invalid: {csvPreviewData.invalidRowsCount} Rows (Will be skipped)
                  </span>
                )}
              </div>

              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Row</th>
                      <th>Course</th>
                      <th>Rating</th>
                      <th>Response Time</th>
                      <th>Feedback Comment</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {csvPreviewData.preview.map((row) => (
                      <tr key={row.rowNumber} className={row.isValid ? '' : 'row-invalid'}>
                        <td className="font-mono">#{row.rowNumber}</td>
                        <td className="font-mono">{row.courseCode}</td>
                        <td>⭐ {row.rating} / 5</td>
                        <td>{Math.round(row.responseTimeMs / 1000)}s</td>
                        <td className="prompt-cell">"{row.comment}"</td>
                        <td>
                          {row.isValid ? (
                            <span className="badge badge-success">✓ Valid</span>
                          ) : (
                            <span
                              className="badge badge-danger"
                              title={row.errors.join(' ')}
                            >
                              ✕ Error: {row.errors[0]}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="commit-action-row">
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={importing || csvPreviewData.validRowsCount === 0}
                  onClick={handleCommitCsv}
                >
                  {importing ? (
                    <span>Importing into SQLite...</span>
                  ) : (
                    <>
                      <Database size={16} />
                      <span>Commit {csvPreviewData.validRowsCount} Valid Records to Database</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB: User Management */}
      {activeTab === 'users' && (
        <div className="admin-tab-content">
          {/* Stats Counters */}
          <div className="user-stats-grid">
            <div className="user-stat-card">
              <div className="user-stat-icon-wrap all">
                <Users size={22} />
              </div>
              <div>
                <div className="user-stat-val">{usersList.length}</div>
                <div className="user-stat-label">Total Accounts</div>
              </div>
            </div>

            <div className="user-stat-card">
              <div className="user-stat-icon-wrap student">
                <GraduationCap size={22} />
              </div>
              <div>
                <div className="user-stat-val">{studentCount}</div>
                <div className="user-stat-label">Students</div>
              </div>
            </div>

            <div className="user-stat-card">
              <div className="user-stat-icon-wrap faculty">
                <Briefcase size={22} />
              </div>
              <div>
                <div className="user-stat-val">{facultyCount}</div>
                <div className="user-stat-label">Faculty</div>
              </div>
            </div>

            <div className="user-stat-card">
              <div className="user-stat-icon-wrap admin">
                <Shield size={22} />
              </div>
              <div>
                <div className="user-stat-val">{adminCount}</div>
                <div className="user-stat-label">Administrators</div>
              </div>
            </div>
          </div>

          <div className="admin-section-card">
            <div className="card-header-with-action">
              <div>
                <h3 className="section-title">
                  <Users size={18} />
                  <span>Institutional User Directory</span>
                </h3>
                <p className="section-description">
                  View credentials, roles, departments, and manage accounts across the college review platform.
                </p>
              </div>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => {
                  setIsAddUserOpen(true)
                  setUserFormError('')
                }}
              >
                <UserPlus size={15} />
                <span>Add New User</span>
              </button>
            </div>

            {/* Filter and Search Bar */}
            <div className="users-toolbar">
              <div className="users-search-box">
                <Search size={16} />
                <input
                  type="text"
                  className="users-search-input"
                  placeholder="Search by name, email, reg number, department..."
                  value={userSearchQuery}
                  onChange={(e) => setUserSearchQuery(e.target.value)}
                />
              </div>

              <div className="users-filter-group">
                <button
                  type="button"
                  className={`users-filter-btn ${userRoleFilter === 'all' ? 'active' : ''}`}
                  onClick={() => setUserRoleFilter('all')}
                >
                  All ({usersList.length})
                </button>
                <button
                  type="button"
                  className={`users-filter-btn ${userRoleFilter === 'student' ? 'active' : ''}`}
                  onClick={() => setUserRoleFilter('student')}
                >
                  Students ({studentCount})
                </button>
                <button
                  type="button"
                  className={`users-filter-btn ${userRoleFilter === 'faculty' ? 'active' : ''}`}
                  onClick={() => setUserRoleFilter('faculty')}
                >
                  Faculty ({facultyCount})
                </button>
                <button
                  type="button"
                  className={`users-filter-btn ${userRoleFilter === 'administrator' ? 'active' : ''}`}
                  onClick={() => setUserRoleFilter('administrator')}
                >
                  Admins ({adminCount})
                </button>
              </div>

              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => setShowPasswords(!showPasswords)}
                title="Toggle plain-text passwords visibility"
              >
                {showPasswords ? <EyeOff size={15} /> : <Eye size={15} />}
                <span>{showPasswords ? 'Hide Passwords' : 'Show Passwords'}</span>
              </button>
            </div>

            {/* Users Table */}
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>User & Email</th>
                    <th>Role</th>
                    <th>Reg / Employee ID</th>
                    <th>Department / Title</th>
                    <th>Normal Password</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-6 text-muted">
                        No users found matching "{userSearchQuery}".
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((u) => (
                      <tr key={u.id}>
                        <td>
                          <strong>
                            {u.firstName || u.lastName
                              ? `${u.firstName || ''} ${u.lastName || ''}`.trim()
                              : 'Unnamed Account'}
                          </strong>
                          <span className="sub-text block font-mono text-sm">{u.email}</span>
                        </td>
                        <td>
                          <span className={`role-pill ${u.role}`}>
                            {u.role === 'student' && <GraduationCap size={12} />}
                            {u.role === 'faculty' && <Briefcase size={12} />}
                            {u.role === 'administrator' && <Shield size={12} />}
                            <span>{u.role}</span>
                          </span>
                        </td>
                        <td className="font-mono text-sm">
                          {u.enrollmentNumber || u.employeeId || <span className="text-muted">—</span>}
                        </td>
                        <td className="text-sm">
                          {u.department ? (
                            <div>
                              <div className="font-medium">{u.title || 'Faculty Member'}</div>
                              <div className="text-muted text-xs">{u.department}</div>
                            </div>
                          ) : u.role === 'student' ? (
                            <span className="text-muted text-xs">Student Evaluator</span>
                          ) : (
                            <span className="text-muted text-xs">Dean / Academic Administration</span>
                          )}
                        </td>
                        <td>
                          <div className="password-display-cell">
                            <span>
                              {showPasswords ? u.password : '••••••••••••'}
                            </span>
                            <button
                              type="button"
                              className="btn-icon-copy"
                              onClick={() => handleCopyPassword(u.id, u.password)}
                              title="Copy normal password to clipboard"
                            >
                              {copiedUserId === u.id ? (
                                <Check size={13} style={{ color: '#10b981' }} />
                              ) : (
                                <Copy size={13} />
                              )}
                            </button>
                          </div>
                        </td>
                        <td>
                          <span className="badge badge-success">● {u.status || 'active'}</span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ADD USER MODAL */}
      {isAddUserOpen && (
        <div className="modal-backdrop" onClick={() => setIsAddUserOpen(false)}>
          <div
            className="modal-window"
            style={{ maxWidth: '600px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <span className="modal-eyebrow">Institutional Access</span>
                <h3 className="modal-title">Add New User Account</h3>
                <p className="modal-subtitle">
                  Create a new student, faculty member, or administrator with plain credentials.
                </p>
              </div>
              <button
                type="button"
                className="close-btn"
                onClick={() => setIsAddUserOpen(false)}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateUser}>
              <div className="modal-body">
                {userFormError && (
                  <div className="alert alert-error" style={{ marginBottom: '16px' }}>
                    <AlertCircle size={16} />
                    <span>{userFormError}</span>
                  </div>
                )}

                {/* Role Selection Cards */}
                <div className="form-group">
                  <label>Select User Role *</label>
                  <div className="role-select-cards">
                    <div
                      className={`role-select-card ${newUserForm.role === 'student' ? 'selected' : ''}`}
                      onClick={() =>
                        setNewUserForm((prev) => ({
                          ...prev,
                          role: 'student',
                          password: prev.password || 'Student123!',
                        }))
                      }
                    >
                      <div className="role-card-title">
                        <GraduationCap size={16} className="text-primary" />
                        <span>Student</span>
                      </div>
                      <div className="role-card-desc">Submits evaluations for enrolled courses</div>
                    </div>

                    <div
                      className={`role-select-card ${newUserForm.role === 'faculty' ? 'selected' : ''}`}
                      onClick={() =>
                        setNewUserForm((prev) => ({
                          ...prev,
                          role: 'faculty',
                          password: prev.password || 'Faculty123!',
                        }))
                      }
                    >
                      <div className="role-card-title">
                        <Briefcase size={16} style={{ color: '#7c3aed' }} />
                        <span>Faculty</span>
                      </div>
                      <div className="role-card-desc">Course instructor with faculty analytics</div>
                    </div>

                    <div
                      className={`role-select-card ${newUserForm.role === 'administrator' ? 'selected' : ''}`}
                      onClick={() =>
                        setNewUserForm((prev) => ({
                          ...prev,
                          role: 'administrator',
                          password: prev.password || 'Admin123!',
                        }))
                      }
                    >
                      <div className="role-card-title">
                        <Shield size={16} style={{ color: '#d97706' }} />
                        <span>Admin</span>
                      </div>
                      <div className="role-card-desc">Dean office auditor with full management</div>
                    </div>
                  </div>
                </div>

                {/* Email and Password */}
                <div className="form-row-2col">
                  <div className="form-group">
                    <label htmlFor="user-email">Email Address *</label>
                    <input
                      id="user-email"
                      type="email"
                      className="form-input"
                      required
                      placeholder={
                        newUserForm.role === 'student'
                          ? 'aarav.22bce1042@vitdemo.edu'
                          : newUserForm.role === 'faculty'
                            ? 'prof.surname@local.test'
                            : 'admin.office@local.test'
                      }
                      value={newUserForm.email}
                      onChange={(e) =>
                        setNewUserForm((prev) => ({ ...prev, email: e.target.value }))
                      }
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="user-password">Normal Password *</label>
                    <input
                      id="user-password"
                      type="text"
                      className="form-input font-mono"
                      required
                      placeholder="e.g. Student123!"
                      value={newUserForm.password}
                      onChange={(e) =>
                        setNewUserForm((prev) => ({ ...prev, password: e.target.value }))
                      }
                    />
                  </div>
                </div>

                {/* Names */}
                <div className="form-row-2col">
                  <div className="form-group">
                    <label htmlFor="user-firstname">First Name</label>
                    <input
                      id="user-firstname"
                      type="text"
                      className="form-input"
                      placeholder="e.g. Aarav"
                      value={newUserForm.firstName}
                      onChange={(e) =>
                        setNewUserForm((prev) => ({ ...prev, firstName: e.target.value }))
                      }
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="user-lastname">Last Name</label>
                    <input
                      id="user-lastname"
                      type="text"
                      className="form-input"
                      placeholder="e.g. Patel"
                      value={newUserForm.lastName}
                      onChange={(e) =>
                        setNewUserForm((prev) => ({ ...prev, lastName: e.target.value }))
                      }
                    />
                  </div>
                </div>

                {/* Student-specific field */}
                {newUserForm.role === 'student' && (
                  <div className="form-group">
                    <label htmlFor="user-enrollment">Enrollment / Registration Number</label>
                    <input
                      id="user-enrollment"
                      type="text"
                      className="form-input font-mono"
                      placeholder="e.g. 22BCE1042"
                      value={newUserForm.enrollmentNumber}
                      onChange={(e) =>
                        setNewUserForm((prev) => ({
                          ...prev,
                          enrollmentNumber: e.target.value.toUpperCase(),
                        }))
                      }
                    />
                  </div>
                )}

                {/* Faculty-specific fields */}
                {newUserForm.role === 'faculty' && (
                  <>
                    <div className="form-row-2col">
                      <div className="form-group">
                        <label htmlFor="faculty-dept">Department</label>
                        <input
                          id="faculty-dept"
                          type="text"
                          className="form-input"
                          placeholder="e.g. SCOPE - School of Computer Science"
                          value={newUserForm.department}
                          onChange={(e) =>
                            setNewUserForm((prev) => ({ ...prev, department: e.target.value }))
                          }
                        />
                      </div>
                      <div className="form-group">
                        <label htmlFor="faculty-title">Title / Designation</label>
                        <input
                          id="faculty-title"
                          type="text"
                          className="form-input"
                          placeholder="e.g. Associate Professor"
                          value={newUserForm.title}
                          onChange={(e) =>
                            setNewUserForm((prev) => ({ ...prev, title: e.target.value }))
                          }
                        />
                      </div>
                    </div>
                    <div className="form-group">
                      <label htmlFor="faculty-empid">Employee ID (Optional)</label>
                      <input
                        id="faculty-empid"
                        type="text"
                        className="form-input font-mono"
                        placeholder="e.g. EMP1099 (auto-generated if left blank)"
                        value={newUserForm.employeeId}
                        onChange={(e) =>
                          setNewUserForm((prev) => ({
                            ...prev,
                            employeeId: e.target.value.toUpperCase(),
                          }))
                        }
                      />
                    </div>
                  </>
                )}
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setIsAddUserOpen(false)}
                  disabled={userFormLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={userFormLoading}
                >
                  {userFormLoading ? (
                    <span>Registering User...</span>
                  ) : (
                    <>
                      <UserPlus size={16} />
                      <span>Create Account</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
