"use client";

import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Github, Sparkles, Zap } from "lucide-react";

export function LoginCard({ githubEnabled }: { githubEnabled: boolean }) {
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Sparkles className="h-6 w-6" />
          </div>
          <CardTitle className="text-2xl">Sign in to Clarity</CardTitle>
          <CardDescription>AI-powered engineering intelligence</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {githubEnabled && (
            <>
              <Button onClick={() => signIn("github", { callbackUrl: "/projects" })} className="w-full">
                <Github className="h-4 w-4" /> Sign in with GitHub
              </Button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-muted"></span>
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">Or</span>
                </div>
              </div>
            </>
          )}

          <Button
            variant={githubEnabled ? "outline" : "default"}
            onClick={() => router.push("/projects")}
            className="w-full"
          >
            <Zap className="h-4 w-4" /> Continue in Demo Mode
          </Button>

          <p className="text-center text-xs text-muted-foreground">
            {githubEnabled
              ? "Demo mode gives you a private sandbox — no GitHub account required."
              : "Each browser gets its own private sandbox — no account required."}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
