import Link from "next/link";

import { Logo } from "@/components/ui/logo";

/** Logo linking to the landing, on its own surface-raised pill so it never lies directly on the hero. */
export function HomeLink() {
  return (
    <Link href="/" className="rounded-full bg-surface-raised px-4 py-2 focus-ring">
      <Logo className="h-8" />
    </Link>
  );
}
