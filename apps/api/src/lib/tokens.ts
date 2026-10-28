export async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, "0")).join("");
}
export function testEmailLinksAllowed(env: { APP_ENV?: string; ALLOW_TEST_EMAIL_LINKS?: string }): boolean {
  return env.APP_ENV === "development" && env.ALLOW_TEST_EMAIL_LINKS === "1";
}
export const subscriptionReply = { ok: true, status: "pending", message: "If eligible, a confirmation email will arrive. Delivery may be delayed." } as const;
