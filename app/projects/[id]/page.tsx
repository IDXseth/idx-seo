import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getViewer } from '@/lib/access'
import { canEditProject, readableProjectWhere } from '@/lib/projects'
import { ProjectForm } from '@/components/project-form'

export const dynamic = 'force-dynamic'

export default async function ProjectSettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await getViewer()
  if (!viewer) notFound()
  const { id } = await params

  const project = await prisma.project.findFirst({
    where: { AND: [{ id }, readableProjectWhere(viewer)] },
    select: {
      name: true,
      primaryDomain: true,
      brandNames: true,
      additionalDomains: true,
      sitemapUrl: true,
      sitemapPathPrefix: true,
      userId: true,
    },
  })
  if (!project) notFound()
  const { userId, ...initial } = project

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#084c61]" style={{ fontFamily: 'var(--font-noto-serif), serif' }}>{project.name}</h1>
        <p className="text-[#5a7a85] mt-1 text-sm">Project settings — how this brand is recognized in AI answers.</p>
      </div>
      <ProjectForm projectId={id} initial={initial} canEdit={canEditProject(viewer, { userId })} />
    </div>
  )
}
