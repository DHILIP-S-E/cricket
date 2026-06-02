import { useState, useEffect } from "react";
import { useQuery, useQueryClient, useMutation } from "../lib/query";
import { Gavel, TrendingUp, AlertCircle, ChevronRight, Loader2 } from "lucide-react";
import { auctionApi } from "../api/cricket";
import { useWebSocket } from "../api/websocket";
import {
  Card, CardHeader, Stat, Badge, ConfidenceBadge, RoleBadge,
  BudgetMeter, PageHeader, Spinner, EmptyState,
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
  const [liveConnected, setLiveConnected] = useState(false);
  const { franchise: themeFranchise } = useTheme();

  // Dynamically resolve target franchise based on theme or environment variables
  const activeFranchiseId = FRANCHISE_ID || themeFranchise;

  // Live WebSocket — refresh data on any auction event
  useWebSocket(`/ws/auction/${SESSION_ID}`, (msg) => {
    if (msg.type === "connected") setLiveConnected(true);
    if (msg.type === "auction_update") {
      qc.invalidateQueries({ queryKey: ["auction"] });
    }
  }, !!SESSION_ID);

  const { data: sessionRes } = useQuery({
    queryKey: ["auction", "session", SESSION_ID],
    queryFn: () => auctionApi.session(SESSION_ID),
    refetchInterval: 5000,
    enabled: !!SESSION_ID,
  });

  const { data: currentLotRes } = useQuery({
    queryKey: ["auction", "current-lot", SESSION_ID],
    queryFn: () => auctionApi.currentLot(SESSION_ID),
    refetchInterval: 3000,
    enabled: !!SESSION_ID,
  });

  const { data: recRes } = useQuery({
    queryKey: ["auction", "rec", SESSION_ID, activeFranchiseId],
    queryFn: () => auctionApi.recommendation(SESSION_ID, activeFranchiseId),
    refetchInterval: 5000,
    enabled: !!SESSION_ID && !!activeFranchiseId,
  });

  const { data: teamsRes } = useQuery({
    queryKey: ["auction", "teams", SESSION_ID],
    queryFn: () => auctionApi.teamStates(SESSION_ID),
    refetchInterval: 5000,
    enabled: !!SESSION_ID,
  });

  const { data: queueRes } = useQuery({
    queryKey: ["auction", "queue", SESSION_ID],
    queryFn: () => auctionApi.queue(SESSION_ID),
    refetchInterval: 10000,
    enabled: !!SESSION_ID,
  });

  const session = sessionRes?.data;
  const lot = currentLotRes?.data;
  const rec = recRes?.data;
  const teams = teamsRes?.data ?? [];
  const queue = queueRes?.data ?? [];
  const myTeam = teams.find(t => t.franchise_id === activeFranchiseId) || teams.find(t => t.franchise_short_name === activeFranchiseId);

  const placeBid = useMutation({
    mutationFn: (amount: number) =>
      auctionApi.placeBid(lot!.id, myTeam?.franchise_id ?? activeFranchiseId, amount),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["auction"] }),
  });

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

  return (
    <div className="flex flex-col h-full bg-surface text-text-primary">
      <PageHeader
        title="Auction War Room"
        subtitle={session?.name ?? "Loading..."}
        right={
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs">
              <div className={`w-2 h-2 rounded-full ${liveConnected ? "bg-brand animate-pulse-slow" : "bg-text-tertiary"}`} />
              <span className="text-text-secondary font-medium">{liveConnected ? "Live Connection" : "Connecting..."}</span>
            </div>
            {session && (
              <div className="text-xs text-text-secondary">
                Sold: <span className="text-brand font-mono font-bold">{session.total_players_sold}</span>
                {" "}· Unsold: <span className="text-red-500 font-mono font-bold">{session.total_players_unsold}</span>
              </div>
            )}
          </div>
        }
      />

      <div className="flex-1 overflow-auto">
        <div className="grid grid-cols-12 gap-4 p-4 min-h-full">

          {/* LEFT — Current Lot */}
          <div className="col-span-4 space-y-4">
            {lot ? (
              <CurrentLotCard
                lot={lot}
                rec={rec}
                onBid={(amt) => placeBid.mutate(amt)}
                bidding={placeBid.isPending}
                bidError={placeBid.error as Error | null}
                canBid={!!myTeam}
              />
            ) : (
              <Card>
                <EmptyState message="No active lot under the hammer" icon={<Gavel size={32} />} />
              </Card>
            )}

            {/* My squad needs */}
            {myTeam && <MySquadCard team={myTeam} />}
          </div>

          {/* CENTRE — Squad builder + team budgets */}
          <div className="col-span-5 space-y-4">
            <SquadSlotGrid team={myTeam} />
            <TeamBudgetsCard teams={teams} myFranchiseId={activeFranchiseId} />
          </div>

          {/* RIGHT — Queue + bidding history */}
          <div className="col-span-3 space-y-4">
            <QueueCard items={queue} />
          </div>

        </div>
      </div>
    </div>
  );
}

