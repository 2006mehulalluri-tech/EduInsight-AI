import { useNavigate } from 'react-router-dom'
import { DEMO_ACCOUNTS, useAuth } from '../../context/AuthContext.jsx'
import { GraduationCap, LogOut, ShieldCheck, UserCheck, Users } from 'lucide-react'

export default function Navbar() {
  const { user, quickSwitch, logout, isAuthenticated } = useAuth()
  const navigate = useNavigate()

  const handleRoleSwitch = async (role) => {
    await quickSwitch(role)
    if (role === 'student') navigate('/student', { replace: true })
    else if (role === 'faculty') navigate('/faculty', { replace: true })
    else if (role === 'administrator') navigate('/admin', { replace: true })
  }

  const handleLogout = async () => {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <header className="navbar-root">
      <div className="navbar-top-banner">
        <div className="container banner-content">
          <span className="banner-badge">VTOP ACADEMIC SYSTEM</span>
          <span className="banner-text">
            Confidence-Aware Institutional Course & Faculty Evaluation Framework
          </span>
          <div className="quick-roles">
            <span className="quick-roles-label">Fast Demo Role Switcher:</span>
            <button
              type="button"
              className={`role-btn ${user?.role === 'student' ? 'active' : ''}`}
              onClick={() => handleRoleSwitch('student')}
              title="Switch to Student account"
            >
              🎓 Student
            </button>
            <button
              type="button"
              className={`role-btn ${user?.role === 'faculty' ? 'active' : ''}`}
              onClick={() => handleRoleSwitch('faculty')}
              title="Switch to Faculty account"
            >
              👨‍🏫 Faculty
            </button>
            <button
              type="button"
              className={`role-btn ${user?.role === 'administrator' ? 'active' : ''}`}
              onClick={() => handleRoleSwitch('administrator')}
              title="Switch to Administrator account"
            >
              🛡️ Admin
            </button>
          </div>
        </div>
      </div>

      <div className="navbar-main container">
        <div
          className="navbar-brand"
          onClick={() =>
            navigate(user?.role ? `/${user.role === 'administrator' ? 'admin' : user.role}` : '/', {
              replace: true,
            })
          }
          style={{ cursor: 'pointer' }}
        >
          <div className="brand-icon">
            <GraduationCap size={28} />
          </div>
          <div>
            <h1 className="brand-title">College Review Quality Analysis System</h1>
            <p className="brand-subtitle">
              Review Reliability Index (RRI) & Confidence-Aware Analytics Engine
            </p>
          </div>
        </div>

        {isAuthenticated && (
          <div className="navbar-user-actions">
            <div className="user-profile-card">
              <span className={`role-pill role-${user.role}`}>
                {user.role === 'student' && '🎓 Student'}
                {user.role === 'faculty' && '👨‍🏫 Faculty'}
                {user.role === 'administrator' && '🛡️ Administrator'}
              </span>
              <div className="user-info-text">
                <span className="user-name">
                  {user.firstName} {user.lastName}
                </span>
                <span className="user-email">{user.email}</span>
              </div>
            </div>

            <button
              type="button"
              className="btn btn-outline btn-sm logout-btn"
              onClick={handleLogout}
              title="Sign out"
            >
              <LogOut size={16} />
              <span>Logout</span>
            </button>
          </div>
        )}
      </div>
    </header>
  )
}
