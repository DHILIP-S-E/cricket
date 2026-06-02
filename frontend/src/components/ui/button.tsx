import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:     "bg-brand text-white shadow hover:bg-brand-hover",
        destructive: "bg-red-900/50 text-red-400 border border-red-800 shadow-sm hover:bg-red-900",
        outline:     "border border-surface-border bg-transparent shadow-sm hover:bg-surface-elevated text-text-secondary hover:text-text-primary",
        secondary:   "bg-surface-elevated text-text-secondary shadow-sm hover:bg-surface-border hover:text-text-primary",
        ghost:       "text-text-secondary hover:bg-surface-elevated hover:text-text-primary",
        link:        "text-brand underline-offset-4 hover:underline",
        amber:       "bg-amber-900/40 text-amber-400 border border-amber-800 hover:bg-amber-900/60",
      },
      size: {
        default: "h-8 px-3 py-1.5",
        sm:      "h-7 rounded px-2 text-xs",
        lg:      "h-10 px-6",
        icon:    "h-8 w-8",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
