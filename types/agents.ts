/**
 * Client-safe mirror of the AgentEvent shape emitted by lib/ai/agents.
 *
 * Kept here in types/ so client components can import it without pulling any
 * server-side SDK modules into the client bundle.
 */

export type AgentProviderId = "openai" | "anthropic" | "google";

export type AgentTaskType =
  | "long_context_summary"
  | "creative_longform"
  | "analytical_reasoning"
  | "critique"
  | "refinement"
  | "classification";

export type AgentTarget = { provider: AgentProviderId; model: string };

export type AgentEvent =
  | {
      type: "agent_start";
      agent: string;
      role: string;
      task: AgentTaskType | null;
      target: AgentTarget | null;
      message: string;
      startedAt: number;
    }
  | {
      type: "agent_progress";
      agent: string;
      message: string;
    }
  | {
      type: "agent_stream";
      agent: string;
      text: string;
    }
  | {
      type: "agent_done";
      agent: string;
      durationMs: number;
      summary?: string;
    }
  | {
      type: "agent_error";
      agent: string;
      message: string;
    }
  | {
      type: "reflection";
      iteration: number;
      maxIterations: number;
      verdict: "approved" | "approved_with_notes" | "needs_revision";
      message: string;
    };

export type CritiqueSeverity = "info" | "warning" | "blocker";

export type CritiqueNote = {
  field:
    | "title"
    | "description"
    | "acceptanceCriteria"
    | "edgeCases"
    | "outOfScope"
    | "storyPoints"
    | "subtasks"
    | "general";
  severity: CritiqueSeverity;
  message: string;
  suggestion?: string;
};

export type CritiqueToolCall = {
  name: string;
  args: Record<string, unknown>;
  resultPreview: string;
  durationMs: number;
  error?: string;
};

export type CritiqueReport = {
  verdict: "approved" | "approved_with_notes" | "needs_revision";
  summary: string;
  notes: CritiqueNote[];
  /** Tool calls the Critic made while forming its judgment (tool-use path only). */
  toolCalls?: CritiqueToolCall[];
};
