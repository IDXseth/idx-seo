import { serve } from 'inngest/next'
import { inngest } from '@/lib/inngest'
import { batchFanOut, runSinglePrompt, checkSchedules, refreshGsc } from '@/inngest/functions'

// A prompt's query step must finish within one request: it queries every
// platform in parallel, each capped at PLATFORM_TIMEOUT_MS (inngest/functions.ts).
export const maxDuration = 300

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [batchFanOut, runSinglePrompt, checkSchedules, refreshGsc],
})
