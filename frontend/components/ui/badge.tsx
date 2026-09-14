import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/**
 * Square-cornered tags. A badge names a fact about a record; colour variants exist only
 * for the four state families (see lib/design.ts), never for decoration.
 */
const badgeVariants = cva(
  "group/badge inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-[4px] border px-1.5 text-xs font-medium whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-ring/50 has-data-[icon=inline-end]:pr-1 has-data-[icon=inline-start]:pl-1 [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        default: "border-foreground bg-foreground text-background [a]:hover:bg-ink-700",
        secondary:
          "border-border bg-muted text-secondary-foreground [a]:hover:bg-accent",
        outline:
          "border-border bg-card text-foreground [a]:hover:bg-muted",
        ghost: "border-transparent hover:bg-muted",
        link: "border-transparent text-foreground underline-offset-4 hover:underline",
        destructive:
          "border-danger-line bg-danger-soft text-danger-ink [a]:hover:bg-danger-soft/70",
        warning: "border-warning-line bg-warning-soft text-warning-ink",
        success: "border-success-line bg-success-soft text-success-ink",
        info: "border-info-line bg-info-soft text-info-ink",
      },
    },
    defaultVariants: {
      variant: "secondary",
    },
  }
)

function Badge({
  className,
  variant = "secondary",
  render,
  ...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      {
        className: cn(badgeVariants({ variant }), className),
      },
      props
    ),
    render,
    state: {
      slot: "badge",
      variant,
    },
  })
}

export { Badge, badgeVariants }
