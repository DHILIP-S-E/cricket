import { jsx as _jsx } from "react/jsx-runtime";
import * as React from "react";
import * as ProgressPrimitive from "@radix-ui/react-progress";
import { cn } from "../../lib/utils";
const Progress = React.forwardRef(({ className, value, indicatorClass, ...props }, ref) => (_jsx(ProgressPrimitive.Root, { ref: ref, className: cn("relative h-1.5 w-full overflow-hidden rounded-full bg-[#30363d]", className), ...props, children: _jsx(ProgressPrimitive.Indicator, { className: cn("h-full w-full flex-1 rounded-full transition-all duration-500", indicatorClass ?? "bg-[#22c55e]"), style: { transform: `translateX(-${100 - (value ?? 0)}%)` } }) })));
Progress.displayName = ProgressPrimitive.Root.displayName;
export { Progress };
