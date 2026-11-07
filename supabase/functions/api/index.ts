// Single Edge Function for all of BeSeen: one deploy, one URL.
//   https://<project>.supabase.co/functions/v1/api/<route>
import { cors, HttpError, json } from "./lib/http.ts";
import * as device from "./routes/device.ts";
import * as rules from "./routes/rules.ts";
import * as partner from "./routes/partner.ts";
import * as cron from "./routes/cron.ts";

type Handler = (req: Request, url: URL) => Promise<Response>;

const routes: Record<string, Handler> = {
  // app (device credentials)
  "POST register": device.register,
  "POST state": device.state,
  "POST device/heartbeat": device.heartbeat,
  "POST device/events": device.events,
  "POST device/push-token": device.pushToken,
  "POST rules/create": rules.create,
  "POST rules/change": rules.change,
  "POST rules/remove": rules.remove,
  "POST rules/cancel": rules.cancel,
  "POST partner/invite": partner.invite,
  "POST partner/new-link": partner.newLink,
  "POST partner/cancel-invite": partner.cancelInvite,
  "POST partner/remove": partner.remove,
  "POST partner/test": partner.test,
  "POST partner/accept": partner.acceptInApp,
  "POST partner/leave": partner.leave,
  // partner web pages (public)
  "POST public/invite-info": partner.inviteInfo,
  "POST public/accept-email": partner.acceptByEmail,
  "POST public/confirm-email": partner.confirmEmail,
  "POST public/stop": partner.stop,
  // infrastructure
  "POST cron/tick": cron.tick,
  "POST webhooks/resend": partner.resendWebhook,
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const url = new URL(req.url);
  const route = url.pathname.replace(/^.*?\/api\/?/, "").replace(/\/$/, "");
  const handler = routes[`${req.method} ${route}`];
  if (!handler) return json({ error: "Not found" }, 404);
  try {
    return await handler(req, url);
  } catch (e) {
    if (e instanceof HttpError) return json({ error: e.message }, e.status);
    console.error(route, e);
    return json({ error: "Something went wrong. Try again." }, 500);
  }
});
