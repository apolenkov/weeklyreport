import * as path from "node:path";

export function appRouterRouteForPage(
  appRoot: string,
  pagePath: string,
): string {
  const relative = path.relative(appRoot, pagePath).split(path.sep).join("/");
  const segments = relative.split("/");
  if (segments.at(-1) !== "page.tsx") {
    throw new Error(`Not an App Router page: ${pagePath}`);
  }
  segments.pop();
  const routeSegments = segments.filter(
    (segment) => !/^\([^/]+\)$/u.test(segment),
  );
  return routeSegments.length === 0 ? "/" : `/${routeSegments.join("/")}`;
}
