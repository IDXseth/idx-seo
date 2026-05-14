import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'

export default async function DataLayout({ children }: { children: React.ReactNode }) {
  try {
    const session = await auth()
    if (!session) redirect('/login?callbackUrl=/data')
  } catch {
    redirect('/login?callbackUrl=/data')
  }
  return <>{children}</>
}
