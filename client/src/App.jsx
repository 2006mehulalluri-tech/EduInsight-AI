import { useState } from 'react'
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from 'react-router-dom'
import { AuthProvider, DEMO_ACCOUNTS, useAuth } from './context/AuthContext.jsx'
import Navbar from './components/common/Navbar.jsx'
import CourseList from './components/student/CourseList.jsx'
import ReviewRunner from './components/student/ReviewRunner.jsx'
import FacultyDashboard from './components/faculty/FacultyDashboard.jsx'
import AdminDashboard from './components/admin/AdminDashboard.jsx'
import {
  AlertCircle,
  CheckCircle2,
  GraduationCap,
  Lock,
  Mail,
  ShieldCheck,
  UserCheck,
} from 'lucide-react'
import './App.css'

function LoginPage() {
  const { login, quickSwitch, error: authError } = useAuth()
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loginLoading, setLoginLoading] = useState(false)
  const [formError, setFormError] = useState('')

  const handleManualLogin = async (e) => {
    e.preventDefault()
    setFormError('')
    setLoginLoading(true)
    try {
      const user = await login(email, password)
      if (user.role === 'student') navigate('/student', { replace: true })
      else if (user.role === 'faculty') navigate('/faculty', { replace: true })
      else if (user.role === 'administrator') navigate('/admin', { replace: true })
    } catch (err) {
      setFormError(err.message || 'Invalid email or password.')
    } finally {
      setLoginLoading(false)
    }
  }

  const handleQuickLogin = async (role) => {
    try {
      const user = await quickSwitch(role)
      if (role === 'student') navigate('/student', { replace: true })
      else if (role === 'faculty') navigate('/faculty', { replace: true })
      else if (role === 'administrator') navigate('/admin', { replace: true })
      return user
    } catch (err) {
      setFormError(err.message || 'Unable to sign in with the demo account right now.')
      return null
    }
  }

  return (
    <div className="login-page-wrapper">
      <header className="login-header">
        <div className="container header-container">
          <div className="brand-badge">
            <GraduationCap size={24} />
            <span>COLLEGE REVIEW QUALITY ANALYSIS SYSTEM</span>
          </div>
        </div>
      </header>

      <main className="login-main container">
        <div className="login-grid">
          {/* Left side: Project Statement & Academic Research Context */}
          <div className="login-intro-column">
            <span className="eyebrow-tag">SOFTWARE ENGINEERING RESEARCH PROJECT</span>
            <h1 className="intro-hero-title">
              Confidence-Aware Course & Faculty Evaluation Analytics
            </h1>
            <p className="intro-lead">
              Traditional feedback systems treat all responses equally or misclassify feedback as
              "fake". This framework calculates an explainable{' '}
              <strong>Review Reliability Index (RRI 0–100)</strong> based on question-level
              cognitive dwell times, answer revisions, and response consistency.
            </p>

            <div className="project-principles-list">
              <div className="principle-card">
                <div className="principle-icon">
                  <CheckCircle2 size={20} />
                </div>
                <div>
                  <h4>Expected vs. Actual Response Time Benchmark</h4>
                  <p>
                    Calibrates cognitive effort against configured benchmarks to detect mechanical
                    rush and fatigue.
                  </p>
                </div>
              </div>

              <div className="principle-card">
                <div className="principle-icon">
                  <CheckCircle2 size={20} />
                </div>
                <div>
                  <h4>Independent Sentiment Analysis</h4>
                  <p>
                    Critical or negative feedback is not penalized. Rigorous, high-effort negative
                    reviews retain high reliability scores.
                  </p>
                </div>
              </div>

              <div className="principle-card">
                <div className="principle-icon">
                  <CheckCircle2 size={20} />
                </div>
                <div>
                  <h4>Interactive Confidence Threshold Filtering</h4>
                  <p>
                    Institutional decision-makers filter analytics using an interactive RRI slider
                    to derive high-fidelity insights.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Right side: Login Card + One-Click Evaluator Switchers */}
          <div className="login-form-column">
            <div className="login-card">
              <h2 className="card-heading">Institutional Access</h2>
              <p className="card-subheading">
                Sign in with your role-based academic credentials or use quick-demo buttons.
              </p>

              {(formError || authError) && (
                <div className="alert alert-error">
                  <AlertCircle size={18} />
                  <span>{formError || authError}</span>
                </div>
              )}

              <form onSubmit={handleManualLogin} className="login-form">
                <div className="form-group">
                  <label htmlFor="email">Email Address</label>
                  <div className="input-icon-wrapper">
                    <Mail size={16} className="input-icon" />
                    <input
                      id="email"
                      type="email"
                      className="form-input"
                      placeholder="e.g. faculty@local.test"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="password">Password</label>
                  <div className="input-icon-wrapper">
                    <Lock size={16} className="input-icon" />
                    <input
                      id="password"
                      type="password"
                      className="form-input"
                      placeholder="••••••••••••"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="btn btn-primary btn-block btn-lg"
                  disabled={loginLoading}
                >
                  {loginLoading ? 'Signing In...' : 'Sign In'}
                </button>
              </form>

              {/* Instant Demo Quick-Access for Evaluator */}
              <div className="demo-accounts-section">
                <div className="divider-label">
                  <span>EVALUATION DEMO QUICK ACCESS</span>
                </div>

                <div className="demo-buttons-column">
                  <button
                    type="button"
                    className="btn btn-demo-role role-student"
                    onClick={() => handleQuickLogin('student')}
                  >
                    <div className="demo-btn-left">
                      <GraduationCap size={18} />
                      <div>
                        <strong>Student Portal</strong>
                        <span className="demo-email">student@local.test</span>
                      </div>
                    </div>
                    <span className="demo-badge">11 VTOP Courses</span>
                  </button>

                  <button
                    type="button"
                    className="btn btn-demo-role role-faculty"
                    onClick={() => handleQuickLogin('faculty')}
                  >
                    <div className="demo-btn-left">
                      <UserCheck size={18} />
                      <div>
                        <strong>Faculty Portal</strong>
                        <span className="demo-email">faculty@local.test</span>
                      </div>
                    </div>
                    <span className="demo-badge">RRI Slider & Summaries</span>
                  </button>

                  <button
                    type="button"
                    className="btn btn-demo-role role-admin"
                    onClick={() => handleQuickLogin('administrator')}
                  >
                    <div className="demo-btn-left">
                      <ShieldCheck size={18} />
                      <div>
                        <strong>Administrator Portal</strong>
                        <span className="demo-email">admin@local.test</span>
                      </div>
                    </div>
                    <span className="demo-badge">Course Hierarchy</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

