import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "npm:@supabase/server";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { "Content-Type": "application/json" },
});

const SENSITIVE_KEYS = ["password", "senha", "token", "service_role", "apikey", "api_key", "secret"];
const RESEND_WINDOW_SECONDS = 120;
const PRODUCTION_APP_URL = "https://suporttech.lovable.app";

function getAppUrl(req: Request) {
  const configured = Deno.env.get("SUPPORTTECH_APP_URL")?.trim().replace(/\/$/, "");
  const origin = req.headers.get("origin")?.trim().replace(/\/$/, "");
  if (configured && !/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(configured)) return configured;
  if (origin && !/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin)) return origin;
  return PRODUCTION_APP_URL;
}
function sanitize(metadata: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (SENSITIVE_KEYS.some((s) => key.toLowerCase().includes(s))) continue;
    if (value !== undefined) out[key] = value;
  }
  return out;
}
async function writeAudit(admin: any, entry: any) {
  try { await admin.from("audit_log").insert({
    actor_id: entry.actorId, action: entry.action, entity_type: entry.entityType ?? null,
    entity_id: entry.entityId ?? null, metadata: sanitize(entry.metadata ?? {}),
  }); } catch {}
}
async function getEmailConfig(admin: any) {
  const { data } = await admin.from("app_settings").select("value").eq("key", "email").maybeSingle();
  const email = (data?.value ?? {}) as Record<string, any>;
  return {
    apiKey: Deno.env.get("RESEND_API_KEY")?.trim() ?? "",
    fromName: String(email.fromName ?? "SuportTech").trim() || "SuportTech",
    fromEmail: String(email.fromEmail ?? "").trim(),
    replyTo: String(email.replyTo ?? "").trim(),
  };
}
async function sendViaResend(config: any, input: any) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: "Bearer " + config.apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: config.fromName + " <" + config.fromEmail + ">",
      to: input.to,
      ...(config.replyTo ? { reply_to: config.replyTo } : {}),
      subject: input.subject, html: input.html, text: input.text,
    }),
  });
  return response.ok;
}
function inviteEmail(name: string, actionLink: string) {
  const safeName = name.replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;");
  return {
    subject: "Seu acesso ao SuportTech",
    html: "<!doctype html><html lang='pt-BR'><body style='font-family:Arial,sans-serif;background:#f3f4f6;margin:0;padding:24px;color:#111827'><div style='max-width:620px;margin:auto;background:#fff;padding:28px;border-radius:14px;border:1px solid #e5e7eb'><div style='font-size:12px;color:#6b7280'>SuportTech · IT Operations</div><h2>Seu acesso foi criado</h2><p>Olá, <strong>"+safeName+"</strong>.</p><p>Seu usuário foi cadastrado no SuportTech. Clique abaixo para validar o acesso e criar sua senha.</p><p><a href='"+actionLink+"' style='display:inline-block;background:#111827;color:#fff;text-decoration:none;padding:12px 18px;border-radius:9px;font-weight:700'>Ativar meu acesso</a></p><p style='font-size:12px;color:#6b7280'>Se o botão não funcionar, copie e cole o link no navegador. O link é individual e temporário.</p></div></body></html>",
    text: "Seu acesso ao SuportTech\n\nOlá, "+name+".\n\nSeu usuário foi cadastrado. Use este link para validar o acesso e criar sua senha:\n"+actionLink,
  };
}

