import type { Metadata } from "next";

import { Logo } from "@/components/ui/logo";

export const metadata: Metadata = {
  title: "Administración",
  robots: { index: false, follow: false },
};

/** Minimal frame for the admin panel (Phase 5); it shares nothing with the public site's chrome. */
export default function AdminLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <header className="border-b border-line bg-surface-raised">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-6 md:px-10">
          <Logo className="h-8" />
          <span className="type-eyebrow text-ink-muted">Administración</span>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-6 py-10 md:px-10">
        {children}
      </main>
    </>
  );
}
