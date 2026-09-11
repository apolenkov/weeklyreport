import "server-only";

import { z } from "zod";

const publicWebOriginSchema = z.url().transform((value, context) => {
  const url = new URL(value);
  const isHttp = url.protocol === "http:" || url.protocol === "https:";
  const isBareOrigin =
    url.username === "" &&
    url.password === "" &&
    url.pathname === "/" &&
    url.search === "" &&
    url.hash === "";

  if (!isHttp || !isBareOrigin) {
    context.addIssue({
      code: "custom",
      message: "must be a bare HTTP(S) origin",
    });
    return z.NEVER;
  }

  return url.origin;
});

export function requirePublicWebOrigin(): string {
  const result = publicWebOriginSchema.safeParse(process.env.FRONTEND_URL);
  if (!result.success) {
    throw new Error(
      "Public web origin is not configured correctly — set FRONTEND_URL to a bare HTTP(S) origin.",
    );
  }
  return result.data;
}
