import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/client";
import { openai, OPENAI_MODEL, isAIConfigured, stripJsonFences } from "@/lib/ai/client";
import { TICKET_REFINE_PROMPT } from "@/lib/ai/prompts";

const schema = z.object({
  ticketId: z.string(),
  field: z.enum(["title", "description", "acceptanceCriteria", "edgeCases", "outOfScope", "subtasks"]),
  editRequest: z.string().min(1),
});

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Bad input" }, { status: 400 });
  const { ticketId, field, editRequest } = parsed.data;

  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: { subtasks: { orderBy: { order: "asc" } } },
  });
  if (!ticket) return NextResponse.json({ error: "Ticket not found" }, { status: 404 });

  const currentValue =
    field === "title"
      ? ticket.title
      : field === "description"
      ? ticket.description
      : field === "acceptanceCriteria"
      ? ticket.acceptanceCriteria
      : field === "edgeCases"
      ? ticket.edgeCases
      : field === "outOfScope"
      ? ticket.outOfScope
      : ticket.subtasks.map((s) => ({ title: s.title, description: s.description, type: s.type, storyPoints: s.storyPoints, priority: s.priority }));

  let updatedValue: unknown;

  if (!isAIConfigured()) {
    updatedValue = mockRefine(field, currentValue, editRequest);
  } else {
    try {
      const resp = await openai().chat.completions.create({
        model: OPENAI_MODEL,
        max_tokens: 2000,
        messages: [
          { role: "system", content: TICKET_REFINE_PROMPT },
          {
            role: "user",
            content: JSON.stringify({
              field,
              currentValue,
              editRequest,
              ticketContext: { title: ticket.title, description: ticket.description },
            }),
          },
        ],
      });
      const text = resp.choices[0].message.content ?? "";
      const cleaned = stripJsonFences(text);
      try {
        updatedValue = JSON.parse(cleaned);
      } catch {
        updatedValue = field === "title" || field === "description" ? cleaned : currentValue;
      }
    } catch {
      updatedValue = mockRefine(field, currentValue, editRequest);
    }
  }

  if (field === "subtasks" && Array.isArray(updatedValue)) {
    await prisma.subtask.deleteMany({ where: { ticketId } });
    await prisma.subtask.createMany({
      data: (updatedValue as Array<{ title: string; description: string; type: string; storyPoints: number; priority: string }>).map(
        (s, i) => ({
          ticketId,
          title: s.title,
          description: s.description,
          type: s.type as never,
          storyPoints: s.storyPoints,
          priority: s.priority as never,
          dependsOn: [],
          order: i,
        }),
      ),
    });
  } else {
    const data: Record<string, unknown> = {};
    data[field] = updatedValue;
    await prisma.ticket.update({ where: { id: ticketId }, data });
  }

  return NextResponse.json({ field, value: updatedValue });
}

function mockRefine(field: string, current: unknown, request: string) {
  if (typeof current === "string") return `${current}\n\n[Refined: ${request}]`;
  if (Array.isArray(current)) return [...current, `Added based on: ${request}`];
  return current;
}
