import type { NextAuthOptions } from "next-auth";
import GitHubProvider from "next-auth/providers/github";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/db/client";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: { strategy: "database" },
  providers: [
    GitHubProvider({
      clientId: process.env.GITHUB_CLIENT_ID ?? "",
      clientSecret: process.env.GITHUB_CLIENT_SECRET ?? "",
    }),
  ],
  pages: { signIn: "/login" },
  callbacks: {
    async session({ session, user }) {
      if (session.user) {
        (session.user as { id?: string }).id = user.id;
      }
      return session;
    },
    async signIn({ user }) {
      if (!user.id) return true;
      const hasOrg = await prisma.orgMember.findFirst({ where: { userId: user.id } });
      if (!hasOrg) {
        const org = await prisma.organization.create({
          data: {
            name: user.name ? `${user.name}'s Workspace` : "My Workspace",
            jiraProjectKey: "CLAR",
          },
        });
        await prisma.orgMember.create({
          data: { orgId: org.id, userId: user.id, role: "OWNER" },
        });
      }
      return true;
    },
  },
};
