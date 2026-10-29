type SkipLinkProps = {
  href: string;
  children: React.ReactNode;
};

/** Link for keyboard users to jump past a block, hidden until it receives focus. */
export function SkipLink({ href, children }: SkipLinkProps) {
  return (
    <a
      href={href}
      className="sr-only rounded-full bg-surface-raised px-6 py-3 font-semibold text-ink focus-ring focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-60"
    >
      {children}
    </a>
  );
}
