function secretKey(): string {
  // Newer projects expose secret keys as a JSON map; older ones only have the legacy service role key.
  try {
    const keys = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}");
    if (typeof keys.default === "string") return keys.default;
  } catch {
    // fall through to the legacy key
  }
  const legacy = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!legacy) throw new Error("No Supabase secret key in the function environment");
  return legacy;
}

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";

export const env = {
  supabaseUrl,
  serviceKey: secretKey(),
  apiBaseUrl: `${supabaseUrl}/functions/v1/api`,
  webBaseUrl: (Deno.env.get("WEB_BASE_URL") ?? "").replace(/\/$/, ""),
  tokenSecret: Deno.env.get("TOKEN_SECRET") ?? "",
  cronSecret: Deno.env.get("CRON_SECRET") ?? "",
  resendKey: Deno.env.get("RESEND_API_KEY") ?? "",
  emailFrom: Deno.env.get("EMAIL_FROM") ?? "",
  resendWebhookSecret: Deno.env.get("RESEND_WEBHOOK_SECRET") ?? "",
  expoAccessToken: Deno.env.get("EXPO_ACCESS_TOKEN") ?? "",
  cooldownHours: Number(Deno.env.get("COOLDOWN_HOURS") ?? "24"),
  silenceHours: Number(Deno.env.get("SILENCE_HOURS") ?? "12"),
};
