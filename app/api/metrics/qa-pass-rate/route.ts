import { NextResponse } from "next/server";
import { getQAPassRate } from "@/lib/integrations/jira";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const projectKey = url.searchParams.get("projectKey") ?? "CLAR";
  const n = Number(url.searchParams.get("n") ?? 8);
  try {
    const data = await getQAPassRate(projectKey, n);
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ hasData: false, current: null, previous: null, trend: [] }, { status: 200 });
  }
}
