import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "npm:@supabase/server";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

export default {
  fetch: withSupabase({ auth: "user" }, async (req, ctx) => {
    if (req.method !== "POST") return json({ error: "Método não permitido." }, 405);

    const callerId = ctx.userClaims?.sub;
    if (!callerId) return json({ error: "Sessão inválida.", code: "UNAUTHENTICATED" }, 401);

    const { data: me, error: meError } = await ctx.supabaseAdmin
      .from("profiles")
      .select("id,is_active,roles(key)")
      .eq("id", callerId)
      .single();

    const myRole = Array.isArray(me?.roles)
      ? me.roles[0]?.key
      : (me?.roles as { key?: string } | null)?.key;

    if (meError || !me?.is_active || myRole !== "admin") {
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

    const redirectTo = new URL("/login", req.url).toString();
    const { error: resetError } = await ctx.supabase.auth.resetPasswordForEmail(target.email, { redirectTo });

    if (resetError) {
      return json({ error: "Não foi possível enviar o link de redefinição.", code: "PASSWORD_RESET_FAILED" }, 400);
    }

    return json({ ok: true, message: "Link de redefinição enviado para o e-mail do usuário." });
  }),
};