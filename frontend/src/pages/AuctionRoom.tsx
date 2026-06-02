import { useState, useEffect, useRef } from "react";
import { useQuery, useQueryClient, useMutation } from "../lib/query";
import {
  Gavel, TrendingUp, AlertCircle, ChevronRight, Loader2,
  Play, Pause, SkipForward, Hammer, RotateCcw,
} from "lucide-react";
import { auctionApi } from "../api/cricket";
import type { AuctionEngineState, AdvisorResult } from "../api/cricket";
import { Sparkles } from "lucide-react";
import {
  Card, CardHeader, Stat, Badge, ConfidenceBadge, RoleBadge,
  BudgetMeter, PageHeader, EmptyState,
} from "../components/ui";
import type { TeamAuctionState } from "../types/cricket";
import { useTheme } from "../context/ThemeContext";

const SESSION_ID = import.meta.env.VITE_AUCTION_SESSION_ID ?? "";
const FRANCHISE_ID = import.meta.env.VITE_FRANCHISE_ID ?? "";

const TEAM_COLORS: Record<string, string> = {
  MI: "#004BA0", CSK: "#FFCC00", RCB: "#D1001C", KKR: "#3B1F8C",
  DC: "#0066B2", RR: "#FF69B4", SRH: "#F7A721", PBKS: "#D71920",
  GT: "#1C3D6E", LSG: "#6CBDE7",
};

