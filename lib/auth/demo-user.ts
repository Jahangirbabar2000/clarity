import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db/client";

export const DEMO_MODE = process.env.CLARITY_USE_MOCKS === "true";

const DEMO_USER_ID = "demo-user";

export async function ensureDemoUser() {
  const existing = await prisma.user.findUnique({ where: { id: DEMO_USER_ID } });
  if (existing) return existing;
  return prisma.user.create({
    data: {
      id: DEMO_USER_ID,
      name: "Demo User",
      email: "demo@clarity.local",
    },
  });
}

export async function getEffectiveUserId(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  if (session?.user?.id) return session.user.id;
  if (DEMO_MODE) {
    const user = await ensureDemoUser();
    return user.id;
  }
  return null;
}
