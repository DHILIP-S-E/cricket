import { Sparkles } from "lucide-react";
import { Card, CardHeader } from "./ui";
import type { CoachAdvice } from "../api/cricket";

/** Shared LLM "agent" advisory card used on the Pre-Match and Live pages. */
export function CoachAdvisorCard({ title, advice }: {
  title: string;
  advice: CoachAdvice | undefined;
}) {
  return (
    <Card className="border-l-4 border-l-brand">
      <CardHeader
        title={title}
        subtitle={advice?.available ? `AI reasoning · ${advice.provider}` : "Add GEMINI_API_KEY for live reasoning"}
        right={<Sparkles size={14} className="text-brand" />}
      />
      <p className="text-xs text-text-secondary leading-relaxed">
        {advice?.advice ?? "Thinking…"}
      </p>
      {advice && !advice.available && (
        <p className="text-[10px] text-text-tertiary mt-2 italic">
          Using ML reasoning — set a Gemini key in backend/.env to enable the LLM agent.
        </p>
      )}
    </Card>
  );
}
