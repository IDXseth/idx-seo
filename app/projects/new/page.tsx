import { notFound } from 'next/navigation'
import { getViewer } from '@/lib/access'
import { canCreateProjects } from '@/lib/projects'
import { ProjectForm } from '@/components/project-form'

export const dynamic = 'force-dynamic'

export default async function NewProjectPage() {
  const viewer = await getViewer()
  if (!viewer || !canCreateProjects(viewer)) notFound()

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#084c61]" style={{ fontFamily: 'var(--font-noto-serif), serif' }}>New project</h1>
        <p className="text-[#5a7a85] mt-1 text-sm">
          A project tracks one brand&apos;s visibility in AI answers — its names, its domain, and the competitors to compare it against.
        </p>
      </div>
      <ProjectForm />
    </div>
  )
}
