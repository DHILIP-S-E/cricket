import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// Re-export all shadcn/ui components + cricket-specific primitives
export { Button } from "./button";
export { Badge } from "./badge";
export { Progress } from "./progress";
export { Separator } from "./separator";
export { Tabs, TabsList, TabsTrigger, TabsContent } from "./tabs";
export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "./tooltip";
export { TiltCard } from "./TiltCard";
export { Card as ShadCard, CardHeader as ShadCardHeader, CardTitle, CardDescription, CardContent, CardFooter, } from "./card";
import { cn } from "../../lib/utils";
import { Progress } from "./progress";
import { Badge } from "./badge";
// Card wrapper with cricket styling
export function Card({ children, className }) {
    return (_jsx("div", { className: cn("rounded-xl border border-[#30363d] bg-[#161b22] p-4", className), children: children }));
}
// Section header inside a card
export function CardHeader({ title, subtitle, right }) {
    return (_jsxs("div", { className: "flex items-start justify-between mb-3", children: [_jsxs("div", { children: [_jsx("h3", { className: "text-sm font-semibold text-gray-100 leading-none", children: title }), subtitle && _jsx("p", { className: "text-xs text-gray-500 mt-1", children: subtitle })] }), right && _jsx("div", { className: "flex-shrink-0 ml-3", children: right })] }));
}
// Numeric statistic
export function Stat({ label, value, sub, color = "text-gray-100" }) {
    return (_jsxs("div", { children: [_jsx("p", { className: "text-[10px] text-gray-500 uppercase tracking-wider font-medium leading-none mb-1", children: label }), _jsx("p", { className: cn("text-2xl font-bold font-mono leading-none", color), children: value }), sub && _jsx("p", { className: "text-xs text-gray-600 mt-0.5", children: sub })] }));
}
// Loading spinner
export function Spinner({ size = 20 }) {
    return (_jsx("div", { className: "border-2 border-[#30363d] border-t-[#238636] rounded-full animate-spin", style: { width: size, height: size } }));
}
// Empty state placeholder
export function EmptyState({ message, icon }) {
    return (_jsxs("div", { className: "flex flex-col items-center justify-center h-36 text-gray-700", children: [icon && _jsx("div", { className: "mb-2 opacity-30", children: icon }), _jsx("p", { className: "text-sm", children: message })] }));
}
// Page-level header bar
export function PageHeader({ title, subtitle, right }) {
    return (_jsxs("div", { className: "flex items-center justify-between px-6 py-4 border-b border-[#30363d] bg-[#161b22] flex-shrink-0", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-base font-bold text-gray-100", children: title }), subtitle && _jsx("p", { className: "text-xs text-gray-500 mt-0.5", children: subtitle })] }), right && _jsx("div", { className: "flex items-center gap-2", children: right })] }));
}
// Two-team win probability bar
export function WinProbBar({ team1, prob1, team2 }) {
    const p1 = Math.round(prob1 * 100);
    const p2 = 100 - p1;
    return (_jsxs("div", { children: [_jsxs("div", { className: "flex justify-between text-xs mb-1.5", children: [_jsxs("span", { className: "text-gray-400", children: [team1, " ", _jsxs("span", { className: "text-[#22c55e] font-mono font-bold", children: [p1, "%"] })] }), _jsxs("span", { className: "text-gray-400", children: [_jsxs("span", { className: "text-blue-400 font-mono font-bold", children: [p2, "%"] }), " ", team2] })] }), _jsx("div", { className: "h-2.5 rounded-full overflow-hidden flex bg-blue-900/40", children: _jsx("div", { className: "h-full bg-[#22c55e] rounded-l-full transition-all duration-700", style: { width: `${p1}%` } }) })] }));
}
// Budget bar with color thresholds
export function BudgetMeter({ remaining, total, label }) {
    const pct = (remaining / total) * 100;
    const cls = pct > 40 ? "bg-[#22c55e]" : pct > 15 ? "bg-amber-400" : "bg-red-500";
    return (_jsxs("div", { className: "space-y-1", children: [_jsxs("div", { className: "flex justify-between text-xs", children: [_jsx("span", { className: "text-gray-500", children: label }), _jsxs("span", { className: "font-mono font-bold text-gray-200", children: ["\u20B9", remaining.toFixed(1), " Cr"] })] }), _jsx(Progress, { value: pct, max: 100, indicatorClass: cls })] }));
}
// Role badge with semantic color
const ROLE_VARIANT = {
    "Top-order Batter": "blue",
    "Middle-order Batter": "blue",
    "Batting All-rounder": "purple",
    "Bowling All-rounder": "amber",
    "Wicket-keeper Batter": "green",
    "Pace Bowler": "red",
    "Spin Bowler": "amber",
};
export function RoleBadge({ role }) {
    return _jsx(Badge, { variant: ROLE_VARIANT[role] ?? "gray", children: role });
}
// High / Medium / Low confidence badge
export function ConfidenceBadge({ confidence }) {
    const v = confidence === "High" ? "green" : confidence === "Medium" ? "amber" : "gray";
    return _jsxs(Badge, { variant: v, children: [confidence, " conf."] });
}
// Risk level 1–10 bar
export function RiskMeter({ level }) {
    const color = level <= 3 ? "bg-[#22c55e]" : level <= 6 ? "bg-amber-400" : "bg-red-500";
    const label = level <= 3 ? "Conservative" : level <= 6 ? "Balanced" : level <= 8 ? "Aggressive" : "All-out";
    return (_jsxs("div", { className: "space-y-1.5", children: [_jsxs("div", { className: "flex justify-between text-xs", children: [_jsx("span", { className: "text-gray-500", children: "Batting risk" }), _jsxs("span", { className: "font-mono text-gray-300", children: [level, "/10 \u2014 ", label] })] }), _jsx("div", { className: "flex gap-0.5", children: Array.from({ length: 10 }).map((_, i) => (_jsx("div", { className: cn("h-2 flex-1 rounded-sm transition-colors", i < level ? color : "bg-[#30363d]") }, i))) })] }));
}
