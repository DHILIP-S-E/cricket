import { jsx as _jsx } from "react/jsx-runtime";
import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva } from "class-variance-authority";
import { cn } from "../../lib/utils";
const buttonVariants = cva("inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50", {
    variants: {
        variant: {
            default: "bg-[#238636] text-white shadow hover:bg-[#2ea043]",
            destructive: "bg-red-900/50 text-red-400 border border-red-800 shadow-sm hover:bg-red-900",
            outline: "border border-[#30363d] bg-transparent shadow-sm hover:bg-[#1c2128] text-gray-300",
            secondary: "bg-[#1c2128] text-gray-300 shadow-sm hover:bg-[#30363d]",
            ghost: "text-gray-400 hover:bg-[#1c2128] hover:text-gray-100",
            link: "text-[#238636] underline-offset-4 hover:underline",
            amber: "bg-amber-900/40 text-amber-400 border border-amber-800 hover:bg-amber-900/60",
        },
        size: {
            default: "h-8 px-3 py-1.5",
            sm: "h-7 rounded px-2 text-xs",
            lg: "h-10 px-6",
            icon: "h-8 w-8",
        },
    },
    defaultVariants: { variant: "default", size: "default" },
});
const Button = React.forwardRef(({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return _jsx(Comp, { className: cn(buttonVariants({ variant, size, className })), ref: ref, ...props });
});
Button.displayName = "Button";
export { Button, buttonVariants };
