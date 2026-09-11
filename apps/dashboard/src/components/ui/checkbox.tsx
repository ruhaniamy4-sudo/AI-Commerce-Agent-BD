import * as React from "react"

import { cn } from "@/lib/utils"

export interface CheckboxProps
    extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "onChange"> {
    checked?: boolean
    onCheckedChange?: (checked: boolean) => void
}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
    ({ className, checked, onCheckedChange, ...props }, ref) => (
        <input
            ref={ref}
            type="checkbox"
            checked={checked}
            onChange={(event) => onCheckedChange?.(event.target.checked)}
            className={cn(
                "h-4 w-4 shrink-0 rounded border-border text-primary accent-primary focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background cursor-pointer disabled:cursor-not-allowed disabled:opacity-50",
                className
            )}
            {...props}
        />
    )
)
Checkbox.displayName = "Checkbox"

export { Checkbox }
