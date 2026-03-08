export function getAppUrl() {
  const explicit =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SETU_URL ||
    process.env.NEXT_PUBLIC_SETUE_URL ||
    "";

  return explicit.trim().replace(/\/$/, "");
}

export function buildAuthCallbackUrl() {
  const appUrl = getAppUrl();
  return appUrl ? `${appUrl}/auth/callback` : undefined;
}
