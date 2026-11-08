/**
 * Which repository is asking? A GitHub Actions run can prove it with an OIDC token: a JWT that GitHub signs,
 * valid for minutes, naming the repository and workflow. Projects then need no secret at all to use the hub:
 * nothing is created, copied or stored. Checked here with WebCrypto (Workers and Node), against GitHub's keys.
 */
const ISSUER = 'https://token.actions.githubusercontent.com'
const JWKS = `${ISSUER}/.well-known/jwks`
const LEEWAY = 60 // seconds of clock difference tolerated

let keys // GitHub's signing keys, cached per process (refetched once when a key id is unknown)
const fetchKeys = async (fetchImpl = fetch) => {
  const res = await fetchImpl(JWKS)
  if (!res.ok) throw Object.assign(new Error(`GitHub OIDC keys: ${res.status}`), { status: 502 })
  keys = (await res.json()).keys ?? []
  return keys
}

const b64 = (part) => Uint8Array.from(atob(part.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(part.length / 4) * 4, '=')), (c) => c.charCodeAt(0))
const json = (part) => JSON.parse(new TextDecoder().decode(b64(part)))
const refuse = (reason) => Object.assign(new Error(`not a valid GitHub Actions identity: ${reason}`), { status: 401 })

/**
 * Verify a GitHub Actions OIDC token for `audience` (this hub's URL). Returns its claims (e.g. `repository`:
 * "owner/name", `workflow_ref`); throws (status 401) for anything else: other issuers, audiences, expired,
 * not RS256, or a bad signature.
 */
export const verifyGithubIdentity = async (token, { audience, fetchImpl, now = Math.floor(Date.now() / 1000) } = {}) => {
  const parts = String(token ?? '').split('.')
  if (parts.length !== 3) throw refuse('malformed')
  let header, claims
  try {
    header = json(parts[0])
    claims = json(parts[1])
  } catch {
    throw refuse('malformed')
  }
  if (header.alg !== 'RS256') throw refuse('algorithm')
  if (claims.iss !== ISSUER) throw refuse('issuer')
  if (![claims.aud].flat().includes(audience)) throw refuse('audience')
  if (!(claims.exp + LEEWAY > now) || (claims.nbf && claims.nbf - LEEWAY > now)) throw refuse('expired')
  if (typeof claims.repository !== 'string' || !/^[\w.-]+\/[\w.-]+$/.test(claims.repository)) throw refuse('repository')
  let jwk = (keys ?? []).find((k) => k.kid === header.kid)
  if (!jwk) jwk = (await fetchKeys(fetchImpl)).find((k) => k.kid === header.kid)
  if (!jwk) throw refuse('unknown key')
  const key = await crypto.subtle.importKey('jwk', { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: 'RS256', ext: true }, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify'])
  const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64(parts[2]), new TextEncoder().encode(`${parts[0]}.${parts[1]}`))
  if (!ok) throw refuse('signature')
  return claims
}

/** The identity on a request (Authorization: Bearer <GitHub OIDC token>), or null when there is none. */
export const requestIdentity = async (request, { audience, fetchImpl } = {}) => {
  const auth = request.headers.get('authorization') ?? ''
  if (!auth.startsWith('Bearer ')) return null
  return verifyGithubIdentity(auth.slice(7), { audience, fetchImpl })
}

/** For tests: forget the cached keys. */
export const resetKeys = () => {
  keys = undefined
}
