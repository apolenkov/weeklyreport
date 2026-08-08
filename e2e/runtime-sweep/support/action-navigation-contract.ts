const SIGN_OUT_CONTROL_KEY = /^button:Sign(?:%20|\s)out:\d+$/u;

export const expectedActionPathnameFor = (
  controlKey: string,
): string | undefined =>
  SIGN_OUT_CONTROL_KEY.test(controlKey) ? "/" : undefined;
