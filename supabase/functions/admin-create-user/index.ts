import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "npm:@supabase/server";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const SENSITIVE_KEYS = ["password", "senha", "token", "service_role", "apikey", "api_key", "secret"];
const RESEND_WINDOW_SECONDS = 120;

const PRODUCTION_APP_URL = "https://suporttech.lovable.app";

function getAppRedirect(req: Request) {
  const configured = Deno.env.get("SUPPORTTECH_APP_URL")?.trim().replace(/\/$/, "");
  const origin = req.headers.get("origin")?.trim().replace(/\/$/, "");

  const candidate = configured && !/^https?:\/\/(localhost|127\.0\.0\.1)(:\\d+)?$/i.test(configured)
    ? configured
    : origin && !/^https?:\/\/(localhost|127\.0\.0\.1)(:\\d+)?$/i.test(origin)
      ? origin
      : PRODUCTION_APP_URL;

  return `${candidate}/login?type=invite`;
}

function sanitize(metadata: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (SENSITIVE_KEYS.some((s) => key.toLowerCase().includes(s))) continue;
    if (value === undefined) continue;
    out[key] = value;
  }
  return out;
}

async function writeAudit(admin: any, entry: { actorId: string | null; action: string; entityType?: string | null; entityId?: string | null; metadata?: Record<string, unknown> }) {
  try {
    await admin.from("audit_log").insert({
      actor_id: entry.actorId,
      action: entry.action,
      entity_type: entry.entityType ?? null,
      entity_id: entry.entityId ?? null,
      metadata: sanitize(entry.metadata ?? {}),
    });
  } catch {}
}

