import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined }

function createClient() {
  // Use the transaction pooler (DATABASE_URL, port 6543) — the direct
  // connection (DIRECT_URL, port 5432) is unreachable from Vercel runtime.
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    // Disable prepared statements — required for PgBouncer transaction mode.
    statement_timeout: 30000,
  })
  const adapter = new PrismaPg(pool)
  return new PrismaClient({ adapter })
}

export const prisma = globalForPrisma.prisma ?? createClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
