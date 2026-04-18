import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { ensureDemoOrg } from "@/lib/db/queries";
import { parsePRDBuffer } from "@/lib/integrations/prd-parser";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "file required" }, { status: 400 });
  const buf = Buffer.from(await file.arrayBuffer());
  const text = await parsePRDBuffer(buf, file.type);
  const org = await ensureDemoOrg();
  await prisma.prdUpload.create({
    data: { orgId: org.id, filename: file.name, mimeType: file.type, extracted: text.slice(0, 50_000) },
  });
  await prisma.integration.upsert({
    where: { orgId_type: { orgId: org.id, type: "PRD_UPLOAD" } },
    create: { orgId: org.id, type: "PRD_UPLOAD", accessToken: "file", meta: { filename: file.name } },
    update: { meta: { filename: file.name } },
  });
  return NextResponse.json({ ok: true, filename: file.name, length: text.length });
}

export async function GET() {
  const org = await ensureDemoOrg();
  const latest = await prisma.prdUpload.findFirst({ where: { orgId: org.id }, orderBy: { uploadedAt: "desc" } });
  return NextResponse.json({ latest });
}
