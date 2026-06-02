import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Gavel, TrendingUp, Users, AlertCircle, ChevronRight, Wifi } from "lucide-react";
import { auctionApi } from "../api/cricket";
import { useWebSocket } from "../api/websocket";
import {
  Card, CardHeader, Stat, Badge, ConfidenceBadge, RoleBadge,
  BudgetMeter, PageHeader, Spinner, EmptyState, WinProbBar,
} from "../components/ui";
import type { TeamAuctionState } from "../types/cricket";

const SESSION_ID = import.meta.env.VITE_AUCTION_SESSION_ID ?? "";
const FRANCHISE_ID = import.meta.env.VITE_FRANCHISE_ID ?? "";

export function AuctionRoom() {
  const qc = useQueryClient();
  const [liveConnected, setLiveConnected] = useState(false);

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
    queryKey: ["auction", "rec", SESSION_ID, FRANCHISE_ID],
    queryFn: () => auctionApi.recommendation(SESSION_ID, FRANCHISE_ID),
    refetchInterval: 5000,
    enabled: !!SESSION_ID && !!FRANCHISE_ID,
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
  const myTeam = teams.find(t => t.franchise_id === FRANCHISE_ID);

  if (!SESSION_ID) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <Gavel size={48} className="mx-auto text-gray-600 mb-3" />
          <p className="text-gray-400 text-sm">Set VITE_AUCTION_SESSION_ID in your .env to connect</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Auction War Room"
        subtitle={session?.name ?? "Loading..."}
        right={
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs">
              <div className={`w-2 h-2 rounded-full ${liveConnected ? "bg-signal-green animate-pulse-slow" : "bg-gray-600"}`} />
              <span className="text-gray-500">{liveConnected ? "Live" : "Connecting..."}</span>
            </div>
            {session && (
              <div className="text-xs text-gray-500">
                Sold: <span className="text-gray-300 font-mono">{session.total_players_sold}</span>
                {" "}· Unsold: <span className="text-gray-300 font-mono">{session.total_players_unsold}</span>
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
              <CurrentLotCard lot={lot} rec={rec} />
            ) : (
              <Card>
                <EmptyState message="No active lot" icon={<Gavel size={32} />} />
              </Card>
            )}

            {/* My squad needs */}
            {myTeam && <MySquadCard team={myTeam} />}
          </div>

          {/* CENTRE — Squad builder + team budgets */}
          <div className="col-span-5 space-y-4">
            <SquadSlotGrid team={myTeam} />
            <TeamBudgetsCard teams={teams} myFranchiseId={FRANCHISE_ID} />
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

function CurrentLotCard({ lot, rec }: { lot: any; rec: any }) {
  const player = lot.player;
  const shouldBid = rec?.should_bid;

  return (
    <Card>
      <CardHeader
        title={`Lot #${lot.lot_number}`}
        subtitle="Current player under the hammer"
        right={<div className="live-dot" />}
      />

      {/* Player identity */}
      <div className="flex items-start gap-3 mb-4">
        <div className="w-12 h-12 rounded-lg bg-surface-elevated flex items-center justify-center text-2xl">
          🏏
        </div>
        <div>
          <h2 className="text-base font-bold text-gray-100">{player.full_name}</h2>
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            <RoleBadge role={player.playing_role} />
            <Badge label={player.nationality} variant={player.nationality === "India" ? "blue" : "purple"} />
            {player.ipl_caps > 0 && <Badge label={`${player.ipl_caps} IPL caps`} variant="gray" />}
          </div>
        </div>
      </div>

      {/* Price row */}
      <div className="grid grid-cols-3 gap-3 mb-4 bg-surface-elevated rounded-lg p-3">
        <Stat label="Base Price" value={`₹${lot.base_price_cr}`} sub="Cr" />
        {rec && <Stat label="AI Fair Value" value={`₹${rec.fair_value_cr.toFixed(1)}`} sub="Cr" color="text-signal-green" />}
        {rec && <Stat label="Max Bid" value={`₹${rec.recommended_max_bid_cr.toFixed(1)}`} sub="Cr" color="text-signal-amber" />}
      </div>

      {/* Confidence range */}
      {rec && (
        <div className="mb-4">
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>Low: ₹{rec.confidence_low_cr.toFixed(1)} Cr</span>
            <ConfidenceBadge confidence={rec.confidence} />
            <span>High: ₹{rec.confidence_high_cr.toFixed(1)} Cr</span>
          </div>
          <div className="h-1.5 bg-surface-border rounded-full relative">
            <div
              className="absolute h-full bg-signal-green/30 rounded-full"
              style={{
                left: `${(rec.confidence_low_cr / (rec.confidence_high_cr * 1.5)) * 100}%`,
                width: `${((rec.confidence_high_cr - rec.confidence_low_cr) / (rec.confidence_high_cr * 1.5)) * 100}%`,
              }}
            />
            <div
              className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-signal-green border border-surface"
              style={{ left: `${(rec.fair_value_cr / (rec.confidence_high_cr * 1.5)) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Recommendation banner */}
      {rec && (
        <div className={`rounded-lg p-3 border ${shouldBid ? "bg-green-900/20 border-green-800" : "bg-red-900/20 border-red-800"}`}>
          <div className="flex items-center gap-2 mb-1">
            {shouldBid
              ? <TrendingUp size={14} className="text-signal-green" />
              : <AlertCircle size={14} className="text-signal-red" />
            }
            <span className={`text-sm font-bold ${shouldBid ? "text-signal-green" : "text-signal-red"}`}>
              {shouldBid ? "BID" : "PASS"}
            </span>
          </div>
          <p className="text-xs text-gray-400 leading-relaxed">{rec.reasoning}</p>
          {rec.squad_impact && (
            <p className="text-xs text-gray-500 mt-1.5 italic">{rec.squad_impact}</p>
          )}
        </div>
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
        <BudgetMeter remaining={team.remaining_budget_cr} total={team.initial_purse_cr} label="Budget remaining" />
        <div className="text-right">
          <p className="stat-label">Squad</p>
          <p className="text-lg font-bold font-mono text-gray-100">{team.squad_size}<span className="text-gray-600">/{team.squad_size_max}</span></p>
        </div>
      </div>
      <div className="grid grid-cols-4 gap-2 text-center text-xs">
        {[
          { label: "WK", val: team.wk_count, need: 1 },
          { label: "BAT", val: team.batter_count, need: 4 },
          { label: "BWL", val: team.bowler_count, need: 4 },
          { label: "ALR", val: team.all_rounder_count, need: 2 },
        ].map(({ label, val, need }) => (
          <div key={label} className={`rounded-md p-2 ${val >= need ? "bg-surface-elevated" : "bg-red-900/20 border border-red-900"}`}>
            <p className="text-gray-500 text-[10px]">{label}</p>
            <p className={`font-mono font-bold ${val >= need ? "text-gray-200" : "text-signal-red"}`}>{val}</p>
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
        <span>Overseas: {team.overseas_slots_used}/{team.overseas_slots_max}</span>
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
      <div className="grid grid-cols-5 gap-1.5 max-h-64 overflow-y-auto">
        {Array.from({ length: team.squad_size_max }).map((_, i) => {
          const player = bought[i];
          return (
            <div
              key={i}
              className={`rounded-md p-1.5 text-center text-[10px] border transition-colors ${
                player
                  ? "bg-surface-elevated border-surface-border"
                  : "border-dashed border-surface-border opacity-40"
              }`}
            >
              {player ? (
                <>
                  <p className="text-gray-300 truncate font-medium leading-tight">{player.player_id?.slice(0, 6) ?? "—"}</p>
                  <p className="text-gray-600 mt-0.5">₹{Number(player.price_cr ?? 0).toFixed(1)}</p>
                </>
              ) : (
                <p className="text-gray-700 mt-1">Slot {i + 1}</p>
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
      <CardHeader title="All Team Budgets" />
      <div className="space-y-2">
        {sorted.map(t => (
          <div key={t.franchise_id} className={`flex items-center gap-3 p-2 rounded-lg ${t.franchise_id === myFranchiseId ? "bg-surface-elevated" : ""}`}>
            <span className="text-xs font-mono text-gray-400 w-10 flex-shrink-0">{t.franchise_short_name}</span>
            <div className="flex-1">
              <div className="flex items-center gap-1 mb-1">
                <div
                  className="h-1.5 rounded-full bg-signal-green"
                  style={{ width: `${(t.remaining_budget_cr / maxBudget) * 100}%` }}
                />
              </div>
            </div>
            <span className="text-xs font-mono text-gray-300 w-16 text-right flex-shrink-0">
              ₹{t.remaining_budget_cr.toFixed(0)} Cr
            </span>
            <span className="text-xs text-gray-600 w-8 text-right flex-shrink-0">{t.squad_size}p</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ─── Queue Card ───────────────────────────────────────────────────────────────

function QueueCard({ items }: { items: any[] }) {
  return (
    <Card>
      <CardHeader title="Upcoming Queue" subtitle={`${items.length} players remaining`} />
      <div className="space-y-1.5">
        {items.slice(0, 8).map((item, i) => (
          <div key={item.lot_number} className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-surface-elevated transition-colors">
            <span className="text-xs text-gray-600 w-5 text-right font-mono">{i + 1}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-200 truncate font-medium">{item.player.full_name}</p>
              <p className="text-[10px] text-gray-500">{item.player.playing_role}</p>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-xs font-mono text-gray-400">₹{item.base_price_cr}</p>
              {item.ai_value_estimate_cr && (
                <p className="text-[10px] text-signal-green font-mono">~₹{item.ai_value_estimate_cr.toFixed(1)}</p>
              )}
            </div>
            <ChevronRight size={12} className="text-gray-600 flex-shrink-0" />
          </div>
        ))}
        {items.length === 0 && <EmptyState message="Queue is empty" />}
      </div>
    </Card>
  );
}
