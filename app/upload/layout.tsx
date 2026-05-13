import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'

export default async function UploadLayout({ children }: { children: React.ReactNode }) {
  try {
    const session = await auth()
    if (!session) redirect('/login?callbackUrl=/upload')
  } catch {
    redirect('/login?callbackUrl=/upload')
  }
  return <>{children}</>
}
