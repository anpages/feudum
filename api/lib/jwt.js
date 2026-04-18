import { SignJWT, jwtVerify } from 'jose'

function getSecret() {
  const s = process.env.BETTER_AUTH_SECRET
  if (!s) throw new Error('BETTER_AUTH_SECRET not set')
  return new TextEncoder().encode(s)
}

export async function signToken(userId) {
  return new SignJWT({ sub: String(userId) })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(getSecret())
}

export async function verifyToken(token) {
  try {
    const { payload } = await jwtVerify(token, getSecret())
    return payload.sub ? parseInt(payload.sub) : null
  } catch {
    return null
  }
}
