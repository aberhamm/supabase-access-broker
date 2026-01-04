"use client"

import * as React from "react"
import * as CheckboxPrimitive from "@radix-ui/react-checkbox"
import { Check } from "lucide-react"

import { cn } from "@/lib/utils"

const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    className={cn(
      "peer h-4 w-4 shrink-0 rounded-[4px] border border-input shadow-xs",
      "ring-ring/10 dark:ring-ring/20 dark:outline-ring/40",
      "transition-all duration-200 ease-out",
      "hover:border-foreground/30",
      "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:border-ring",
      "disabled:cursor-not-allowed disabled:opacity-50",
      "data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground data-[state=checked]:border-primary",
      "data-[state=checked]:shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]",
      className
    )}
    {...props}
  >
    <CheckboxPrimitive.Indicator
      className={cn(
        "flex items-center justify-center text-current",
        "data-[state=checked]:animate-in data-[state=checked]:zoom-in-75 data-[state=checked]:fade-in-0",
        "data-[state=unchecked]:animate-out data-[state=unchecked]:zoom-out-75 data-[state=unchecked]:fade-out-0",
        "duration-150"
      )}
    >
      <Check className="h-3 w-3 stroke-[3]" />
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
))
Checkbox.displayName = CheckboxPrimitive.Root.displayName

export { Checkbox }
