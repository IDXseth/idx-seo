import 'dotenv/config'
import { defineConfig } from 'prisma/config'

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    // Use direct (non-pooled) URL for migrations; fall back to pooler URL
    url: process.env['DIRECT_URL'] ?? process.env['DATABASE_URL'],
  },
})
