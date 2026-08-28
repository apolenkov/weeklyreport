const IGNORED_CONSOLE_PATTERNS: readonly RegExp[] = [
  /favicon\.ico/i,
  /\/_next\/static\/(?:media\/[^ ]+\.woff2|css\/app\/global-error\.css).* was preloaded using link preload but not used within a few seconds from the window's load event\./,
];

export function isIgnoredRouteHealthConsoleMessage(text: string): boolean {
  return IGNORED_CONSOLE_PATTERNS.some((pattern) => pattern.test(text));
}