export default {
  fetch: withSupabase({ auth: "user" }, async (req, ctx) => {
    if (req.method !== "POST") return json({ error: "Método não permitido." }, 405);

    const callerId = ctx.userClaims?.id ?? ctx.jwtClaims?.sub;
    if (!callerId) return json({ error: "Sessão inválida.", code: "UNAUTHENTICATED" }, 401);

    const { data: me, error: meError } = await ctx.supabaseAdmin
      .from("profiles").select("id,is_active,role_id").eq("id", callerId).maybeSingle();

    if (meError) return json({ error: "Não foi possível validar suas permissões.", code: "PROFILE_LOOKUP_FAILED" }, 500);
    if (!me) return json({ error: "Seu usuário não possui perfil cadastrado.", code: "PROFILE_NOT_FOUND" }, 403);
    if (!me.is_active) return json({ error: "Seu acesso está inativo.", code: "PROFILE_INACTIVE" }, 403);

    let myRole: string | null = null;
    if (me.role_id) {
      const { data: myRoleRow } = await ctx.supabaseAdmin.from("roles").select("key").eq("id", me.role_id).maybeSingle();
      myRole = myRoleRow?.key ? String(myRoleRow.key).trim().toLowerCase() : null;
    }
    if (myRole !== "admin") return json({ error: `Apenas administradores podem cadastrar usuários. Seu perfil atual: ${myRole ?? "não definido"}.`, code: "PERMISSION_DENIED" }, 403);

    const body = await req.json().catch(() => ({}));
    const action = String((body as any).action ?? "create").trim();

    if (action === "resend_invite") {
      const userId = String((body as any).userId ?? "").trim();
      if (!userId) return json({ error: "Usuário não informado.", code: "INVALID_INPUT" }, 400);

      const since = new Date(Date.now() - RESEND_WINDOW_SECONDS * 1000).toISOString();
      const { data: recent } = await ctx.supabaseAdmin.from("audit_log").select("id")
        .eq("action", "user.access_resent").eq("entity_id", userId).gte("created_at", since).limit(1);
      if (Array.isArray(recent) && recent.length > 0) {
        return json({ error: "Um convite já foi reenviado há poucos instantes. Aguarde para tentar novamente.", code: "RATE_LIMITED" }, 429);
      }

      const { data: profile, error: profileError } = await ctx.supabaseAdmin
        .from("profiles")
        .select("id,email,full_name,is_active")
        .eq("id", userId)
        .maybeSingle();
      if (profileError) return json({ error: "Não foi possível localizar o perfil do usuário.", code: "TARGET_LOOKUP_FAILED" }, 500);

      const { data: authUser, error: authError } = await ctx.supabaseAdmin.auth.admin.getUserById(userId);
      const targetEmail = profile?.email ? String(profile.email).trim().toLowerCase() : (authUser?.user?.email ?? null);
      if (authError || !authUser?.user || !targetEmail) {
        return json({ error: "Usuário não possui uma conta de autenticação válida.", code: "NOT_ELIGIBLE" }, 400);
      }

      const redirectTo = getAppRedirect(req);
      if (!redirectTo) return json({ error: "URL do sistema não configurada para o acesso.", code: "APP_URL_NOT_CONFIGURED" }, 500);

      const confirmed = Boolean(authUser.user.email_confirmed_at);
      const method = confirmed ? "password_recovery" : "signup_confirmation";

      // Para cadastro ainda não confirmado, reenviamos a confirmação.
      // Para cadastro já confirmado, enviamos um novo link para definir/recuperar a senha.
      const resendResult = confirmed
        ? await ctx.supabase.auth.resetPasswordForEmail(targetEmail, { redirectTo })
        : await ctx.supabaseAdmin.auth.resend({
            type: "signup",
            email: targetEmail,
            options: { emailRedirectTo: redirectTo },
          });

      if (resendResult.error) {
        const isRateLimit = /rate limit|rate_limit|too many|429/i.test(resendResult.error.message);
        return json({
          error: isRateLimit
            ? "O limite de envio de e-mails do Supabase foi atingido. Aguarde antes de tentar novamente."
            : "Não foi possível reenviar o acesso por e-mail. Verifique a configuração de e-mail do projeto.",
          code: isRateLimit ? "AUTH_EMAIL_RATE_LIMITED" : "ACCESS_RESEND_FAILED",
        }, 200);
      }

      await writeAudit(ctx.supabaseAdmin, {
        actorId: callerId,
        action: "user.access_resent",
        entityType: "user",
        entityId: userId,
        metadata: { email: targetEmail, method },
      });

      return json({
        ok: true,
        message: confirmed
          ? "Link de acesso/redefinição enviado para o e-mail do usuário."
          : "E-mail de confirmação de acesso reenviado para o usuário.",
      });
    }

    const fullName = String((body as any).fullName ?? "").trim();
    const email = String((body as any).email ?? "").trim().toLowerCase();
    const roleId = String((body as any).roleId ?? "");
    const departmentId = (body as any).departmentId ? String((body as any).departmentId) : null;
    const jobTitle = (body as any).jobTitle ? String((body as any).jobTitle).trim() : null;
    const phone = (body as any).phone ? String((body as any).phone).trim() : null;

    if (!fullName || !email || !roleId) return json({ error: "Nome, e-mail e perfil são obrigatórios.", code: "INVALID_INPUT" }, 400);

    const { data: role, error: roleError } = await ctx.supabaseAdmin.from("roles")
      .select("id,key,is_active").eq("id", roleId).single();
    if (roleError || !role?.is_active || !["admin", "technician", "requester"].includes(role.key)) {
      return json({ error: "Perfil de acesso inválido.", code: "INVALID_ROLE" }, 400);
    }

    if (departmentId) {
      const { data: dept, error: deptError } = await ctx.supabaseAdmin.from("departments")
        .select("id,is_active").eq("id", departmentId).single();
      if (deptError || !dept?.is_active) return json({ error: "Setor inválido ou inativo.", code: "INVALID_DEPARTMENT" }, 400);
    }

    const { data: existingProfile, error: existingProfileError } = await ctx.supabaseAdmin.from("profiles")
      .select("id,is_active").eq("email", email).maybeSingle();
    if (existingProfileError) return json({ error: "Não foi possível verificar se o e-mail já está cadastrado.", code: "PROFILE_LOOKUP_FAILED" }, 500);
    if (existingProfile) {
      return json({
        error: "Este e-mail já está cadastrado no sistema. Para um usuário ainda não confirmado, use a opção de reenviar convite.",
        code: "EMAIL_ALREADY_EXISTS",
      }, 409);
    }

    const inviteOptions: Record<string, unknown> = { data: { full_name: fullName } };
    const redirectTo = getAppRedirect(req);
    if (redirectTo) inviteOptions.redirectTo = redirectTo;
    const { data: invited, error: inviteError } = await ctx.supabaseAdmin.auth.admin.inviteUserByEmail(email, inviteOptions as any);

    if (inviteError || !invited.user) {
      const message = inviteError?.message ?? "Não foi possível enviar o convite.";
      const isRateLimit = /rate limit|rate_limit/i.test(message);
      return json({
        error: isRateLimit ? "O limite de envio de e-mails do Supabase foi atingido. Aguarde o período de limite antes de tentar novamente." : message,
        code: "AUTH_INVITE_FAILED",
      }, 200);
    }

    const { data: updatedProfile, error: profileError } = await ctx.supabaseAdmin.from("profiles")
      .update({
        full_name: fullName, email, job_title: jobTitle, phone,
        role_id: roleId, department_id: departmentId, is_active: true,
      })
      .eq("id", invited.user.id)
      .select("id")
      .maybeSingle();

    if (profileError || !updatedProfile) {
      await ctx.supabaseAdmin.auth.admin.deleteUser(invited.user.id);
      return json({ error: "Não foi possível configurar o perfil do usuário.", code: "PROFILE_CREATE_FAILED" }, 400);
    }

    await writeAudit(ctx.supabaseAdmin, {
      actorId: callerId, action: "user.created", entityType: "user", entityId: invited.user.id,
      metadata: { email, full_name: fullName, role_key: role.key, department_id: departmentId, job_title: jobTitle },
    });

    return json({ ok: true, userId: invited.user.id, email, message: "Usuário criado e convite enviado por e-mail." }, 201);
  }),
};