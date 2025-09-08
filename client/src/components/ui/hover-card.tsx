"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

// Simplified components without hover functionality
const HoverCard = ({ children }: { children: React.ReactNode }) => <>{children}</>
const HoverCardTrigger = ({ children }: { children: React.ReactNode }) => <>{children}</>
const HoverCardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "z-50 w-64 rounded-md border bg-popover p-4 text-popover-foreground shadow-md",
      className
    )}
    {...props}
  />
))
HoverCardContent.displayName = "HoverCardContent"

export { HoverCard, HoverCardTrigger, HoverCardContent }
