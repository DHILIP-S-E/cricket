import { useState } from "react";
import { useMutation } from "../lib/query";
import { Sparkles, Send, Wrench, Loader2 } from "lucide-react";
import { scoutApi } from "../api/cricket";
import type { ScoutAnswer } from "../api/cricket";
import { Card, CardHeader, PageHeader } from "../components/ui";

const SUGGESTIONS = [
  "How is the auction going?",
  "What is V Kohli worth?",
  "Find players named Sharma",
  "Which players sold for the most?",
];

interface Turn { q: string; answer: ScoutAnswer | null }

export function Scout() {
  const [input, setInput] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);

  const ask = useMutation({
    mutationFn: (q: string) => scoutApi.ask(q),
    onSuccess: (r, q) => {
      setTurns((t) => t.map((turn) =>
        turn.q === q && turn.answer === null ? { ...turn, answer: r.data ?? null } : turn));
    },
  });

  const submit = (q: string) => {
    const question = q.trim();
    if (!question || ask.isPending) return;
    setTurns((t) => [...t, { q: question, answer: null }]);
    setInput("");
    ask.mutate(question);
  };

  return (
    <div className="flex flex-col h-full bg-surface text-text-primary">
      <PageHeader
        title="AI Scout"
        subtitle="Ask anything — a Gemini agent queries the real data and answers"
        right={<Sparkles size={14} className="text-brand" />}
      />

      <div className="flex-1 overflow-auto p-4 space-y-3">
        {turns.length === 0 && (
          <div className="max-w-xl mx-auto text-center mt-10">
            <div className="w-14 h-14 rounded-2xl bg-brand-muted flex items-center justify-center mx-auto mb-4">
              <Sparkles size={26} className="text-brand" />
            </div>
            <h3 className="text-lg font-extrabold mb-1">Ask the Scout</h3>
            <p className="text-sm text-text-secondary mb-5">
              A tool-using AI agent that searches players, fetches ML valuations, and reads the live auction.
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              {SUGGESTIONS.map((s) => (
                <button key={s} onClick={() => submit(s)}
                  className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-surface-elevated border border-surface-border text-text-secondary hover:text-brand hover:border-brand/40 transition-colors">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {turns.map((t, i) => (
          <div key={i} className="max-w-2xl mx-auto w-full space-y-2">
            <div className="flex justify-end">
              <div className="bg-brand text-white text-sm font-medium px-3 py-2 rounded-2xl rounded-br-sm max-w-[80%]">
                {t.q}
              </div>
            </div>
            <Card>
              {t.answer === null ? (
                <div className="flex items-center gap-2 text-text-secondary text-sm">
                  <Loader2 size={14} className="animate-spin" /> Scout is thinking…
                </div>
              ) : (
                <>
                  <p className="text-sm text-text-primary leading-relaxed whitespace-pre-wrap">{t.answer.answer}</p>
                  {t.answer.steps?.length > 0 && (
                    <div className="mt-3 border-t border-surface-border/50 pt-2 space-y-1">
                      <p className="text-[10px] uppercase tracking-wider font-bold text-text-tertiary">Tools used</p>
                      {t.answer.steps.map((s, j) => (
                        <div key={j} className="flex items-center gap-1.5 text-[11px] text-text-secondary">
                          <Wrench size={11} className="text-brand flex-shrink-0" />
                          <span className="font-mono">{s.tool}({Object.values(s.args).join(", ")})</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <p className="text-[10px] text-text-tertiary mt-2 italic">
                    {t.answer.available ? `Reasoned via ${t.answer.provider}` : "ML fallback — set GEMINI_API_KEY for full agent reasoning"}
                  </p>
                </>
              )}
            </Card>
          </div>
        ))}
      </div>

      {/* Composer */}
      <div className="border-t border-surface-border p-3">
        <div className="max-w-2xl mx-auto flex items-center gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") submit(input); }}
            placeholder="Ask the Scout… e.g. what is Kohli worth?"
            className="flex-1 bg-surface-elevated border border-surface-border rounded-xl px-4 py-2.5 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-brand"
          />
          <button
            onClick={() => submit(input)}
            disabled={ask.isPending || !input.trim()}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand text-white font-bold text-sm hover:opacity-90 transition-opacity disabled:opacity-40"
          >
            {ask.isPending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
          </button>
        </div>
      </div>
    </div>
  );
}
