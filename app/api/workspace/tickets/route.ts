import { NextResponse } from "next/server";
import { ensureDemoOrg, listTickets } from "@/lib/db/queries";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const projectId = url.searchParams.get("projectId") ?? url.searchParams.get("orgId");
  const org = projectId ? { id: projectId } : await ensureDemoOrg();
  const tickets = await listTickets(org.id);
  return NextResponse.json({ tickets });
}
