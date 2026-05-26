// Vitest stub for the `server-only` package.
// In production Next.js, `server-only` throws when imported in Client
// Components. In jsdom tests there is no RSC boundary, so we replace it
// with an empty module so server-component helpers can be imported without
// triggering the guard.
export {};
