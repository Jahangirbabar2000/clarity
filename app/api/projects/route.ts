import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { listProjectsForUser, createProject } from "@/lib/db/queries";
import { z } from "zod";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const projects = await listProjectsForUser(session.user.id);
  return NextResponse.json({ projects });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = z.object({ name: z.string().min(1) }).safeParse(await req.json());
  if (!body.success) return NextResponse.json({ error: "name required" }, { status: 400 });
  const project = await createProject(session.user.id, body.data.name);
  return NextResponse.json({ project });
}
