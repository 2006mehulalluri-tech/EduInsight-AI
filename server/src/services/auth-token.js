import jwt from 'jsonwebtoken'
import { config } from '../config/env.js'

const tokenOptions = {
  issuer: 'college-review-system',
  audience: 'college-review-client',
  expiresIn: config.sessionTtl,
}

export function signAuthToken(user) {
  return jwt.sign({ role: user.role }, config.jwtSecret, {
    ...tokenOptions,
    subject: String(user.id),
  })
}

export function verifyAuthToken(token) {
  return jwt.verify(token, config.jwtSecret, tokenOptions)
}

export function getAuthTokenMaxAge(token) {
  const payload = jwt.decode(token)
  if (!payload?.exp) {
    return undefined
  }

  return Math.max(0, payload.exp * 1000 - Date.now())
}
