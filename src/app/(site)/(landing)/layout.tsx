import { Intro } from "./_components/Intro";

/** Outside the landing's loading boundary, so the intro is in the first HTML the server sends. */
export default function LandingLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <Intro />
      {children}
    </>
  );
}
