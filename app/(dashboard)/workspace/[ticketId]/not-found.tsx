import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center">
      <h2 className="text-lg font-semibold">Ticket not found</h2>
      <p className="text-sm text-muted-foreground">It may have been deleted, or the link is wrong.</p>
      <Link href="/workspace"><Button variant="outline">Back to workspace</Button></Link>
    </div>
  );
}
