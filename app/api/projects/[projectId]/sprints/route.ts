import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getProjectById } from "@/lib/db/queries";
import { prisma } from "@/lib/db/client";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { projectId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const project = await getProjectById(params.projectId, session.user.id);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const sprints = await prisma.sprint.findMany({
    where: { orgId: params.projectId },
    orderBy: { order: "asc" },
    include: {
      assignments: {
        include: {
          subtask: true,
          ticket: { select: { id: true, title: true } },
        },
      },
    },
  });

  return NextResponse.json({ sprints });
}
