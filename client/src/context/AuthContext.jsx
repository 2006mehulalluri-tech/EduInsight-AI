import { createContext, useContext, useEffect, useState } from 'react'
import { getMe, login as apiLogin, logout as apiLogout, setAuthToken } from '../api.js'

const AuthContext = createContext(null)

export const DEMO_ACCOUNTS = {
  student: { email: 'student@local.test', password: 'Student123!', label: 'Student (Aarav Patel)' },
  faculty: { email: 'faculty@local.test', password: 'Faculty123!', label: 'Faculty (Dr. Rajesh Kumar)' },
  administrator: { email: 'admin@local.test', password: 'Admin123!', label: 'Administrator (Dean Office)' },
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let isCurrent = true

    getMe()
      .then((data) => {
        if (isCurrent && data?.user) {
          setUser(data.user)
        }
      })
      .catch(() => {
        // Not logged in or expired
        if (isCurrent) setUser(null)
      })
      .finally(() => {
        if (isCurrent) setLoading(false)
      })

    return () => {
      isCurrent = false
    }
  }, [])

  const login = async (email, password) => {
    setError('')
    try {
      const data = await apiLogin(email, password)
      if (data.token) {
        setAuthToken(data.token)
      }
      setUser(data.user)
      return data.user
    } catch (err) {
      setError(err.message || 'Login failed')
      throw err
    }
  }

  const quickSwitch = async (role) => {
    const creds = DEMO_ACCOUNTS[role]
    if (!creds) return
    return login(creds.email, creds.password)
  }

  const logout = async () => {
    try {
      await apiLogout()
    } catch {
      // ignore
    } finally {
      setUser(null)
      setAuthToken(null)
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        error,
        login,
        quickSwitch,
        logout,
        isAuthenticated: !!user,
        isStudent: user?.role === 'student',
        isFaculty: user?.role === 'faculty',
        isAdmin: user?.role === 'administrator',
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
