import { verifyToken } from './jwt.js'

const SESSION_COOKIE = 'feudum_session'
const COOKIE_OPTS = `Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 30}`

export function getSessionUserId(req) {
  const cookieHeader = req.headers.cookie ?? ''
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]+)`))
  const token = match?.[1]
  if (!token) return Promise.resolve(null)
  return verifyToken(token)
}

export function setSessionCookie(res, token) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=${token}; ${COOKIE_OPTS}${secure}`)
}

export function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=; Path=/; HttpOnly; Max-Age=0`)
}
