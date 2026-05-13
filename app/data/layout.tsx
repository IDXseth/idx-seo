import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'

export default async function DataLayout({ children }: { children: React.ReactNode }) {
  try {
    const session = await auth()
    if (!session) redirect('/login?callbackUrl=/run')
  } catch {
    redirect('/login?callbackUrl=/run')
  }
  return <>{children}</>
}
