import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "npm:@supabase/server";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

export default {
  fetch: withSupabase({ auth: "user" }, async (req, ctx) => {
    if (req.method !== "POST") return json({ error: "Método não permitido." }, 405);

    const { data: me, error: meError } = await ctx.supabase
      .from("profiles")
      .select("id,roles(key)")
      .eq("id", (ctx.userClaims?.id ?? ctx.jwtClaims?.sub))
      .single();

    const myRole = Array.isArray(me?.roles)
      ? me.roles[0]?.key
      : (me?.roles as { key?: string } | null)?.key;

    if (meError || myRole !== "admin") {
      return json({ error: "Apenas administradores podem redefinir senhas.", code: "PERMISSION_DENIED" }, 403);
    }

    const body = await req.json();
    const userId = String(body.userId ?? "").trim();
    if (!userId) return json({ error: "Usuário não informado.", code: "INVALID_INPUT" }, 400);

    const { data: target, error: targetError } = await ctx.supabaseAdmin
      .from("profiles")
      .select("id,email,full_name")
      .eq("id", userId)
      .single();

    if (targetError || !target?.email) {
      return json({ error: "Usuário não possui e-mail válido para recuperação.", code: "USER_EMAIL_NOT_FOUND" }, 400);
    }

    const PRODUCTION_APP_URL = "https://suporttech.lovable.app";
    const configured = Deno.env.get("SUPPORTTECH_APP_URL")?.trim().replace(/\/$/, "");
    const origin = req.headers.get("origin")?.trim().replace(/\/$/, "");
    const base = configured && !/^https?:\/\/(localhost|127\.0\.0\.1)(:\\d+)?$/i.test(configured)
      ? configured
      : origin && !/^https?:\/\/(localhost|127\.0\.0\.1)(:\\d+)?$/i.test(origin)
        ? origin
        : PRODUCTION_APP_URL;
    const redirectTo = `${base}/login`;

    const { error: resetError } = await ctx.supabase.auth.resetPasswordForEmail(target.email, { redirectTo });

    if (resetError) {
      return json({ error: "Não foi possível enviar o link de redefinição.", code: "PASSWORD_RESET_FAILED" }, 400);
    }

    return json({ ok: true, message: "Link de redefinição enviado para o e-mail do usuário." });
  }),
};