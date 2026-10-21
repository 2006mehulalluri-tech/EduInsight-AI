import { config } from '../config/env.js'
import { verifyAuthToken } from '../services/auth-token.js'

const allowedRoles = new Set(['student', 'faculty', 'administrator'])

export function authenticate(request, response, next) {
  const cookieToken = request.cookies?.[config.authCookieName]
  const headerToken = request.headers?.authorization?.startsWith('Bearer ')
    ? request.headers.authorization.slice(7)
    : null
  const token = cookieToken || headerToken

  if (!token) {
    return response.status(401).json({
      error: 'authentication_required',
      message: 'Please log in to continue.',
    })
  }

  try {
    const payload = verifyAuthToken(token)
    const userId = Number.parseInt(payload.sub, 10)

    if (!Number.isInteger(userId) || !allowedRoles.has(payload.role)) {
      throw new Error('Invalid authentication payload')
    }

    request.auth = {
      id: userId,
      role: payload.role,
    }
    return next()
  } catch {
    return response.status(401).json({
      error: 'invalid_session',
      message: 'Your session is invalid or has expired.',
    })
  }
}

export function requireRoles(...roles) {
  return function authorize(request, response, next) {
    if (!request.auth) {
      return response.status(401).json({
        error: 'authentication_required',
        message: 'Please log in to continue.',
      })
    }

    if (!roles.includes(request.auth.role)) {
      return response.status(403).json({
        error: 'forbidden',
        message: 'Your role does not permit this action.',
      })
    }

    return next()
  }
}