export default {
  fetch: withSupabase({ auth: "user" }, async (req, ctx) => {
    if (req.method !== "POST") return json({ error: "Método não permitido." }, 405);
    const callerId = ctx.userClaims?.id ?? ctx.jwtClaims?.sub;
    if (!callerId) return json({ error: "Sessão inválida.", code: "UNAUTHENTICATED" }, 401);

    const { data: me, error: meError } = await ctx.supabaseAdmin.from("profiles")
      .select("id,is_active,role_id").eq("id", callerId).maybeSingle();
    if (meError) return json({ error: "Não foi possível validar suas permissões.", code: "PROFILE_LOOKUP_FAILED" }, 500);
    if (!me?.is_active) return json({ error: "Seu acesso está inativo.", code: "PROFILE_INACTIVE" }, 403);

    const { data: myRoleRow } = await ctx.supabaseAdmin.from("roles").select("key").eq("id", me.role_id).maybeSingle();
    const myRole = myRoleRow?.key ? String(myRoleRow.key).trim().toLowerCase() : null;
    if (myRole !== "admin") return json({ error: "Apenas administradores podem gerenciar acessos.", code: "PERMISSION_DENIED" }, 403);

    const body = await req.json().catch(() => ({}));
    const action = String(body.action ?? "create").trim();
    const config = await getEmailConfig(ctx.supabaseAdmin);
    if (!config.fromEmail) return json({ error: "Configure o e-mail do remetente em Configurações > E-mail.", code: "EMAIL_SENDER_NOT_CONFIGURED" }, 200);
    if (!config.apiKey) return json({ error: "O RESEND_API_KEY ainda não foi configurado nos secrets do Supabase.", code: "RESEND_NOT_CONFIGURED" }, 200);

    if (action === "resend_invite") {
      const userId = String(body.userId ?? "").trim();
      if (!userId) return json({ error: "Usuário não informado.", code: "INVALID_INPUT" }, 200);

      const since = new Date(Date.now() - RESEND_WINDOW_SECONDS * 1000).toISOString();
      const { data: recent } = await ctx.supabaseAdmin.from("audit_log").select("id")
        .eq("action", "user.access_resent").eq("entity_id", userId).gte("created_at", since).limit(1);
      if (recent?.length) {
        return json({ error: "Um acesso já foi reenviado há poucos instantes. Aguarde e tente novamente.", code: "RATE_LIMITED" }, 200);
      }

      const { data: profile } = await ctx.supabaseAdmin.from("profiles")
        .select("id,email,full_name,is_active").eq("id", userId).maybeSingle();
      const { data: authUser, error: authError } = await ctx.supabaseAdmin.auth.admin.getUserById(userId);
      const targetEmail = profile?.email ? String(profile.email).trim().toLowerCase() : (authUser?.user?.email ?? "");

      if (authError || !authUser?.user || !targetEmail) {
        return json({ error: "Usuário não possui uma conta de autenticação válida.", code: "NOT_ELIGIBLE" }, 200);
      }

      const confirmed = Boolean(authUser.user.email_confirmed_at);
      const linkType = confirmed ? "recovery" : "invite";
      const redirectTo = getAppUrl(req) + (confirmed
        ? "/auth/confirm?type=recovery"
        : "/auth/confirm?type=invite");

      const { data: linkData, error: linkError } = await ctx.supabaseAdmin.auth.admin.generateLink({
        type: linkType,
        email: targetEmail,
        redirectTo,
      });

      if (linkError || !linkData?.properties?.action_link) {
        return json({ error: "Não foi possível gerar um novo link de acesso.", code: "INVITE_LINK_FAILED" }, 200);
      }

      const name = String(profile?.full_name ?? targetEmail);
      const safeName = name.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

      const mail = confirmed
        ? {
            subject: "Seu acesso ao SuportTech",
            html: "<!doctype html><html lang='pt-BR'><body style='font-family:Arial,sans-serif;background:#f3f4f6;margin:0;padding:24px;color:#111827'><div style='max-width:620px;margin:auto;background:#fff;padding:28px;border-radius:14px;border:1px solid #e5e7eb'><div style='font-size:12px;color:#6b7280'>SuportTech · IT Operations</div><h2>Acesso ao SuportTech</h2><p>Olá, <strong>" + safeName + "</strong>.</p><p>Estamos reenviando seu acesso ao SuportTech. Use o botão abaixo para definir ou atualizar sua senha.</p><p><a href='" + linkData.properties.action_link + "' style='display:inline-block;background:#111827;color:#fff;text-decoration:none;padding:12px 18px;border-radius:9px;font-weight:700'>Acessar SuportTech</a></p><p style='font-size:12px;color:#6b7280'>O link é individual e temporário.</p></div></body></html>",
            text: "Acesso ao SuportTech\n\nOlá, " + name + ".\n\nEstamos reenviando seu acesso. Use este link para definir ou atualizar sua senha:\n" + linkData.properties.action_link,
          }
        : inviteEmail(name, linkData.properties.action_link);

      const sent = await sendViaResend(config, { to: [targetEmail], ...mail });
      if (!sent) {
        return json({ error: "O Resend recusou o envio do acesso.", code: "EMAIL_PROVIDER_REJECTED" }, 200);
      }

      await writeAudit(ctx.supabaseAdmin, {
        actorId: callerId,
        action: "user.access_resent",
        entityType: "user",
        entityId: userId,
        metadata: {
          email_domain: targetEmail.split("@")[1] ?? null,
          link_type: linkType,
        },
      });

      return json({
        ok: true,
        message: confirmed
          ? "Acesso reenviado pelo Resend. Foi enviado um link seguro para definição ou atualização da senha."
          : "Acesso reenviado pelo Resend.",
      });
    }

    const fullName = String(body.fullName ?? "").trim();
    const email = String(body.email ?? "").trim().toLowerCase();
    const roleId = String(body.roleId ?? "");
    const departmentId = body.departmentId ? String(body.departmentId) : null;
    const jobTitle = body.jobTitle ? String(body.jobTitle).trim() : null;
    const phone = body.phone ? String(body.phone).trim() : null;
    if (!fullName || !email || !roleId) return json({ error: "Nome, e-mail e perfil são obrigatórios.", code: "INVALID_INPUT" }, 400);

    const { data: role, error: roleError } = await ctx.supabaseAdmin.from("roles").select("id,key,is_active").eq("id",roleId).single();
    if (roleError || !role?.is_active) return json({ error: "Perfil de acesso inválido.", code: "INVALID_ROLE" }, 400);
    if (departmentId) {
      const { data: dept, error: deptError } = await ctx.supabaseAdmin.from("departments").select("id,is_active").eq("id",departmentId).single();
      if (deptError || !dept?.is_active) return json({ error: "Setor inválido ou inativo.", code: "INVALID_DEPARTMENT" }, 400);
    }
    const { data: existingProfile } = await ctx.supabaseAdmin.from("profiles").select("id").eq("email",email).maybeSingle();
    if (existingProfile) return json({ error: "Este e-mail já está cadastrado no sistema.", code: "EMAIL_ALREADY_EXISTS" }, 409);

    const redirectTo = getAppUrl(req) + "/auth/confirm?type=invite";
    const { data: invited, error: inviteError } = await ctx.supabaseAdmin.auth.admin.generateLink({
      type: "invite", email, data: { full_name: fullName }, redirectTo,
    });
    if (inviteError || !invited?.user || !invited?.properties?.action_link) return json({ error: "Não foi possível criar o acesso.", code: "AUTH_INVITE_FAILED" }, 200);

    const { data: updatedProfile, error: profileError } = await ctx.supabaseAdmin.from("profiles").update({
      full_name: fullName, email, job_title: jobTitle, phone, role_id: roleId, department_id: departmentId, is_active: true,
    }).eq("id", invited.user.id).select("id").maybeSingle();

    if (profileError || !updatedProfile) {
      await ctx.supabaseAdmin.auth.admin.deleteUser(invited.user.id);
      return json({ error: "Não foi possível configurar o perfil do usuário.", code: "PROFILE_CREATE_FAILED" }, 400);
    }

    const mail = inviteEmail(fullName, invited.properties.action_link);
    const sent = await sendViaResend(config, { to: [email], ...mail });
    if (!sent) {
      await ctx.supabaseAdmin.auth.admin.deleteUser(invited.user.id);
      return json({ error: "O usuário foi revertido porque o Resend recusou o envio do acesso.", code: "EMAIL_PROVIDER_REJECTED" }, 200);
    }

    await writeAudit(ctx.supabaseAdmin, { actorId: callerId, action: "user.created", entityType: "user", entityId: invited.user.id, metadata: { email_domain: email.split("@")[1] ?? null, role_key: role.key, department_id: departmentId }});
    return json({ ok: true, userId: invited.user.id, email, message: "Usuário criado e acesso enviado pelo Resend." }, 201);
  }),
};
