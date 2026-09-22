import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "npm:@supabase/server";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const SENSITIVE_KEYS = ["password", "senha", "token", "service_role", "apikey", "api_key", "secret"];
const RESEND_WINDOW_SECONDS = 120;

function sanitize(metadata: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (SENSITIVE_KEYS.some((s) => key.toLowerCase().includes(s))) continue;
    if (value === undefined) continue;
    out[key] = value;
  }
  return out;
}

async function writeAudit(
  admin: any,
  entry: {
    actorId: string | null;
    action: string;
    entityType?: string | null;
    entityId?: string | null;
    metadata?: Record<string, unknown>;
  },
) {
  try {
    await admin.from("audit_log").insert({
      actor_id: entry.actorId,
      action: entry.action,
      entity_type: entry.entityType ?? null,
      entity_id: entry.entityId ?? null,
      metadata: sanitize(entry.metadata ?? {}),
    });
  } catch {
    // Auditoria nunca quebra a operação principal.
  }
}

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

    if (meError) {
      return json({
        error: "Não foi possível validar suas permissões.",
        code: "PROFILE_LOOKUP_FAILED",
      }, 500);
    }

    if (!me) return json({ error: "Seu usuário não possui perfil cadastrado.", code: "PROFILE_NOT_FOUND" }, 403);
    if (!me.is_active) return json({ error: "Seu acesso está inativo.", code: "PROFILE_INACTIVE" }, 403);

    let myRole: string | null = null;
    if (me.role_id) {
      const { data: myRoleRow } = await ctx.supabaseAdmin
        .from("roles")
        .select("key")
        .eq("id", me.role_id)
        .maybeSingle();
      myRole = myRoleRow?.key ? String(myRoleRow.key).trim().toLowerCase() : null;
    }

    if (myRole !== "admin") {
      return json({
        error: `Apenas administradores podem cadastrar usuários. Seu perfil atual: ${myRole ?? "não definido"}.`,
        code: "PERMISSION_DENIED",
      }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const action = String((body as any).action ?? "create").trim();

    if (action === "resend_invite") {
      const userId = String((body as any).userId ?? "").trim();
      if (!userId) return json({ error: "Usuário não informado.", code: "INVALID_INPUT" }, 400);

      const since = new Date(Date.now() - RESEND_WINDOW_SECONDS * 1000).toISOString();
      const { data: recent } = await ctx.supabaseAdmin
        .from("audit_log")
        .select("id")
        .eq("action", "user.invite_resent")
        .eq("entity_id", userId)
        .gte("created_at", since)
        .limit(1);

      if (Array.isArray(recent) && recent.length > 0) {
        return json({
          error: "Um convite já foi reenviado há poucos instantes. Aguarde para tentar novamente.",
          code: "RATE_LIMITED",
        }, 429);
      }

      const notEligible = json({
        error: "Este usuário não está elegível para reenvio de convite.",
        code: "NOT_ELIGIBLE",
      }, 400);

      const { data: profile } = await ctx.supabaseAdmin
        .from("profiles")
        .select("id,email,full_name")
        .eq("id", userId)
        .maybeSingle();

      const { data: authUser } = await ctx.supabaseAdmin.auth.admin.getUserById(userId);
      const targetEmail = profile?.email ? String(profile.email) : (authUser?.user?.email ?? null);

      if (!authUser?.user || !targetEmail) return notEligible;
      if (authUser.user.email_confirmed_at || authUser.user.last_sign_in_at) return notEligible;

      const { error: resendError } = await ctx.supabaseAdmin.auth.admin.inviteUserByEmail(
        targetEmail,
        { data: { full_name: profile?.full_name ?? authUser.user.user_metadata?.full_name ?? null } },
      );

      if (resendError) {
        console.error("Invite resend failed:", resendError.message);
        const isRateLimit = /rate limit|rate_limit/i.test(resendError.message);
        return json({
          error: isRateLimit
            ? "O limite de envio de e-mails do Supabase foi atingido. Aguarde antes de tentar novamente."
            : "Não foi possível reenviar o convite agora.",
          code: "INVITE_RESEND_FAILED",
        }, isRateLimit ? 429 : 400);
      }

      await writeAudit(ctx.supabaseAdmin, {
        actorId: callerId,
        action: "user.invite_resent",
        entityType: "user",
        entityId: userId,
        metadata: { email: targetEmail, full_name: profile?.full_name ?? null },
      });

      return json({ ok: true, message: "Convite reenviado para o e-mail do usuário." });
    }

    const fullName = String((body as any).fullName ?? "").trim();
    const email = String((body as any).email ?? "").trim().toLowerCase();
    const roleId = String((body as any).roleId ?? "");
    const departmentId = (body as any).departmentId ? String((body as any).departmentId) : null;
    const jobTitle = (body as any).jobTitle ? String((body as any).jobTitle).trim() : null;
    const phone = (body as any).phone ? String((body as any).phone).trim() : null;

    if (!fullName || !email || !roleId) {
      return json({
        error: "Nome, e-mail e perfil são obrigatórios.",
        code: "INVALID_INPUT",
      }, 400);
    }

    const { data: role, error: roleError } = await ctx.supabaseAdmin
      .from("roles")
      .select("id,key,is_active")
      .eq("id", roleId)
      .single();

    if (roleError || !role?.is_active || !["admin", "technician", "requester"].includes(role.key)) {
      return json({ error: "Perfil de acesso inválido.", code: "INVALID_ROLE" }, 400);
    }

    if (departmentId) {
      const { data: dept, error: deptError } = await ctx.supabaseAdmin
        .from("departments")
        .select("id,is_active")
        .eq("id", departmentId)
        .single();

      if (deptError || !dept?.is_active) {
        return json({ error: "Setor inválido ou inativo.", code: "INVALID_DEPARTMENT" }, 400);
      }
    }

    const { data: existingProfile, error: existingProfileError } = await ctx.supabaseAdmin
      .from("profiles")
      .select("id,is_active")
      .eq("email", email)
      .maybeSingle();

    if (existingProfileError) {
      console.error("Existing profile lookup failed:", existingProfileError.message);
      return json({
        error: "Não foi possível verificar se o e-mail já está cadastrado.",
        code: "PROFILE_LOOKUP_FAILED",
      }, 500);
    }

    if (existingProfile) {
      return json({
        error: "Este e-mail já está cadastrado no sistema. Para um usuário ainda não confirmado, use a opção de reenviar convite.",
        code: "EMAIL_ALREADY_EXISTS",
      }, 409);
    }

    const { data: invited, error: inviteError } =
      await ctx.supabaseAdmin.auth.admin.inviteUserByEmail(email, {
        data: { full_name: fullName },
      });

    if (inviteError || !invited.user) {
      console.error("Auth invite failed:", inviteError?.message ?? "unknown error");
      const message = inviteError?.message ?? "Não foi possível enviar o convite.";
      const isRateLimit = /rate limit|rate_limit/i.test(message);

      return json({
        error: isRateLimit
          ? "O limite de envio de e-mails do Supabase foi atingido. Aguarde o período de limite antes de tentar novamente."
          : message,
        code: "AUTH_INVITE_FAILED",
      }, isRateLimit ? 429 : 400);
    }

    // O trigger on_auth_user_created_profile já cria o perfil básico.
    // Aqui apenas configuramos o perfil com os dados escolhidos pelo administrador.
    const { data: updatedProfile, error: profileError } = await ctx.supabaseAdmin
      .from("profiles")
      .update({
        full_name: fullName,
        email,
        job_title: jobTitle,
        phone,
        role_id: roleId,
        department_id: departmentId,
        is_active: true,
      })
      .eq("id", invited.user.id)
      .select("id")
      .maybeSingle();

    if (profileError || !updatedProfile) {
      console.error(
        "Profile update after invite failed:",
        profileError?.message ?? "profile not found",
      );

      await ctx.supabaseAdmin.auth.admin.deleteUser(invited.user.id);

      return json({
        error: "Não foi possível configurar o perfil do usuário.",
        code: "PROFILE_CREATE_FAILED",
      }, 400);
    }

    await writeAudit(ctx.supabaseAdmin, {
      actorId: callerId,
      action: "user.created",
      entityType: "user",
      entityId: invited.user.id,
      metadata: {
        email,
        full_name: fullName,
        role_key: role.key,
        department_id: departmentId,
        job_title: jobTitle,
      },
    });

    return json({
      ok: true,
      userId: invited.user.id,
      email,
      message: "Usuário criado e convite enviado por e-mail.",
    }, 201);
  }),
};
