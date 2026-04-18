import { NextResponse } from "next/server";
import { mockBuildHealth } from "@/lib/integrations/mock-data";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(mockBuildHealth);
}
