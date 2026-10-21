import { Router } from 'express'
import { config } from '../config/env.js'
import { authenticate } from '../middleware/auth.js'
import {
  findUserByEmail,
  findUserById,
  toPublicUser,
  updateUserLastLogin,
} from '../repositories/users.js'
import {
  getAuthTokenMaxAge,
  signAuthToken,
} from '../services/auth-token.js'
import { verifyPassword } from '../services/password.js'

const router = Router()

function getLoginCredentials(body) {
  if (!body || typeof body !== 'object') {
    return {}
  }

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  const password = typeof body.password === 'string' ? body.password : ''

  return { email, password }
}

router.post('/login', async (request, response) => {
  const { email, password } = getLoginCredentials(request.body)

  if (!email || !password) {
    return response.status(400).json({
      error: 'invalid_credentials',
      message: 'Email and password are required.',
    })
  }

  try {
    const user = findUserByEmail(email)

    if (
      !user ||
      user.status !== 'active' ||
      !(await verifyPassword(password, user.password ?? user.password_hash))
    ) {
      return response.status(401).json({
        error: 'invalid_credentials',
        message: 'Email or password is incorrect.',
      })
    }

    updateUserLastLogin(user.id)
    const token = signAuthToken(user)

    response.cookie(config.authCookieName, token, {
      httpOnly: true,
      secure: config.nodeEnv === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: getAuthTokenMaxAge(token),
    })

    return response.json({ user: toPublicUser(user), token })
  } catch {
    return response.status(500).json({
      error: 'login_failed',
      message: 'Unable to complete login.',
    })
  }
})

router.get('/me', authenticate, (request, response) => {
  const user = findUserById(request.auth.id)

  if (!user || user.status !== 'active') {
    response.clearCookie(config.authCookieName, { path: '/' })
    return response.status(401).json({
      error: 'invalid_session',
      message: 'Your session is invalid or has expired.',
    })
  }

  return response.json({ user: toPublicUser(user) })
})

router.post('/logout', (request, response) => {
  response.clearCookie(config.authCookieName, {
    secure: config.nodeEnv === 'production',
    sameSite: 'lax',
    path: '/',
  })

  return response.json({ status: 'ok' })
})

export default router
