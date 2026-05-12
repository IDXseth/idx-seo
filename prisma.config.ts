import dotenv from 'dotenv'
import { defineConfig } from 'prisma/config'

// Load .env first, then .env.local (with override so .env.local wins)
dotenv.config()
dotenv.config({ path: '.env.local', override: true })

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: process.env['DATABASE_URL'],
    directUrl: process.env['DIRECT_URL'],
  },
})