function ProtectedRoute({ children, allowedRole }) {
  const { user, loading, isAuthenticated } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="loading-state container py-16">
        <div className="spinner" />
        <p>Verifying academic session...</p>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (allowedRole && user?.role !== allowedRole) {
    const fallbackPath =
      user?.role === 'administrator' ? '/admin' : user?.role === 'faculty' ? '/faculty' : '/student'
    return <Navigate to={fallbackPath} replace />
  }

  return children
}

function RoleHomeRedirect() {
  const { user, isAuthenticated, loading } = useAuth()

  if (loading) return null

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  if (user?.role === 'student') return <Navigate to="/student" replace />
  if (user?.role === 'faculty') return <Navigate to="/faculty" replace />
  if (user?.role === 'administrator') return <Navigate to="/admin" replace />

  return <Navigate to="/login" replace />
}

function AppContent() {
  const { isAuthenticated } = useAuth()

  return (
    <div className="app-shell-container">
      {isAuthenticated && <Navbar />}

      <main className="app-main-content">
        <Routes>
          <Route path="/" element={<RoleHomeRedirect />} />
          <Route path="/login" element={<LoginPage />} />

          {/* Student Routes */}
          <Route
            path="/student"
            element={
              <ProtectedRoute allowedRole="student">
                <CourseList />
              </ProtectedRoute>
            }
          />
          <Route
            path="/student/evaluate/:courseId"
            element={
              <ProtectedRoute allowedRole="student">
                <ReviewRunner />
              </ProtectedRoute>
            }
          />

          {/* Faculty Routes */}
          <Route
            path="/faculty"
            element={
              <ProtectedRoute allowedRole="faculty">
                <FacultyDashboard />
              </ProtectedRoute>
            }
          />

          {/* Admin Routes */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute allowedRole="administrator">
                <AdminDashboard />
              </ProtectedRoute>
            }
          />

          {/* Catch-all */}
          <Route path="*" element={<RoleHomeRedirect />} />
        </Routes>
      </main>

      {isAuthenticated && (
        <footer className="app-footer">
          <div className="container footer-content">
            <p>
              <strong>College Review Quality Analysis System</strong> — Final Year Software
              Development / Software Engineering Project.
            </p>
            <p className="footer-subtext">
              Core Novelty: Estimating Review Reliability Index (RRI 0–100) via question-level
              cognitive dwell times, benchmark comparison, and confidence-aware analytics.
            </p>
          </div>
        </footer>
      )}
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </BrowserRouter>
  )
}