// ─── Current Lot Card ─────────────────────────────────────────────────────────

function CurrentLotCard({ lot, rec, onBid, bidding, bidError, canBid }: {
  lot: any; rec: any;
  onBid: (amount: number) => void;
  bidding: boolean;
  bidError: Error | null;
  canBid: boolean;
}) {
  const player = lot.player;
  const shouldBid = rec?.should_bid;

  // Dynamic strike animation state trigger on bid increase
  const [strike, setStrike] = useState(false);
  const currentBid = lot.current_bid ?? lot.base_price_cr;

  useEffect(() => {
    setStrike(true);
    const timer = setTimeout(() => setStrike(false), 500);
    return () => clearTimeout(timer);
  }, [currentBid]);

  return (
    <Card className="relative overflow-hidden">
      <CardHeader
        title={`Lot #${lot.lot_number}`}
        subtitle="Current player under the hammer"
        right={<div className="live-dot" />}
      />

      {/* Reactive Hammer Telemetry Indicator */}
      <div className="flex items-center justify-between gap-3 mb-4 p-3 bg-surface-elevated rounded-xl border border-surface-border relative overflow-hidden transition-all duration-300">
        <div className="flex items-center gap-3">
          <div 
            className={`w-10 h-10 rounded-xl bg-brand/10 border border-brand/20 flex items-center justify-center text-lg transition-transform duration-300 ${
              strike ? "rotate-[-35deg] scale-110" : ""
            }`}
          >
            <Gavel className="text-brand" size={18} />
          </div>
          <div>
            <p className="text-[9px] text-text-secondary uppercase tracking-wider font-extrabold">Bidding Engine</p>
            <p className="text-xs font-bold text-brand">{strike ? "BID UPDATED" : "ACCEPTING BIDS"}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[9px] text-text-secondary uppercase tracking-wider font-extrabold">Current bid</p>
          <p className="text-sm font-black font-mono text-text-primary">₹{currentBid.toFixed(2)} Cr</p>
        </div>
        {strike && (
          <div className="absolute inset-0 bg-brand/5 border border-brand/40 animate-ping rounded-xl pointer-events-none" />
        )}
      </div>

      {/* Player identity */}
      <div className="flex items-start gap-3 mb-4">
        <div className="w-12 h-12 rounded-xl bg-surface-elevated flex items-center justify-center text-2xl flex-shrink-0 border border-surface-border">
          🏏
        </div>
        <div>
          <h2 className="text-base font-extrabold text-text-primary tracking-tight leading-tight">{player.full_name}</h2>
          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
            <RoleBadge role={player.playing_role} />
            <Badge label={player.nationality} variant={player.nationality === "India" ? "blue" : "purple"} />
            {player.ipl_caps > 0 && <Badge label={`${player.ipl_caps} IPL caps`} variant="gray" />}
          </div>
        </div>
      </div>

      {/* Price row */}
      <div className="grid grid-cols-3 gap-3 mb-4 bg-surface-elevated border border-surface-border rounded-xl p-3 shadow-inner">
        <Stat label="Base Price" value={`₹${lot.base_price_cr}`} sub="Cr" />
        {rec && <Stat label="AI Fair Value" value={`₹${rec.fair_value_cr.toFixed(1)}`} sub="Cr" color="text-brand" />}
        {rec && <Stat label="Max Bid" value={`₹${rec.recommended_max_bid_cr.toFixed(1)}`} sub="Cr" color="text-amber-500" />}
      </div>

      {/* Confidence range */}
      {rec && (
        <div className="mb-4">
          <div className="flex justify-between text-xs text-text-secondary mb-1.5">
            <span>Low: ₹{rec.confidence_low_cr.toFixed(1)} Cr</span>
            <ConfidenceBadge confidence={rec.confidence} />
            <span>High: ₹{rec.confidence_high_cr.toFixed(1)} Cr</span>
          </div>
          <div className="h-1.5 bg-surface-border rounded-full relative">
            <div
              className="absolute h-full bg-brand/35 rounded-full"
              style={{
                left: `${(rec.confidence_low_cr / (rec.confidence_high_cr * 1.5)) * 100}%`,
                width: `${((rec.confidence_high_cr - rec.confidence_low_cr) / (rec.confidence_high_cr * 1.5)) * 100}%`,
              }}
            />
            <div
              className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-brand border border-surface-elevated"
              style={{ left: `${(rec.fair_value_cr / (rec.confidence_high_cr * 1.5)) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Recommendation banner */}
      {rec && (
        <div className={`rounded-xl p-3 border ${shouldBid ? "bg-green-500/10 border-green-500/30" : "bg-red-500/10 border-red-500/30"}`}>
          <div className="flex items-center gap-2 mb-1">
            {shouldBid
              ? <TrendingUp size={14} className="text-brand" />
              : <AlertCircle size={14} className="text-red-500" />
            }
            <span className={`text-xs font-black uppercase tracking-wider ${shouldBid ? "text-brand" : "text-red-500"}`}>
              AI DECISION: {shouldBid ? "BID" : "PASS"}
            </span>
          </div>
          <p className="text-xs text-text-secondary leading-relaxed">{rec.reasoning}</p>
          {rec.squad_impact && (
            <p className="text-[10px] text-text-tertiary mt-1.5 italic border-t border-surface-border/40 pt-1">Squad: {rec.squad_impact}</p>
          )}
        </div>
      )}

      {/* Bidding controls */}
      <BidPanel
        currentBid={currentBid}
        recommendedMax={rec?.recommended_max_bid_cr}
        onBid={onBid}
        bidding={bidding}
        bidError={bidError}
        canBid={canBid}
      />
    </Card>
  );
}

// ─── Bid Panel ────────────────────────────────────────────────────────────────

function BidPanel({ currentBid, recommendedMax, onBid, bidding, bidError, canBid }: {
  currentBid: number;
  recommendedMax?: number;
  onBid: (amount: number) => void;
  bidding: boolean;
  bidError: Error | null;
  canBid: boolean;
}) {
  const [amount, setAmount] = useState<number>(() => +(currentBid + 0.2).toFixed(2));

  // Keep the proposed bid above the current bid as it changes.
  useEffect(() => {
    setAmount((a) => (a <= currentBid ? +(currentBid + 0.2).toFixed(2) : a));
  }, [currentBid]);

  const bump = (d: number) => setAmount((a) => +(Math.max(currentBid + 0.05, a + d)).toFixed(2));
  const overMax = recommendedMax != null && amount > recommendedMax;

  return (
    <div className="mt-4 border-t border-surface-border pt-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] text-text-secondary uppercase tracking-wider font-extrabold">Place your bid</span>
        {recommendedMax != null && (
          <button
            onClick={() => setAmount(+recommendedMax.toFixed(2))}
            className="text-[10px] font-bold text-brand hover:underline"
          >Use AI max ₹{recommendedMax.toFixed(1)}</button>
        )}
      </div>

      <div className="flex items-center gap-2 mb-2">
        <div className="flex items-center gap-1.5 flex-1 bg-surface-elevated border border-surface-border rounded-lg px-3 py-2">
          <span className="text-text-secondary text-sm font-mono">₹</span>
          <input
            type="number"
            step={0.05}
            min={currentBid + 0.05}
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            className="w-full bg-transparent text-text-primary font-bold font-mono text-sm focus:outline-none"
          />
          <span className="text-text-secondary text-xs font-mono">Cr</span>
        </div>
        {[0.25, 0.5, 1].map((d) => (
          <button
            key={d}
            onClick={() => bump(d)}
            className="px-2.5 py-2 rounded-lg bg-surface-elevated border border-surface-border text-text-secondary hover:text-text-primary text-xs font-bold transition-colors"
          >+{d}</button>
        ))}
      </div>

      <button
        onClick={() => onBid(amount)}
        disabled={bidding || !canBid || amount <= currentBid}
        className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-sm transition-opacity disabled:opacity-40 ${
          overMax ? "bg-amber-500 text-white" : "bg-brand text-white"
        } hover:opacity-90`}
      >
        {bidding ? <Loader2 size={15} className="animate-spin" /> : <Gavel size={15} />}
        {bidding ? "Placing…" : `Bid ₹${amount.toFixed(2)} Cr`}
        {overMax && !bidding && <span className="text-[10px] font-semibold">(over AI max)</span>}
      </button>

      {!canBid && (
        <p className="text-[10px] text-amber-500 mt-1.5 text-center">
          Log in as this franchise to place bids.
        </p>
      )}
      {bidError && (
        <p className="text-[10px] text-red-500 mt-1.5 text-center">{bidError.message}</p>
      )}
    </div>
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
