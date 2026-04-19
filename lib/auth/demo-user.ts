import { cookies } from "next/headers";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db/client";

export const DEMO_MODE = true;

const DEMO_COOKIE = "clarity_demo_user_id";

async function ensureDemoUser(id: string) {
  return prisma.user.upsert({
    where: { id },
    update: {},
    create: {
      id,
      name: "Demo User",
      email: `${id}@clarity.local`,
    },
  });
}

export async function getEffectiveUserId(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  if (session?.user?.id) return session.user.id;

  const demoId = cookies().get(DEMO_COOKIE)?.value;
  if (!demoId) return null;
  const user = await ensureDemoUser(demoId);
  return user.id;
}
