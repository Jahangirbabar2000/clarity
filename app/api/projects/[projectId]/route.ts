import { NextResponse } from "next/server";
import { getEffectiveUserId } from "@/lib/auth/demo-user";
import { getProjectById } from "@/lib/db/queries";
import { prisma } from "@/lib/db/client";

export const dynamic = "force-dynamic";

export async function DELETE(_req: Request, { params }: { params: { projectId: string } }) {
  const userId = await getEffectiveUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const project = await getProjectById(params.projectId, userId);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.user.updateMany({
    where: { lastVisitedProjectId: params.projectId },
    data: { lastVisitedProjectId: null },
  });

  await prisma.organization.delete({ where: { id: params.projectId } });

  return NextResponse.json({ ok: true });
}
