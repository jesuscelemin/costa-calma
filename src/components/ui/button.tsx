import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";

import { cn } from "@/lib/utils";

// Brand rule: a single `default` (mar) button per view.
// Focus uses the shared outline, not a box-shadow ring: it shows at once (box-shadow is animated
// for the hover shadow) and needs no offset color, so it reads on any surface.
const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-full border border-transparent font-semibold cursor-pointer whitespace-nowrap transition-[background-color,border-color,color,box-shadow] select-none focus-ring motion-reduce:transition-none disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-mar text-on-mar hover:shadow-soft",
        secondary: "border-line bg-surface-raised text-ink hover:bg-mar-soft",
        ghost: "text-ink hover:bg-mar-soft",
      },
      size: {
        default: "h-11 px-6 text-base",
        sm: "h-9 px-4 text-sm",
        lg: "h-13 px-10 text-base",
        icon: "size-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot.Root : "button";

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
