export default function SiteLayout({ children }: LayoutProps<"/">) {
  return (
    <main id="contenido" className="flex flex-1 flex-col gap-16 pb-16 md:gap-28 md:pb-28">
      {children}
    </main>
  );
}
