import { test, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { queryPlatformRaw, dataforseoRetry } from './ai-clients'

// DataForSEO responses are stubbed: each test queues the task results the next
// fetches return, and records whether each request waited for the async AI Overview.
type TaskReply = { status_code: number; status_message?: string; cost: number; result?: unknown[] }
let replies: TaskReply[] = []
let requests: Array<{ path: string; asyncOverview: unknown }> = []
const realFetch = globalThis.fetch

const overview = {
  items: [{
    type: 'ai_overview',
    markdown: 'Clover and Square are popular POS systems.',
    items: [],
    references: [{ url: 'https://www.clover.com/pos', title: 'Clover', domain: 'www.clover.com' }],
  }],
}
const ok = (result: unknown): TaskReply => ({ status_code: 20000, cost: 0.002, result: [result] })
const scrapeFailed: TaskReply = { status_code: 40101, status_message: 'Internal SE Server Error.', cost: 0 }

beforeEach(() => {
  process.env.DATAFORSEO_LOGIN = 'login'
  process.env.DATAFORSEO_PASSWORD = 'password'
  dataforseoRetry.delaysMs = [0, 0]
  replies = []
  requests = []
  globalThis.fetch = (async (url: string, init?: RequestInit) => {
    const task = JSON.parse(String(init?.body))[0]
    requests.push({ path: String(url).replace(/^.*\/v3\//, ''), asyncOverview: task.load_async_ai_overview })
    const reply = replies.shift()
    if (!reply) throw new Error('unexpected request')
    return new Response(JSON.stringify({ status_code: 20000, tasks: [reply] }), { status: 200 })
  }) as typeof fetch
})

afterEach(() => {
  globalThis.fetch = realFetch
})

test('a 40101 is retried, and the free failed attempts are not counted as searches', async () => {
  replies = [scrapeFailed, scrapeFailed, ok(overview)]
  const r = await queryPlatformRaw('google_aio', 'best pos system')
  assert.equal(r.error, undefined)
  assert.match(r.responseText, /Clover and Square/)
  assert.equal(requests.length, 3)
  assert.equal(r.usage?.searchCount, 1)
  assert.equal(r.usage?.costUsd, 0.002)
})

test('after repeated 40101s, an overview from a request without async loading is used', async () => {
  replies = [scrapeFailed, scrapeFailed, scrapeFailed, ok(overview)]
  const r = await queryPlatformRaw('google_aio', 'best pos system')
  assert.equal(r.error, undefined)
  assert.match(r.responseText, /Clover and Square/)
  assert.deepEqual(requests.map((q) => q.asyncOverview), [true, true, true, false])
})

test('the error is kept when the fallback has no overview, never reported as "no AI Overview"', async () => {
  replies = [scrapeFailed, scrapeFailed, scrapeFailed, ok({ items: [{ type: 'organic', url: 'https://example.com' }] })]
  const r = await queryPlatformRaw('google_aio', 'best pos system')
  assert.match(r.responseText, /^\[Error\] DataForSEO task 40101/)
  assert.equal(r.usage?.searchCount, 1)  // only the charged fallback search
})

test('other task errors are not retried or sent to the fallback', async () => {
  replies = [{ status_code: 40501, status_message: 'Invalid Field.', cost: 0 }]
  const r = await queryPlatformRaw('google_aio', 'best pos system')
  assert.match(r.responseText, /^\[Error\] DataForSEO task 40501/)
  assert.equal(requests.length, 1)
})
