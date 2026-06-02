import { jsx as _jsx } from "react/jsx-runtime";
import { cva } from "class-variance-authority";
import { cn } from "../../lib/utils";
const badgeVariants = cva("inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium transition-colors", {
    variants: {
        variant: {
            default: "bg-[#238636]/20 text-[#22c55e] border border-[#238636]/40",
            green: "bg-green-900/40 text-green-400 border border-green-800",
            amber: "bg-amber-900/40 text-amber-400 border border-amber-800",
            red: "bg-red-900/40 text-red-400 border border-red-800",
            blue: "bg-blue-900/40 text-blue-400 border border-blue-800",
            purple: "bg-purple-900/40 text-purple-400 border border-purple-800",
            gray: "bg-[#1c2128] text-gray-400 border border-[#30363d]",
            outline: "border border-[#30363d] text-gray-400",
        },
    },
    defaultVariants: { variant: "gray" },
});
function Badge({ className, variant, label, children, ...props }) {
    return (_jsx("div", { className: cn(badgeVariants({ variant }), className), ...props, children: label ?? children }));
}
export { Badge, badgeVariants };
