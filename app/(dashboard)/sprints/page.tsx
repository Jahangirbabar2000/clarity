import { ensureDemoOrg, listSprintsForOrg } from "@/lib/db/queries";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function SprintsPage() {
  const org = await ensureDemoOrg();
  const sprints = await listSprintsForOrg(org.id);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Sprint plan</h2>
        <p className="text-sm text-muted-foreground">All scheduled subtasks grouped by sprint.</p>
      </div>

      {sprints.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No sprints yet. Build a ticket and auto-assign subtasks to see a plan.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          {sprints.map((s) => {
            const over = s.committedPoints > s.velocityTarget;
            const pct = Math.min(100, Math.round((s.committedPoints / Math.max(s.velocityTarget, 1)) * 100));
            return (
              <Card key={s.id}>
                <CardHeader className="gap-1 pb-2">
                  <CardTitle className="flex items-center justify-between text-sm">
                    {s.name}
                    <Badge variant={over ? "destructive" : "secondary"}>
                      {s.committedPoints} / {s.velocityTarget}
                    </Badge>
                  </CardTitle>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div className={over ? "h-full bg-red-500" : "h-full bg-emerald-500"} style={{ width: `${pct}%` }} />
                  </div>
                  <p className="text-xs text-muted-foreground">{s.goal}</p>
                </CardHeader>
                <CardContent className="space-y-1.5">
                  {s.assignments.length === 0 ? (
                    <div className="text-xs text-muted-foreground">No subtasks scheduled</div>
                  ) : (
                    s.assignments.map((a) => (
                      <Link
                        key={a.id}
                        href={`/workspace/${a.ticketId}`}
                        className="flex items-center justify-between gap-2 rounded-md border bg-background px-2 py-1.5 text-xs hover:bg-accent/50"
                      >
                        <span className="truncate">{a.subtask.title}</span>
                        <Badge variant="outline">{a.subtask.storyPoints}</Badge>
                      </Link>
                    ))
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
