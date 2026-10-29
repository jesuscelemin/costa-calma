import { introGateScript } from "@/lib/intro";

import { IntroSeen } from "./IntroSeen";

/**
 * Decides before the first paint whether the landing's intro plays (see `introGate`). It sits in
 * the site's layout, not the landing's, so that opening any page starts the session, and so it is
 * rendered by the server: a script rendered on the client never runs, hence the client backup.
 */
export function IntroGate() {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: introGateScript }} />
      <IntroSeen />
    </>
  );
}
