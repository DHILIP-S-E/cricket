import { useState, useRef, useEffect } from "react";
import { Bot, Send, X, Minimize2, ChevronUp, Loader2, Sparkles } from "lucide-react";
import { analyticsApi, type AgentAnswer } from "../api/analytics";

interface Message {
  id: number;
  role: "user" | "agent";
  text: string;
  answer?: AgentAnswer;
  loading?: boolean;
}

const SUGGESTED = [
  "Who are the top run scorers?",
  "Best death-over bowlers?",
  "Which team has the best win rate?",
  "Best powerplay bowlers in IPL?",
  "Top wicket takers?",
];

let msgId = 0;

export function AgentPanel() {
  const [open, setOpen] = useState(false);
  const [minimised, setMinimised] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    {
      id: ++msgId,
      role: "agent",
      text: "I'm your Cricket AI Agent. I have intelligence on 1,241 IPL matches, 295K ball records, and 964 players. Ask me anything.",
    },
  ]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const ask = async (question: string) => {
    if (!question.trim()) return;
    setInput("");

    const userMsg: Message = { id: ++msgId, role: "user", text: question };
    const loadingMsg: Message = { id: ++msgId, role: "agent", text: "", loading: true };
    setMessages(prev => [...prev, userMsg, loadingMsg]);

    try {
      const res = await analyticsApi.ask(question);
      const answer = res.data;
      setMessages(prev =>
        prev.map(m =>
          m.id === loadingMsg.id
            ? { ...m, loading: false, text: answer.answer, answer }
            : m
        )
      );
    } catch {
      setMessages(prev =>
        prev.map(m =>
          m.id === loadingMsg.id
            ? { ...m, loading: false, text: "Sorry, I couldn't process that. Please try again." }
            : m
        )
      );
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 w-12 h-12 rounded-full bg-[#238636] hover:bg-[#2ea043] shadow-lg flex items-center justify-center transition-all duration-200 z-50 group"
        title="Open AI Agent"
      >
        <Bot size={20} className="text-white" />
        <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-[#22c55e] animate-pulse border-2 border-[#0f1117]" />
      </button>
    );
  }

  return (
    <div className={`fixed right-4 z-50 flex flex-col shadow-2xl rounded-2xl border border-[#30363d] bg-[#161b22] transition-all duration-300 ${
      minimised ? "bottom-4 w-72 h-12" : "bottom-4 w-80 h-[520px]"
    }`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#30363d] rounded-t-2xl bg-[#1c2128]">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full bg-[#238636] flex items-center justify-center flex-shrink-0">
            <Sparkles size={13} className="text-white" />
          </div>
          <div>
            <p className="text-xs font-bold text-gray-100 leading-none">Cricket AI Agent</p>
            <p className="text-[10px] text-[#22c55e] leading-none mt-0.5">● Live · 1,241 IPL matches</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setMinimised(!minimised)} className="p-1 text-gray-500 hover:text-gray-300 transition-colors">
            {minimised ? <ChevronUp size={14} /> : <Minimize2 size={14} />}
          </button>
          <button onClick={() => setOpen(false)} className="p-1 text-gray-500 hover:text-gray-300 transition-colors">
            <X size={14} />
          </button>
        </div>
      </div>

      {!minimised && (
        <>
          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
            {messages.map(msg => (
              <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                {msg.role === "agent" && (
                  <div className="w-5 h-5 rounded-full bg-[#238636] flex items-center justify-center flex-shrink-0 mt-0.5 mr-2">
                    <Bot size={10} className="text-white" />
                  </div>
                )}
                <div className={`max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed ${
                  msg.role === "user"
                    ? "bg-[#238636] text-white rounded-tr-none"
                    : "bg-[#1c2128] text-gray-200 rounded-tl-none border border-[#30363d]"
                }`}>
                  {msg.loading ? (
                    <div className="flex items-center gap-2">
                      <Loader2 size={12} className="animate-spin text-[#22c55e]" />
                      <span className="text-gray-500">Analysing...</span>
                    </div>
                  ) : (
                    <>
                      <p>{msg.text}</p>
                      {msg.answer?.insight && (
                        <p className="mt-1.5 text-[#22c55e] font-medium text-[11px]">
                          💡 {msg.answer.insight}
                        </p>
                      )}
                      {msg.answer?.data && msg.answer.data.length > 0 && (
                        <AgentDataTable data={msg.answer.data} type={msg.answer.type} />
                      )}
                    </>
                  )}
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          {/* Suggestions */}
          {messages.length === 1 && (
            <div className="px-3 pb-2">
              <p className="text-[10px] text-gray-600 mb-1.5 uppercase tracking-wider">Try asking</p>
              <div className="flex flex-wrap gap-1">
                {SUGGESTED.map(s => (
                  <button
                    key={s}
                    onClick={() => ask(s)}
                    className="text-[10px] px-2 py-1 rounded-full border border-[#30363d] text-gray-400 hover:border-[#238636] hover:text-[#22c55e] transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input */}
          <div className="px-3 pb-3">
            <div className="flex items-center gap-2 bg-[#1c2128] border border-[#30363d] rounded-xl px-3 py-2 focus-within:border-[#238636] transition-colors">
              <input
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && ask(input)}
                placeholder="Ask about players, teams, matchups..."
                className="flex-1 bg-transparent text-xs text-gray-200 placeholder-gray-600 outline-none"
              />
              <button
                onClick={() => ask(input)}
                disabled={!input.trim()}
                className="text-[#238636] hover:text-[#22c55e] disabled:text-gray-700 transition-colors"
              >
                <Send size={13} />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Data table renderer ──────────────────────────────────────────────────────

function AgentDataTable({ data, type }: { data: Record<string, unknown>[]; type: string }) {
  if (data.length === 0) return null;

  const cols: Array<{ key: string; label: string; fmt?: (v: unknown) => string }> =
    type === "top_batters" ? [
      { key: "name", label: "Player" },
      { key: "total_runs", label: "Runs", fmt: v => Number(v).toLocaleString() },
      { key: "avg", label: "Avg" },
      { key: "sr", label: "SR" },
    ] :
    type === "top_bowlers" || type === "death_bowlers" || type === "pp_bowlers" ? [
      { key: "name", label: "Player" },
      { key: "total_wickets", label: "Wkts" },
      { key: "economy", label: "Eco" },
    ] :
    type === "team_stats" ? [
      { key: "name", label: "Team" },
      { key: "win_pct", label: "Win%", fmt: v => `${v}%` },
      { key: "wins", label: "W" },
      { key: "played", label: "P" },
    ] : [
      { key: Object.keys(data[0])[0], label: "Name" },
      { key: Object.keys(data[0])[1], label: "Value" },
    ];

  return (
    <div className="mt-2 rounded-lg overflow-hidden border border-[#30363d]">
      <table className="w-full text-[10px]">
        <thead className="bg-[#0f1117]">
          <tr>
            {cols.map(c => (
              <th key={c.key} className="px-2 py-1 text-left text-gray-500 font-medium">{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.slice(0, 5).map((row, i) => (
            <tr key={i} className="border-t border-[#30363d] hover:bg-[#0f1117]">
              {cols.map(c => (
                <td key={c.key} className="px-2 py-1 text-gray-300 font-mono">
                  {c.fmt ? c.fmt(row[c.key]) : String(row[c.key] ?? "—")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
