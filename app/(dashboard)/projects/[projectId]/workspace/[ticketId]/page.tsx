import { notFound } from "next/navigation";
import { getTicketWithRelations } from "@/lib/db/queries";
import { TicketEditor } from "@/components/workspace/TicketEditor";

export const dynamic = "force-dynamic";

export default async function TicketPage({ params }: { params: { ticketId: string } }) {
  const ticket = await getTicketWithRelations(params.ticketId);
  if (!ticket) notFound();

  const contextSummary = {
    sources: {
      github: ticket.contextSources.includes("github"),
      jira: ticket.contextSources.includes("jira"),
      notion: ticket.contextSources.includes("notion"),
      prd: ticket.contextSources.includes("prd"),
      existingTickets: 0,
    },
  };

  return <TicketEditor ticket={ticket} contextSummary={contextSummary} />;
}
