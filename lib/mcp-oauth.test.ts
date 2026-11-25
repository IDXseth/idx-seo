import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { isAllowedRedirectUri, redirectUriMatches, verifyPkce } from './mcp/oauth'

test('PKCE S256 accepts the matching verifier only', () => {
  const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk'
  const challenge = createHash('sha256').update(verifier).digest('base64url')
  assert.equal(challenge, 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM') // RFC 7636 appendix B
  assert.equal(verifyPkce(verifier, challenge), true)
  assert.equal(verifyPkce(verifier.replace('d', 'e'), challenge), false)
  assert.equal(verifyPkce('short', challenge), false)
})

test('redirect URIs must be https or loopback http', () => {
  assert.equal(isAllowedRedirectUri('https://claude.ai/api/mcp/auth_callback'), true)
  assert.equal(isAllowedRedirectUri('http://localhost:6274/callback'), true)
  assert.equal(isAllowedRedirectUri('http://127.0.0.1:33418/callback'), true)
  assert.equal(isAllowedRedirectUri('http://evil.example/callback'), false)
  assert.equal(isAllowedRedirectUri('javascript:alert(1)'), false)
  assert.equal(isAllowedRedirectUri('https://claude.ai/cb#frag'), false)
})

test('redirect URI matching is exact, except loopback ports', () => {
  const registered = ['https://claude.ai/api/mcp/auth_callback', 'http://localhost:6274/callback']
  assert.equal(redirectUriMatches(registered, 'https://claude.ai/api/mcp/auth_callback'), true)
  assert.equal(redirectUriMatches(registered, 'https://claude.ai/api/mcp/auth_callback/x'), false)
  assert.equal(redirectUriMatches(registered, 'http://localhost:9999/callback'), true)
  assert.equal(redirectUriMatches(registered, 'http://localhost:9999/other'), false)
})
