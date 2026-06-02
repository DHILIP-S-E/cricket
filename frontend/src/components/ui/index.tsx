// Re-export all shadcn/ui components + cricket-specific primitives
export { Button } from "./button";
export { Badge } from "./badge";
export { Progress } from "./progress";
export { Separator } from "./separator";
export { Tabs, TabsList, TabsTrigger, TabsContent } from "./tabs";
export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "./tooltip";
export { TiltCard } from "./TiltCard";
export {
  Card as ShadCard,
  CardHeader as ShadCardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "./card";

// ─── Cricket-specific composite components ────────────────────────────────────

import { type ReactNode } from "react";
import { cn } from "../../lib/utils";
import { Progress } from "./progress";
import { Badge } from "./badge";

// Card wrapper with cricket styling
export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("card shadow-sm hover:shadow-md transition-all duration-200", className)}>
      {children}
    </div>
  );
}

// Section header inside a card
export function CardHeader({ title, subtitle, right }: {
  title: string; subtitle?: string; right?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between mb-3">
      <div>
        <h3 className="text-sm font-semibold text-text-primary leading-none">{title}</h3>
        {subtitle && <p className="text-xs text-text-secondary mt-1">{subtitle}</p>}
      </div>
      {right && <div className="flex-shrink-0 ml-3">{right}</div>}
    </div>
  );
}

// Numeric statistic
export function Stat({ label, value, sub, color = "text-text-primary" }: {
  label: string; value: string | number; sub?: string; color?: string;
}) {
  return (
    <div>
      <p className="text-[10px] text-text-secondary uppercase tracking-wider font-medium leading-none mb-1">{label}</p>
      <p className={cn("text-2xl font-bold font-mono leading-none", color)}>{value}</p>
      {sub && <p className="text-xs text-text-tertiary mt-0.5">{sub}</p>}
    </div>
  );
}

// Loading spinner
export function Spinner({ size = 20 }: { size?: number }) {
  return (
    <div
      className="border-2 border-surface-border border-t-brand rounded-full animate-spin"
      style={{ width: size, height: size }}
    />
  );
}

// Empty state placeholder
export function EmptyState({ message, icon }: { message: string; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center h-36 text-text-secondary">
      {icon && <div className="mb-2 opacity-30">{icon}</div>}
      <p className="text-sm">{message}</p>
    </div>
  );
}

// Page-level header bar
export function PageHeader({ title, subtitle, right }: {
  title: string; subtitle?: string; right?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between px-6 py-4 border-b border-surface-border bg-surface-card flex-shrink-0">
      <div>
        <h1 className="text-base font-bold text-text-primary">{title}</h1>
        {subtitle && <p className="text-xs text-text-secondary mt-0.5">{subtitle}</p>}
      </div>
      {right && <div className="flex items-center gap-2">{right}</div>}
    </div>
  );
}

// Two-team win probability bar
export function WinProbBar({ team1, prob1, team2 }: { team1: string; prob1: number; team2: string }) {
  const p1 = Math.round(prob1 * 100);
  const p2 = 100 - p1;
  return (
    <div>
      <div className="flex justify-between text-xs mb-1.5">
        <span className="text-text-secondary">{team1} <span className="text-brand font-mono font-bold">{p1}%</span></span>
        <span className="text-text-secondary"><span className="text-blue-500 dark:text-blue-400 font-mono font-bold">{p2}%</span> {team2}</span>
      </div>
      <div className="h-2.5 rounded-full overflow-hidden flex bg-surface-border">
        <div className="h-full bg-brand rounded-l-full transition-all duration-700" style={{ width: `${p1}%` }} />
      </div>
    </div>
  );
}

// Budget bar with color thresholds
export function BudgetMeter({ remaining, total, label }: { remaining: number; total: number; label: string }) {
  const pct = (remaining / total) * 100;
  const cls = pct > 40 ? "bg-[#22c55e]" : pct > 15 ? "bg-amber-400" : "bg-red-500";
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-gray-500">{label}</span>
        <span className="font-mono font-bold text-gray-200">₹{remaining.toFixed(1)} Cr</span>
      </div>
      <Progress value={pct} max={100} indicatorClass={cls} />
    </div>
  );
}

// Role badge with semantic color
const ROLE_VARIANT: Record<string, "blue" | "purple" | "amber" | "green" | "red"> = {
  "Top-order Batter":    "blue",
  "Middle-order Batter": "blue",
  "Batting All-rounder": "purple",
  "Bowling All-rounder": "amber",
  "Wicket-keeper Batter":"green",
  "Pace Bowler":         "red",
  "Spin Bowler":         "amber",
};

export function RoleBadge({ role }: { role: string }) {
  return <Badge variant={ROLE_VARIANT[role] ?? "gray"}>{role}</Badge>;
}

// High / Medium / Low confidence badge
export function ConfidenceBadge({ confidence }: { confidence: string }) {
  const v = confidence === "High" ? "green" : confidence === "Medium" ? "amber" : "gray";
  return <Badge variant={v as "green" | "amber" | "gray"}>{confidence} conf.</Badge>;
}

// Risk level 1–10 bar
export function RiskMeter({ level }: { level: number }) {
  const color = level <= 3 ? "bg-[#22c55e]" : level <= 6 ? "bg-amber-400" : "bg-red-500";
  const label = level <= 3 ? "Conservative" : level <= 6 ? "Balanced" : level <= 8 ? "Aggressive" : "All-out";
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs">
        <span className="text-gray-500">Batting risk</span>
        <span className="font-mono text-gray-300">{level}/10 — {label}</span>
      </div>
      <div className="flex gap-0.5">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className={cn("h-2 flex-1 rounded-sm transition-colors", i < level ? color : "bg-[#30363d]")} />
        ))}
      </div>
    </div>
  );
}
