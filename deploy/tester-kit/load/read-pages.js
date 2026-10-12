// k6 read-only load against the tester stand: Lead and Head page loads after one SAML sign-in each.
//   LEAD_PW=... HEAD_PW=... k6 run deploy/tester-kit/load/read-pages.js
// Passwords come from ~/.local/state/wr-tester/secrets.env (PW_LEAD1, PW_HEAD). BASE defaults to the stand.
import http from "k6/http";
import { check } from "k6";

const BASE = __ENV.BASE || "http://localhost:8080";
const VUS = Number(__ENV.VUS || 20);

export const options = {
  scenarios: {
    pages: {
      executor: "constant-vus",
      vus: VUS,
      duration: __ENV.DURATION || "3m",
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<500"],
  },
};

function signIn(user, password) {
  const jar = new http.CookieJar();
  const form = http.get(`${BASE}/auth/saml/login`, { jar });
  const action = /action="([^"]+)"/.exec(form.body)[1].replace(/&amp;/g, "&");
  const post = http.post(action, { username: user, password }, { jar });
  const response = /name="SAMLResponse" value="([^"]+)"/.exec(post.body)[1];
  const relay = /name="RelayState" value="([^"]*)"/.exec(post.body);
  http.post(
    `${BASE}/auth/saml/callback`,
    { SAMLResponse: response, RelayState: relay ? relay[1] : "" },
    { jar },
  );
  return jar.cookiesForURL(BASE);
}

export function setup() {
  return {
    lead: signIn("lead1@weeklyreport.local", __ENV.LEAD_PW),
    head: signIn("head@weeklyreport.local", __ENV.HEAD_PW),
  };
}

const PAGES = {
  lead: ["/lead/report", "/reports/latest", "/reports/trends"],
  head: ["/head/dashboard", "/reports", "/reports/trends"],
};

export default function (cookies) {
  const role = __VU % 2 === 0 ? "lead" : "head";
  const jar = new http.CookieJar();
  for (const [name, values] of Object.entries(cookies[role]))
    jar.set(BASE, name, values[0]);
  for (const path of PAGES[role]) {
    const res = http.get(`${BASE}${path}`, { jar });
    check(res, { [`${path} 200`]: (r) => r.status === 200 });
  }
}
