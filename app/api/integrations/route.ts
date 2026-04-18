import { NextResponse } from "next/server";
import { z } from "zod";
import type { IntegrationType } from "@prisma/client";
import { prisma } from "@/lib/db/client";
import { ensureDemoOrg } from "@/lib/db/queries";

const TYPES = ["GITHUB", "JIRA", "SENTRY", "DATADOG", "NOTION", "CI", "PRD_UPLOAD"] as const;

const bodySchema = z.object({
  type: z.enum(TYPES),
  accessToken: z.string().min(1).optional(),
  refreshToken: z.string().optional(),
  meta: z.record(z.unknown()).optional(),
});

export const dynamic = "force-dynamic";

export async function GET() {
  const org = await ensureDemoOrg();
  const integrations = await prisma.integration.findMany({ where: { orgId: org.id } });
  const statuses = TYPES.map((t) => {
    const found = integrations.find((i) => i.type === t);
    return {
      type: t,
      connected: Boolean(found),
      lastSyncedAt: found?.lastSyncedAt ? found.lastSyncedAt.toISOString() : null,
      meta: (found?.meta as Record<string, unknown> | undefined) ?? {},
    };
  });
  return NextResponse.json({ integrations: statuses });
}

export async function POST(req: Request) {
  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Bad input" }, { status: 400 });
  const org = await ensureDemoOrg();
  const data = parsed.data;
  const existing = await prisma.integration.findFirst({ where: { orgId: org.id, type: data.type } });
  if (existing) {
    await prisma.integration.update({
      where: { id: existing.id },
      data: {
        accessToken: data.accessToken ?? existing.accessToken,
        refreshToken: data.refreshToken ?? existing.refreshToken,
        meta: data.meta ?? (existing.meta ?? undefined),
      },
    });
  } else {
    await prisma.integration.create({
      data: {
        orgId: org.id,
        type: data.type,
        accessToken: data.accessToken ?? "placeholder",
        refreshToken: data.refreshToken,
        meta: data.meta ?? {},
      },
    });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const url = new URL(req.url);
  const type = url.searchParams.get("type");
  if (!type || !(TYPES as readonly string[]).includes(type)) {
    return NextResponse.json({ error: "bad type" }, { status: 400 });
  }
  const org = await ensureDemoOrg();
  await prisma.integration.deleteMany({
    where: { orgId: org.id, type: type as IntegrationType },
  });
  return NextResponse.json({ ok: true });
}
