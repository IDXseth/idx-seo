import { serve } from 'inngest/next'
import { inngest } from '@/lib/inngest'
import { batchFanOut, runSinglePrompt } from '@/inngest/functions'

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [batchFanOut, runSinglePrompt],
})
