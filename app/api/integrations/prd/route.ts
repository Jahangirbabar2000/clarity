import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { ensureDemoOrg } from "@/lib/db/queries";
import { parsePRDBuffer } from "@/lib/integrations/prd-parser";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function resolveOrg(projectId: string | null) {
  if (projectId) {
    const org = await prisma.organization.findUnique({ where: { id: projectId } });
    return org;
  }
  return ensureDemoOrg();
}

export async function POST(req: Request) {
  const form = await req.formData();
  const file = form.get("file");
  const projectId = form.get("projectId") as string | null;
  if (!(file instanceof File)) return NextResponse.json({ error: "file required" }, { status: 400 });
  const buf = Buffer.from(await file.arrayBuffer());
  const text = await parsePRDBuffer(buf, file.type);
  const org = await resolveOrg(projectId);
  if (!org) return NextResponse.json({ error: "Project not found" }, { status: 404 });
  const upload = await prisma.prdUpload.create({
    data: { orgId: org.id, filename: file.name, mimeType: file.type, extracted: text.slice(0, 50_000) },
  });
  return NextResponse.json({ ok: true, upload });
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const projectId = url.searchParams.get("projectId");
  const org = await resolveOrg(projectId);
  if (!org) return NextResponse.json({ prds: [] });
  const prds = await prisma.prdUpload.findMany({
    where: { orgId: org.id },
    orderBy: { uploadedAt: "desc" },
    select: { id: true, filename: true, mimeType: true, uploadedAt: true },
  });
  return NextResponse.json({ prds });
}

export async function DELETE(req: Request) {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await prisma.prdUpload.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
