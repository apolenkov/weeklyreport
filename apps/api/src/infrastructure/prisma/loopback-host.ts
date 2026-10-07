// Narrow loopback host parser shared by the PostgreSQL and Redis E2E target
// checks: "localhost" (any case), a canonical IPv4 in 127/8, or valid IPv6 —
// "::1" or an explicit IPv4-mapped 127/8 literal. Brackets are optional,
// balanced, IPv6-only; isIP validates the whole literal, so whitespace and
// partial forms are refused. Returns the dialable form or null.
import { isIP } from "node:net";

const IPV4_FAMILY = 4;
const IPV6_FAMILY = 6;
const IPV6_MAPPED_PREFIX = "::ffff:";
const IPV4_MAPPED_HIGH_WORD_MIN = 0x7f_00;
const IPV4_MAPPED_HIGH_WORD_MAX = 0x7f_ff;
const IPV6_WORD = /^[0-9a-f]{1,4}$/u;

const isLoopbackIpv4 = (host: string): boolean =>
  host.startsWith("127.") && isIP(host) === IPV4_FAMILY;

// IPv4-mapped tail after "::ffff:": a dotted quad in 127/8, or a strict hex
// pair whose high word is 0x7f00..0x7fff — the same range WHATWG produces
// when it rewrites a mapped dotted literal to hex words.
const ipv4MappedLoopbackTail = (mapped: string): boolean => {
  if (isLoopbackIpv4(mapped)) return true;
  const [highRaw, lowRaw, extra] = mapped.split(":");
  if (extra !== undefined || highRaw === undefined || lowRaw === undefined)
    return false;
  if (!IPV6_WORD.test(highRaw) || !IPV6_WORD.test(lowRaw)) return false;
  const high = Number.parseInt(highRaw, 16);
  return high >= IPV4_MAPPED_HIGH_WORD_MIN && high <= IPV4_MAPPED_HIGH_WORD_MAX;
};

const loopbackHostCandidate = (
  host: string,
  bracketed: boolean,
): string | null => {
  const lower = host.toLowerCase();
  if (lower === "localhost") return bracketed ? null : "localhost";
  if (isLoopbackIpv4(host)) return host;
  if (isIP(host) !== IPV6_FAMILY) return null;
  if (lower === "::1") return lower;
  if (!lower.startsWith(IPV6_MAPPED_PREFIX)) return null;
  return ipv4MappedLoopbackTail(lower.slice(IPV6_MAPPED_PREFIX.length))
    ? host
    : null;
};

export const parseLoopbackHost = (hostname: string): string | null => {
  const hasOpen = hostname.startsWith("[");
  if (hasOpen !== hostname.endsWith("]")) return null;
  const host = hasOpen ? hostname.slice(1, -1) : hostname;
  if (hasOpen && isIP(host) !== IPV6_FAMILY) return null;
  return loopbackHostCandidate(host, hasOpen);
};

export const isLoopbackHost = (hostname: string): boolean =>
  parseLoopbackHost(hostname) !== null;
