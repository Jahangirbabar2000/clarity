"use client";

import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Github, Sparkles } from "lucide-react";

export default function LoginPage() {
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
          <Button onClick={() => signIn("github", { callbackUrl: "/" })} className="w-full">
            <Github className="h-4 w-4" /> Continue with GitHub
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            Demo mode: you can also browse without auth when{" "}
            <code className="rounded bg-muted px-1">CLARITY_USE_MOCKS=true</code>.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
