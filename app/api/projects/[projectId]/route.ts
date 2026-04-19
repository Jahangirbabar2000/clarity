import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getProjectById } from "@/lib/db/queries";
import { prisma } from "@/lib/db/client";

export const dynamic = "force-dynamic";

export async function DELETE(_req: Request, { params }: { params: { projectId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const project = await getProjectById(params.projectId, session.user.id);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Clear lastVisitedProjectId if it points to this project
  await prisma.user.updateMany({
    where: { lastVisitedProjectId: params.projectId },
    data: { lastVisitedProjectId: null },
  });

  await prisma.organization.delete({ where: { id: params.projectId } });

  return NextResponse.json({ ok: true });
}
