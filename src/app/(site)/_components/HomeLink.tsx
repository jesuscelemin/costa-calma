import Link from "next/link";

import { Logo } from "@/components/ui/logo";
import { cn } from "@/lib/utils";

import { overMediaText } from "../_lib/header-over-media";

/** Logo linking to the landing: ink on the page, light text while the header lies on media. */
export function HomeLink({ className }: { className?: string }) {
  return (
    <Link href="/" className={cn("rounded-full py-2 focus-ring", className)}>
      <Logo className={cn("h-8", overMediaText)} />
    </Link>
  );
}
