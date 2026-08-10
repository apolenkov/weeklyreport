const LOGOUT_PATH = "/auth/logout";

// Redirect only after the server confirms logout; otherwise preserve the
// current signed-in page and expose recovery through onStay.
export function logoutThenRedirect(href: string, onStay: () => void): void {
  void fetch(LOGOUT_PATH, { method: "POST", credentials: "include" })
    .then((response) => {
      if (response.ok) {
        window.location.href = href;
      } else {
        onStay();
      }
    })
    .catch(onStay);
}
