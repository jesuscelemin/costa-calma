import { traversalGateScript } from "../_lib/traversal";

import { TraversalTransition } from "./TraversalTransition";

/**
 * Back and Forward with view transitions. The script is rendered by the server, so it runs as the
 * page is parsed, ahead of the router (see `traversalGateScript`); TraversalTransition does the
 * rest.
 */
export function TraversalGate() {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: traversalGateScript }} />
      <TraversalTransition />
    </>
  );
}
