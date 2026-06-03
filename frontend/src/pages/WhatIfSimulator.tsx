import { useEffect, useMemo, useState } from "react";
import { useQuery } from "../lib/query";
import { Sparkles, Target, TrendingUp, AlertTriangle } from "lucide-react";
import { liveApi } from "../api/cricket";
import type { WhatIfScenario } from "../types/cricket";
import {
  Card, CardHeader, Stat, PageHeader, Spinner, WinProbBar, RiskMeter,
} from "../components/ui";

/** Coalesce rapid changes (e.g. dragging a slider) into one value. */
function useDebounced<T>(value: T, delay = 250): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

const DEFAULT: WhatIfScenario = {
  target: 180,
  current_score: 90,
  wickets_fallen: 3,
  overs_completed: 10,
  balls_this_over: 0,
  total_overs: 20,
};

export function WhatIfSimulator() {
  const [scenario, setScenario] = useState<WhatIfScenario>(DEFAULT);

  const set = (key: keyof WhatIfScenario) => (value: number) =>
    setScenario((s) => ({ ...s, [key]: value }));

  // Streams a fresh ML prediction as you move the sliders. Debounced so a
  // drag fires one request when you settle, not one per pixel.
  const liveScenario = useDebounced(scenario, 250);
  const { data, isFetching } = useQuery({
    queryKey: ["whatif", liveScenario],
    queryFn: () => liveApi.simulate(liveScenario),
    placeholderData: (prev) => prev,
  });

  const result = data?.data;
  const winPct = Math.round((result?.chasing_team_win_prob ?? 0.5) * 100);

  const ballsBowled = scenario.overs_completed * 6 + scenario.balls_this_over;
  const maxBalls = scenario.total_overs * 6;
  const oversLabel = useMemo(
    () => `${scenario.overs_completed}.${scenario.balls_this_over}`,
    [scenario.overs_completed, scenario.balls_this_over],
  );

  return (
    <div className="flex flex-col h-full bg-surface text-text-primary">
      <PageHeader
        title="What-If Simulator"
        subtitle="Feed any chase scenario → live ML win-probability model"
        right={
          <div className="flex items-center gap-1.5 text-xs text-text-secondary">
            <Sparkles size={13} className="text-brand" />
            <span className="font-medium">{isFetching ? "Predicting…" : "live_win_prob model"}</span>
          </div>
        }
      />

      <div className="flex-1 overflow-auto p-4">
        <div className="grid grid-cols-12 gap-4">

          {/* LEFT — Scenario inputs */}
          <div className="col-span-5">
            <Card>
              <CardHeader title="Chase Scenario" subtitle="Second innings" />
              <div className="space-y-5 mt-2">
                <SliderField label="Target" icon={<Target size={13} />} value={scenario.target}
                  min={40} max={300} step={1} onChange={set("target")} suffix=" runs" />
                <SliderField label="Current Score" value={scenario.current_score}
                  min={0} max={scenario.target} step={1} onChange={set("current_score")} suffix=" runs" />
                <SliderField label="Wickets Fallen" value={scenario.wickets_fallen}
                  min={0} max={10} step={1} onChange={set("wickets_fallen")} />
                <SliderField label="Overs Completed" value={scenario.overs_completed}
                  min={0} max={scenario.total_overs} step={1} onChange={set("overs_completed")}
                  suffix={` / ${scenario.total_overs}`} />
                <SliderField label="Balls This Over" value={scenario.balls_this_over}
                  min={0} max={5} step={1} onChange={set("balls_this_over")} />

                <div className="flex gap-2 pt-1">
                  {QUICK_PRESETS.map((p) => (
                    <button
                      key={p.label}
                      onClick={() => setScenario({ ...DEFAULT, ...p.scenario })}
                      className="flex-1 text-[11px] font-semibold px-2 py-1.5 rounded-lg bg-surface-elevated border border-surface-border text-text-secondary hover:text-brand hover:border-brand/40 transition-colors"
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            </Card>
          </div>

          {/* RIGHT — ML output */}
          <div className="col-span-7 space-y-4">
            <Card className="relative overflow-hidden">
              <CardHeader title="Win Probability" subtitle="Chasing team" right={
                isFetching ? <Spinner size={14} /> : <TrendingUp size={14} className="text-brand" />
              } />
              <div className="flex items-end gap-4 mb-4">
                <p className="text-6xl font-black font-mono text-brand leading-none">{winPct}%</p>
                <p className="text-sm text-text-secondary mb-1.5">
                  defending team {Math.round((result?.defending_team_win_prob ?? 0.5) * 100)}%
                </p>
              </div>
              <WinProbBar team1="Chasing" prob1={result?.chasing_team_win_prob ?? 0.5} team2="Defending" />
            </Card>

            <div className="grid grid-cols-2 gap-4">
              <Card>
                <CardHeader title="Equation" />
                <div className="grid grid-cols-2 gap-3">
                  <Stat label="Need" value={`${result?.runs_required ?? "—"}`}
                    sub={`off ${result?.balls_remaining ?? maxBalls - ballsBowled} balls`} />
                  <Stat label="Wickets left" value={`${result?.wickets_remaining ?? 10}`} />
                  <Stat label="Req. RR" value={result?.required_run_rate?.toFixed(2) ?? "—"} color="text-amber-500" />
                  <Stat label="Current RR" value={result?.current_run_rate?.toFixed(2) ?? "—"} />
                </div>
                <p className="text-[11px] text-text-tertiary font-mono mt-3">At over {oversLabel}</p>
              </Card>

              <Card>
                <CardHeader title="Batting Strategy" />
                <div className="mb-3">
                  <RiskMeter level={result?.batting_risk_level ?? 5} />
                </div>
                <p className="text-xs text-text-secondary leading-relaxed">
                  {result?.batting_strategy ?? "Adjust the scenario to see the recommended approach."}
                </p>
              </Card>
            </div>

            {result?.alert && (
              <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
                <AlertTriangle size={15} className="text-amber-500 flex-shrink-0" />
                <p className="text-xs text-amber-600 dark:text-amber-300 font-semibold">{result.alert}</p>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}

const QUICK_PRESETS: { label: string; scenario: Partial<WhatIfScenario> }[] = [
  { label: "Cruising", scenario: { target: 150, current_score: 130, wickets_fallen: 2, overs_completed: 12 } },
  { label: "Tight", scenario: { target: 180, current_score: 135, wickets_fallen: 4, overs_completed: 15 } },
  { label: "Collapse", scenario: { target: 200, current_score: 120, wickets_fallen: 8, overs_completed: 16 } },
];

function SliderField({ label, icon, value, min, max, step, onChange, suffix }: {
  label: string;
  icon?: React.ReactNode;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  suffix?: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="flex items-center gap-1.5 text-xs font-semibold text-text-secondary uppercase tracking-wider">
          {icon}{label}
        </span>
        <span className="text-sm font-bold font-mono text-text-primary">{value}{suffix}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-brand cursor-pointer"
      />
    </div>
  );
}
