import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "npm:@supabase/server";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

export default {
  fetch: withSupabase({ auth: "user" }, async (req, ctx) => {
    if (req.method !== "POST") return json({ error: "Método não permitido." }, 405);

    const callerId = ctx.userClaims?.id ?? ctx.jwtClaims?.sub;
    if (!callerId) return json({ error: "Sessão inválida.", code: "UNAUTHENTICATED" }, 401);

    const { data: me, error: meError } = await ctx.supabaseAdmin
      .from("profiles")
      .select("id,is_active,role_id")
      .eq("id", callerId)
      .maybeSingle();

    if (meError) return json({ error: `Não foi possível validar suas permissões: ${meError.message}`, code: "PROFILE_LOOKUP_FAILED" }, 500);
    if (!me) return json({ error: "Seu usuário não possui perfil cadastrado.", code: "PROFILE_NOT_FOUND" }, 403);
    if (!me.is_active) return json({ error: "Seu acesso está inativo.", code: "PROFILE_INACTIVE" }, 403);

    let myRole: string | null = null;
    if (me.role_id) {
      const { data: myRoleRow } = await ctx.supabaseAdmin.from("roles").select("key").eq("id", me.role_id).maybeSingle();
      myRole = myRoleRow?.key ? String(myRoleRow.key) : null;
    }

    if (myRole !== "admin") {
      return json({ error: `Apenas administradores podem redefinir senhas. Seu perfil atual: ${myRole ?? "não definido"}.`, code: "PERMISSION_DENIED" }, 403);
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

    try {
      await ctx.supabaseAdmin.from("audit_log").insert({
        actor_id: callerId,
        action: "user.password_reset_sent",
        entity_type: "user",
        entity_id: userId,
        metadata: { email: target.email, full_name: target.full_name ?? null },
      });
    } catch { /* auditoria nunca quebra a operação principal */ }

    return json({ ok: true, message: "Link de redefinição enviado para o e-mail do usuário." });
  }),
};