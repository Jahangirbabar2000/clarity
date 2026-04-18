"use client";

import { useSession, signOut, signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { LogOut, LogIn } from "lucide-react";

export function TopBar({ title }: { title?: string }) {
  const { data: session, status } = useSession();
  return (
    <header className="flex h-14 items-center justify-between gap-4 border-b bg-background px-4 md:px-6">
      <div className="flex items-center gap-3">
        <h1 className="text-base font-semibold">{title ?? "Clarity"}</h1>
      </div>
      <div className="flex items-center gap-2">
        {status === "authenticated" && session?.user ? (
          <>
            <div className="hidden text-right text-xs md:block">
              <div className="font-medium">{session.user.name}</div>
              <div className="text-muted-foreground">{session.user.email}</div>
            </div>
            <Button variant="ghost" size="icon" onClick={() => signOut()} title="Sign out">
              <LogOut className="h-4 w-4" />
            </Button>
          </>
        ) : (
          <Button variant="outline" size="sm" onClick={() => signIn("github")}>
            <LogIn className="h-4 w-4" /> Sign in
          </Button>
        )}
      </div>
    </header>
  );
}
