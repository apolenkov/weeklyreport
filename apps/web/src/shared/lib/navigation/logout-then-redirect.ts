import type { QueryClient } from "@tanstack/react-query";

import { beginSessionTransition } from "../auth/session-transition";

const LOGOUT_PATH = "/auth/logout";

// Stop active queries before the server changes identity. The tRPC transition
// link holds any new operations until this navigation succeeds or rolls back.
export function logoutThenRedirect(
  queryClient: QueryClient,
  href: string,
  onStay: () => void,
): boolean {
  const transition = beginSessionTransition();
  if (transition === null) return false;

  const stay = () => {
    transition.finish();
    void queryClient.refetchQueries({ type: "active" }).catch(() => undefined);
    onStay();
  };

  void queryClient
    .cancelQueries()
    .then(() => fetch(LOGOUT_PATH, { method: "POST", credentials: "include" }))
    .then((response) => {
      if (response.ok) {
        window.location.href = href;
      } else {
        throw new Error("Logout request was rejected");
      }
    })
    .catch(stay);

  return true;
}
