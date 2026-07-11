import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors",
  {
    variants: {
      variant: {
        paid: "bg-emerald-100 text-emerald-700",
        estimated: "bg-zinc-100 text-zinc-500",
        optimizable: "bg-amber-100 text-amber-700",
        income: "bg-blue-100 text-blue-700",
        over: "bg-red-100 text-red-700",
      },
    },
    defaultVariants: {
      variant: "estimated",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