export function AuctionRoom() {
  const qc = useQueryClient();
  const { franchise: themeFranchise } = useTheme();
  const activeFranchiseId = FRANCHISE_ID || themeFranchise;

  const [engine, setEngine] = useState<AuctionEngineState | null>(null);
  const [playing, setPlaying] = useState(false);
  const [speedMs, setSpeedMs] = useState(1100);

  const { data: teamsRes } = useQuery({
    queryKey: ["auction", "teams", SESSION_ID],
    queryFn: () => auctionApi.teamStates(SESSION_ID),
    refetchInterval: 6000,
    enabled: !!SESSION_ID,
  });
  const teams = teamsRes?.data ?? [];
  const myTeam = teams.find(t => t.franchise_id === activeFranchiseId)
    || teams.find(t => t.franchise_short_name === activeFranchiseId);
  const myFranchiseId = myTeam?.franchise_id ?? activeFranchiseId;

  // AI recommendation for the lot currently under the hammer.
  const lotPlayerId = engine?.lot?.player_id;
  const { data: recRes } = useQuery({
    queryKey: ["auction", "rec", SESSION_ID, myFranchiseId, lotPlayerId],
    queryFn: () => auctionApi.recommendation(SESSION_ID, myFranchiseId),
    enabled: !!lotPlayerId && !!myFranchiseId,
  });
  const rec = recRes?.data;

  // AI Advisor agent (LLM reasoning) for the current lot.
  const { data: advisorRes } = useQuery({
    queryKey: ["auction", "advisor", SESSION_ID, myFranchiseId, lotPlayerId],
    queryFn: () => auctionApi.advisor(SESSION_ID, myFranchiseId),
    enabled: !!lotPlayerId && !!myFranchiseId && engine?.phase === "bidding",
  });
  const advisor = advisorRes?.data;

  const { data: queueRes } = useQuery({
    queryKey: ["auction", "queue", SESSION_ID],
    queryFn: () => auctionApi.queue(SESSION_ID),
    refetchInterval: 12000,
    enabled: !!SESSION_ID,
  });
  const queue = queueRes?.data ?? [];

  const apply = (s?: AuctionEngineState) => {
    if (s) setEngine(s);
    qc.invalidateQueries({ queryKey: ["auction", "teams"] });
  };
  const openM = useMutation({
    mutationFn: () => auctionApi.open(SESSION_ID, myFranchiseId),
    onSuccess: (r) => apply(r.data),
  });
  const tickM = useMutation({
    mutationFn: () => auctionApi.tick(SESSION_ID),
    onSuccess: (r) => apply(r.data),
  });
  const bidM = useMutation({
    mutationFn: (amount: number) => auctionApi.engineBid(SESSION_ID, myFranchiseId, amount),
    onSuccess: (r) => apply(r.data),
  });
  const passM = useMutation({
    mutationFn: () => auctionApi.passLot(SESSION_ID),
    onSuccess: (r) => apply(r.data),
  });

  // Auto-play: tick on an interval until the auction finishes.
  const playingRef = useRef(playing);
  playingRef.current = playing;
  useEffect(() => {
    if (!playing) return;
    const t = setInterval(() => {
      if (playingRef.current && !tickM.isPending) tickM.mutate();
    }, speedMs);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, speedMs]);
  useEffect(() => {
    if (engine?.finished) setPlaying(false);
  }, [engine?.finished]);

  if (!SESSION_ID) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <Gavel size={48} className="mx-auto text-text-tertiary mb-3 animate-bounce" />
          <p className="text-text-secondary text-sm">Set VITE_AUCTION_SESSION_ID in your .env to connect</p>
        </div>
      </div>
    );
  }

  const started = engine !== null && engine.phase !== "idle";

  return (
    <div className="flex flex-col h-full bg-surface text-text-primary">
      <PageHeader
        title="Auction War Room"
        subtitle={engine?.finished ? "Auction complete" : "Live AI-driven auction"}
        right={
          <div className="flex items-center gap-3 text-xs text-text-secondary">
            {engine && (
              <span>
                Sold: <span className="text-brand font-mono font-bold">{engine.total_sold}</span>
                {" "}· Unsold: <span className="text-red-500 font-mono font-bold">{engine.total_unsold}</span>
              </span>
            )}
          </div>
        }
      />

      {/* Control bar */}
      <div className="mx-4 mt-3 flex items-center gap-2 px-3 py-2 rounded-xl bg-surface-card border border-surface-border">
        {!started ? (
          <button
            onClick={() => openM.mutate()}
            disabled={openM.isPending}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-lg bg-brand text-white text-xs font-bold hover:opacity-90 transition-opacity disabled:opacity-40"
          >
            <Play size={13} /> {openM.isPending ? "Opening…" : "Start Auction"}
          </button>
        ) : (
          <>
            <button
              onClick={() => setPlaying((p) => !p)}
              disabled={engine?.finished}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand text-white text-xs font-bold hover:opacity-90 transition-opacity disabled:opacity-40"
            >
              {playing ? <Pause size={13} /> : <Play size={13} />}{playing ? "Pause" : "Auto-play"}
            </button>
            <button
              onClick={() => tickM.mutate()}
              disabled={playing || tickM.isPending || engine?.finished}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-elevated border border-surface-border text-text-primary text-xs font-semibold hover:bg-surface transition-colors disabled:opacity-40"
            >
              <SkipForward size={13} /> Next
            </button>
            <button
              onClick={() => passM.mutate()}
              disabled={engine?.phase !== "bidding"}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-elevated border border-surface-border text-text-secondary text-xs font-semibold hover:text-text-primary transition-colors disabled:opacity-40"
            >
              <Hammer size={13} /> Gavel
            </button>
            <button
              onClick={() => { setPlaying(false); openM.mutate(); }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-elevated border border-surface-border text-text-secondary text-xs font-semibold hover:text-text-primary transition-colors"
            >
              <RotateCcw size={13} /> Restart
            </button>
            <div className="flex items-center gap-1.5 ml-auto">
              <span className="text-[10px] text-text-secondary uppercase font-bold tracking-wider">Speed</span>
              {[{ l: "0.5x", v: 2000 }, { l: "1x", v: 1100 }, { l: "2x", v: 550 }, { l: "Fast", v: 250 }].map((s) => (
                <button key={s.v} onClick={() => setSpeedMs(s.v)}
                  className={`px-2 py-1 rounded text-[11px] font-bold transition-colors ${
                    speedMs === s.v ? "bg-brand text-white" : "bg-surface-elevated text-text-secondary hover:text-text-primary"
                  }`}>{s.l}</button>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="flex-1 overflow-auto">
        <div className="grid grid-cols-12 gap-4 p-4 min-h-full">

          {/* LEFT — Current Lot + bid */}
          <div className="col-span-4 space-y-4">
            <EngineLotCard
              engine={engine}
              rec={rec}
              canBid={!!myTeam}
              bidding={bidM.isPending}
              bidError={bidM.error as Error | null}
              onBid={(amt) => bidM.mutate(amt)}
            />
            {engine?.phase === "bidding" && <AdvisorCard advisor={advisor} />}
            {myTeam && <MySquadCard team={myTeam} />}
          </div>

          {/* CENTRE — Squad builder + team budgets */}
          <div className="col-span-5 space-y-4">
            <SquadSlotGrid team={myTeam} />
            <TeamBudgetsCard teams={teams} myFranchiseId={activeFranchiseId} />
          </div>

          {/* RIGHT — Live bid feed + queue */}
          <div className="col-span-3 space-y-4">
            <BidFeed engine={engine} />
            <QueueCard items={queue} />
          </div>

        </div>
      </div>
    </div>
  );
}

// ─── Engine-driven Current Lot Card ───────────────────────────────────────────

function EngineLotCard({ engine, rec, canBid, bidding, bidError, onBid }: {
  engine: AuctionEngineState | null;
  rec: any;
  canBid: boolean;
  bidding: boolean;
  bidError: Error | null;
  onBid: (amount: number) => void;
}) {
  if (!engine || engine.phase === "idle") {
    return (
      <Card>
        <EmptyState message="Press Start Auction to begin the live bidding" icon={<Gavel size={32} />} />
      </Card>
    );
  }

  if (engine.finished) {
    return (
      <Card className="text-center py-8">
        <Gavel size={32} className="mx-auto text-brand mb-3" />
        <h3 className="text-lg font-extrabold text-text-primary">Auction complete</h3>
        <p className="text-sm text-text-secondary mt-1">
          {engine.total_sold} sold · {engine.total_unsold} unsold
        </p>
      </Card>
    );
  }

  // Between lots — show the gavel result briefly.
  if (engine.phase === "sold" || engine.phase === "unsold") {
    const r = engine.last_result;
    const sold = engine.phase === "sold";
    return (
      <Card className={`border-l-4 ${sold ? "border-l-brand" : "border-l-red-500"}`}>
        <CardHeader title={sold ? "SOLD" : "UNSOLD"} subtitle="Hammer down" />
        <p className="text-lg font-extrabold text-text-primary">{r?.player_name}</p>
        {sold ? (
          <p className="text-sm text-text-secondary mt-1">
            to <span className="font-bold text-brand">{r?.sold_to_name}</span> for{" "}
            <span className="font-mono font-bold text-text-primary">₹{r?.price_cr?.toFixed(2)} Cr</span>
          </p>
        ) : (
          <p className="text-sm text-text-secondary mt-1">No bids met the base price.</p>
        )}
        <p className="text-[11px] text-text-tertiary mt-3">Next lot loading… (Next / Auto-play)</p>
      </Card>
    );
  }

  // phase === "bidding"
  const lot = engine.lot!;
  const price = engine.current_price_cr ?? lot.base_price_cr;
  const nextPrice = +(price + engine.increment_cr).toFixed(2);
  const aiMax = rec?.recommended_max_bid_cr as number | undefined;
  const shouldBid = rec?.should_bid;
  const youHigh = engine.user_is_highest;
  const pips = Array.from({ length: engine.max_countdown });

  return (
    <Card className="relative overflow-hidden">
      <CardHeader
        title={`Lot #${lot.lot_number}`}
        subtitle="Under the hammer"
        right={
          <div className="flex items-center gap-1">
            {pips.map((_, i) => (
              <div key={i} className={`w-1.5 h-4 rounded-full ${
                i < engine.countdown ? "bg-brand" : "bg-surface-border"
              }`} />
            ))}
          </div>
        }
      />

      {/* Current bid + highest bidder */}
      <div className="flex items-center justify-between gap-3 mb-4 p-3 bg-surface-elevated rounded-xl border border-surface-border">
        <div>
          <p className="text-[9px] text-text-secondary uppercase tracking-wider font-extrabold">Current bid</p>
          <p className="text-2xl font-black font-mono text-text-primary">₹{price.toFixed(2)} <span className="text-sm text-text-tertiary">Cr</span></p>
        </div>
        <div className="text-right">
          <p className="text-[9px] text-text-secondary uppercase tracking-wider font-extrabold">Highest</p>
          <p className={`text-sm font-black ${youHigh ? "text-brand" : "text-text-primary"}`}>
            {engine.highest_bidder_name ?? "— no bids —"}{youHigh ? " (You)" : ""}
          </p>
        </div>
      </div>

      {/* Player identity */}
      <div className="flex items-start gap-3 mb-4">
        <div className="w-12 h-12 rounded-xl bg-surface-elevated flex items-center justify-center text-2xl flex-shrink-0 border border-surface-border">🏏</div>
        <div>
          <h2 className="text-base font-extrabold text-text-primary tracking-tight leading-tight">{lot.player_name}</h2>
          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
            <RoleBadge role={lot.playing_role} />
            <Badge label={`Base ₹${lot.base_price_cr} Cr`} variant="gray" />
          </div>
        </div>
      </div>

      {/* AI valuation row */}
      {rec && (
        <div className="grid grid-cols-3 gap-3 mb-3 bg-surface-elevated border border-surface-border rounded-xl p-3">
          <Stat label="AI Fair Value" value={`₹${rec.fair_value_cr?.toFixed(1)}`} sub="Cr" color="text-brand" />
          <Stat label="Max Bid" value={`₹${rec.recommended_max_bid_cr?.toFixed(1)}`} sub="Cr" color="text-amber-500" />
          <Stat label="Verdict" value={shouldBid ? "BID" : "PASS"} color={shouldBid ? "text-brand" : "text-red-500"} />
        </div>
      )}
      {rec?.reasoning && (
        <p className="text-[11px] text-text-secondary leading-relaxed mb-3">{rec.reasoning}</p>
      )}

      {/* Bid actions */}
      <div className="border-t border-surface-border pt-3 space-y-2">
        <button
          onClick={() => onBid(nextPrice)}
          disabled={bidding || !canBid || youHigh}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-brand text-white font-bold text-sm hover:opacity-90 transition-opacity disabled:opacity-40"
        >
          {bidding ? <Loader2 size={15} className="animate-spin" /> : <Gavel size={15} />}
          {youHigh ? "You're the highest bidder" : `Bid ₹${nextPrice.toFixed(2)} Cr`}
        </button>
        {aiMax != null && nextPrice <= aiMax && !youHigh && (
          <button
            onClick={() => onBid(+aiMax.toFixed(2))}
            disabled={bidding || !canBid}
            className="w-full py-2 rounded-xl bg-surface-elevated border border-surface-border text-text-secondary hover:text-brand text-xs font-bold transition-colors disabled:opacity-40"
          >
            Jump to AI max ₹{aiMax.toFixed(2)} Cr
          </button>
        )}
        {!canBid && (
          <p className="text-[10px] text-amber-500 text-center">Log in as this franchise to bid.</p>
        )}
        {bidError && <p className="text-[10px] text-red-500 text-center">{bidError.message}</p>}
      </div>
    </Card>
  );
}

// ─── Live Bid Feed ────────────────────────────────────────────────────────────

function BidFeed({ engine }: { engine: AuctionEngineState | null }) {
  const events = engine?.events ?? [];
  return (
    <Card>
      <CardHeader title="Live Bid Feed" subtitle="Real-time auction activity" right={<div className="live-dot" />} />
      <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
        {events.length === 0 && <EmptyState message="No activity yet" />}
        {events.map((e, i) => {
          const color =
            e.action === "SOLD" ? "text-brand"
            : e.action === "UNSOLD" ? "text-red-500"
            : e.actor === "You" ? "text-brand"
            : "text-text-primary";
          const label =
            e.action === "SOLD" ? `SOLD to ${e.actor}`
            : e.action === "UNSOLD" ? "UNSOLD"
            : e.action === "presented" ? "Presented"
            : `${e.actor} bid`;
          return (
            <div key={i} className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg bg-surface-elevated/40 border border-surface-border/40">
              <div className="min-w-0">
                <p className={`text-xs font-bold truncate ${color}`}>{label}</p>
                <p className="text-[10px] text-text-tertiary truncate">{e.player}</p>
              </div>
              {e.amount != null && (
                <span className="text-xs font-mono font-bold text-text-primary flex-shrink-0">₹{e.amount.toFixed(2)}</span>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// ─── AI Advisor Card (LLM agent) ──────────────────────────────────────────────

function AdvisorCard({ advisor }: { advisor: AdvisorResult | undefined }) {
  const call = advisor?.call ?? "HOLD";
  const callColor =
    call === "BID" ? "bg-brand text-white"
    : call === "PASS" ? "bg-red-500 text-white"
    : "bg-amber-500 text-white";
  return (
    <Card className="border-l-4 border-l-brand">
      <CardHeader
        title="AI Advisor"
        subtitle={
          advisor?.available
            ? `Reasoning · ${advisor.provider}`
            : "Add GEMINI_API_KEY for live reasoning"
        }
        right={<Sparkles size={14} className="text-brand" />}
      />
      <div className="flex items-start gap-3">
        <span className={`px-2 py-1 rounded-lg text-[11px] font-black tracking-wider flex-shrink-0 ${callColor}`}>
          {call}
        </span>
        <p className="text-xs text-text-secondary leading-relaxed">
          {advisor?.advice ?? "Thinking…"}
        </p>
      </div>
      {!advisor?.available && (
        <p className="text-[10px] text-text-tertiary mt-2 italic">
          Currently using ML reasoning. Set a Gemini key in backend/.env to enable the LLM advisor.
        </p>
      )}
    </Card>
  );
}

// ─── My Squad Card ────────────────────────────────────────────────────────────

function MySquadCard({ team }: { team: TeamAuctionState }) {
  return (
    <Card>
      <CardHeader title="My Squad" subtitle={team.franchise_name} />
      <div className="grid grid-cols-2 gap-3 mb-3">
        <BudgetMeter remaining={team.remaining_budget_cr} total={team.initial_purse_cr} label="Purse Balance" />
        <div className="text-right">
          <p className="stat-label">Squad Size</p>
          <p className="text-lg font-black font-mono text-text-primary">{team.squad_size}<span className="text-text-tertiary text-xs font-normal">/{team.squad_size_max}</span></p>
        </div>
      </div>
      <div className="grid grid-cols-4 gap-2 text-center text-xs">
        {[
          { label: "WK", val: team.wk_count, need: 1 },
          { label: "BAT", val: team.batter_count, need: 4 },
          { label: "BWL", val: team.bowler_count, need: 4 },
          { label: "ALR", val: team.all_rounder_count, need: 2 },
        ].map(({ label, val, need }) => (
          <div key={label} className={`rounded-lg p-2 border ${val >= need ? "bg-surface-elevated border-surface-border" : "bg-red-500/5 border-red-500/20 text-red-500"}`}>
            <p className="text-text-tertiary text-[9px] uppercase font-bold">{label}</p>
            <p className={`font-mono font-bold text-sm ${val >= need ? "text-text-primary" : "text-red-500"}`}>{val}</p>
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-between text-xs text-text-secondary border-t border-surface-border/50 pt-2">
        <span>Overseas slots: <strong className="text-text-primary">{team.overseas_slots_used}/{team.overseas_slots_max}</strong></span>
        {team.rtm_available && <Badge label={`RTM ×${team.rtm_count}`} variant="purple" />}
      </div>
    </Card>
  );
}

// ─── Squad Slot Grid ──────────────────────────────────────────────────────────

function SquadSlotGrid({ team }: { team?: TeamAuctionState }) {
  if (!team) return <Card><EmptyState message="Squad data unavailable" /></Card>;

  const bought = team.players_bought ?? [];

  return (
    <Card>
      <CardHeader title="Live Squad Builder" subtitle={`${bought.length} players acquired`} />
      <div className="grid grid-cols-5 gap-2 max-h-64 overflow-y-auto pr-1">
        {Array.from({ length: team.squad_size_max }).map((_, i) => {
          const player = bought[i];
          return (
            <div
              key={i}
              className={`rounded-lg p-2 text-center text-[10px] border transition-all duration-200 ${
                player
                  ? "bg-surface-elevated border-brand/20 shadow-sm"
                  : "border-dashed border-surface-border opacity-50 bg-transparent"
              }`}
            >
              {player ? (
                <>
                  <p className="text-text-primary truncate font-bold leading-tight">{player.player_id?.slice(0, 10) ?? "Acquired"}</p>
                  <p className="text-brand font-semibold font-mono mt-0.5">₹{Number(player.price_cr ?? 0).toFixed(2)} Cr</p>
                </>
              ) : (
                <p className="text-text-tertiary mt-1">Slot {i + 1}</p>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// ─── Team Budgets ─────────────────────────────────────────────────────────────

function TeamBudgetsCard({ teams, myFranchiseId }: { teams: TeamAuctionState[]; myFranchiseId: string }) {
  const sorted = [...teams].sort((a, b) => b.remaining_budget_cr - a.remaining_budget_cr);
  const maxBudget = Math.max(...sorted.map(t => t.initial_purse_cr), 1);

  return (
    <Card>
      <CardHeader title="All Team Budgets" subtitle="Dynamic purse telemetry comparison" />
      <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
        {sorted.map(t => {
          const isMyTeam = t.franchise_id === myFranchiseId || t.franchise_short_name === myFranchiseId;
          return (
            <div key={t.franchise_id} className={`flex items-center gap-3 p-2 rounded-xl transition-colors border ${isMyTeam ? "bg-surface-elevated border-brand/20" : "border-transparent"}`}>
              <span className="text-xs font-black text-text-primary w-10 flex-shrink-0">{t.franchise_short_name}</span>
              <div className="flex-1">
                <div className="w-full bg-surface-border h-2 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ 
                      width: `${(t.remaining_budget_cr / maxBudget) * 100}%`,
                      backgroundColor: TEAM_COLORS[t.franchise_short_name] ?? "var(--color-brand)" 
                    }}
                  />
                </div>
              </div>
              <span className="text-xs font-mono font-bold text-text-primary w-16 text-right flex-shrink-0">
                ₹{t.remaining_budget_cr.toFixed(1)} Cr
              </span>
              <span className="text-xs text-text-secondary w-8 text-right flex-shrink-0 font-medium">{t.squad_size}p</span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// ─── Queue Card ───────────────────────────────────────────────────────────────

function QueueCard({ items }: { items: any[] }) {
  return (
    <Card>
      <CardHeader title="Upcoming Queue" subtitle={`${items.length} players remaining`} />
      <div className="space-y-1.5 max-h-96 overflow-y-auto pr-1">
        {items.slice(0, 8).map((item, i) => (
          <div key={item.lot_number} className="flex items-center gap-2.5 p-2 rounded-xl hover:bg-surface-elevated transition-colors border border-transparent hover:border-surface-border">
            <span className="text-xs text-text-tertiary w-5 text-right font-mono font-semibold">{i + 1}</span>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-text-primary truncate font-extrabold">{item.player.full_name}</p>
              <p className="text-[9px] text-text-secondary font-medium">{item.player.playing_role}</p>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-xs font-mono font-bold text-text-primary">₹{item.base_price_cr}</p>
              {item.ai_value_estimate_cr && (
                <p className="text-[9px] text-brand font-mono">~₹{item.ai_value_estimate_cr.toFixed(1)}</p>
              )}
            </div>
            <ChevronRight size={12} className="text-text-tertiary flex-shrink-0" />
          </div>
        ))}
        {items.length === 0 && <EmptyState message="Queue is empty" />}
      </div>
    </Card>
  );
}
