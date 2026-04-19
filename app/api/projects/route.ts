import { NextResponse } from "next/server";
import { getEffectiveUserId } from "@/lib/auth/demo-user";
import { listProjectsForUser, createProject } from "@/lib/db/queries";
import { z } from "zod";

export const dynamic = "force-dynamic";

export async function GET() {
  const userId = await getEffectiveUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const projects = await listProjectsForUser(userId);
  return NextResponse.json({ projects });
}

export async function POST(req: Request) {
  const userId = await getEffectiveUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = z.object({ name: z.string().min(1) }).safeParse(await req.json());
  if (!body.success) return NextResponse.json({ error: "name required" }, { status: 400 });
  const project = await createProject(userId, body.data.name);
  return NextResponse.json({ project });
}
