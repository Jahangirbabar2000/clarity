import { NextResponse } from "next/server";
import { queueSync } from "@/lib/sync/data-sync";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const orgId = body.orgId ?? null;
  const result = await queueSync(orgId);
  return NextResponse.json(result);
}
