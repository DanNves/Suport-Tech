import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "npm:@supabase/server";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const SENSITIVE_KEYS = ["password", "senha", "token", "service_role", "apikey", "api_key", "secret"];
const RESEND_WINDOW_SECONDS = 120;

function sanitize(metadata: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (SENSITIVE_KEYS.some(s => key.toLowerCase().includes(s))) continue;
    if (value === undefined) continue;
    out[key] = value;
  }
  return out;
}

async function writeAudit(admin: any, entry: { actorId: string | null; action: string; entityType?: string | null; entityId?: string | null; metadata?: Record<string, unknown> }) {
  try {
    await admin.from("audit_log").insert({ actor_id: entry.actorId, action: entry.action, entity_type: entry.entityType ?? null, entity_id: entry.entityId ?? null, metadata: sanitize(entry.metadata ?? {}) });
  } catch { /* auditoria nunca quebra a operação principal */ }
}

export default { fetch: withSupabase({ auth: "user" }, async (req, ctx) => {
  if (req.method !== "POST") return json({ error: "Método não permitido." }, 405);
  const callerId = ctx.userClaims?.sub;
  if (!callerId) return json({ error: "Sessão inválida.", code: "UNAUTHENTICATED" }, 401);
  const { data: me, error: meError } = await ctx.supabaseAdmin.from("profiles").select("id,is_active,role_id").eq("id", callerId).maybeSingle();
  if (meError) return json({ error: `Não foi possível validar suas permissões: ${meError.message}`, code: "PROFILE_LOOKUP_FAILED" }, 500);
  if (!me) return json({ error: "Seu usuário não possui perfil cadastrado.", code: "PROFILE_NOT_FOUND" }, 403);
  if (!me.is_active) return json({ error: "Seu acesso está inativo.", code: "PROFILE_INACTIVE" }, 403);
  let myRole: string | null = null;
  if (me.role_id) { const { data: myRoleRow } = await ctx.supabaseAdmin.from("roles").select("key").eq("id", me.role_id).maybeSingle(); myRole = myRoleRow?.key ? String(myRoleRow.key).trim().toLowerCase() : null; }
  if (myRole !== "admin") return json({ error: `Apenas administradores podem cadastrar usuários. Seu perfil atual: ${myRole ?? "não definido"}.`, code: "PERMISSION_DENIED" }, 403);

  const body = await req.json().catch(() => ({}));
  const action = String((body as any).action ?? "create").trim();

  // ---------- Reenvio de convite ----------
  if (action === "resend_invite") {
    const userId = String((body as any).userId ?? "").trim();
    if (!userId) return json({ error: "Usuário não informado.", code: "INVALID_INPUT" }, 400);
    const since = new Date(Date.now() - RESEND_WINDOW_SECONDS * 1000).toISOString();
    const { data: recent } = await ctx.supabaseAdmin.from("audit_log").select("id").eq("action", "user.invite_resent").eq("entity_id", userId).gte("created_at", since).limit(1);
    if (Array.isArray(recent) && recent.length > 0) return json({ error: "Um convite já foi reenviado há poucos instantes. Aguarde para tentar novamente.", code: "RATE_LIMITED" }, 429);

    const notEligible = json({ error: "Este usuário não está elegível para reenvio de convite.", code: "NOT_ELIGIBLE" }, 400);
    const { data: profile } = await ctx.supabaseAdmin.from("profiles").select("id,email,full_name").eq("id", userId).maybeSingle();
    const { data: authUser } = await ctx.supabaseAdmin.auth.admin.getUserById(userId);
    const targetEmail = profile?.email ? String(profile.email) : (authUser?.user?.email ?? null);
    if (!authUser?.user || !targetEmail) return notEligible;
    if (authUser.user.email_confirmed_at || authUser.user.last_sign_in_at) return notEligible;

    const { error: resendError } = await ctx.supabaseAdmin.auth.admin.inviteUserByEmail(targetEmail, { data: { full_name: profile?.full_name ?? authUser.user.user_metadata?.full_name ?? null } });
    if (resendError) return json({ error: "Não foi possível reenviar o convite agora.", code: "INVITE_RESEND_FAILED" }, 400);
    await writeAudit(ctx.supabaseAdmin, { actorId: callerId, action: "user.invite_resent", entityType: "user", entityId: userId, metadata: { email: targetEmail, full_name: profile?.full_name ?? null } });
    return json({ ok: true, message: "Convite reenviado para o e-mail do usuário." });
  }

  // ---------- Criação de usuário ----------
  const fullName = String((body as any).fullName ?? "").trim(), email = String((body as any).email ?? "").trim().toLowerCase(), roleId = String((body as any).roleId ?? "");
  const departmentId = (body as any).departmentId ? String((body as any).departmentId) : null, jobTitle = (body as any).jobTitle ? String((body as any).jobTitle).trim() : null, phone = (body as any).phone ? String((body as any).phone).trim() : null;
  if (!fullName || !email || !roleId) return json({ error: "Nome, e-mail e perfil são obrigatórios.", code: "INVALID_INPUT" }, 400);
  const { data: role } = await ctx.supabaseAdmin.from("roles").select("id,key,is_active").eq("id", roleId).single();
  if (!role?.is_active || !["admin","technician","requester"].includes(role.key)) return json({ error: "Perfil de acesso inválido.", code: "INVALID_ROLE" }, 400);
  if (departmentId) { const { data: dept } = await ctx.supabaseAdmin.from("departments").select("id,is_active").eq("id", departmentId).single(); if (!dept?.is_active) return json({ error: "Setor inválido ou inativo.", code: "INVALID_DEPARTMENT" }, 400); }
  const { data: invited, error: inviteError } = await ctx.supabaseAdmin.auth.admin.inviteUserByEmail(email, { data: { full_name: fullName } });
  if (inviteError || !invited.user) return json({ error: inviteError?.message ?? "Não foi possível enviar o convite.", code: "AUTH_INVITE_FAILED" }, 400);
  const { error: profileError } = await ctx.supabaseAdmin.from("profiles").insert({ id: invited.user.id, full_name: fullName, email, job_title: jobTitle, phone, role_id: roleId, department_id: departmentId, is_active: true });
  if (profileError) { await ctx.supabaseAdmin.auth.admin.deleteUser(invited.user.id); return json({ error: "Não foi possível criar o perfil do usuário.", code: "PROFILE_CREATE_FAILED" }, 400); }
  await writeAudit(ctx.supabaseAdmin, { actorId: callerId, action: "user.created", entityType: "user", entityId: invited.user.id, metadata: { email, full_name: fullName, role_key: role.key, department_id: departmentId, job_title: jobTitle } });
  return json({ ok: true, userId: invited.user.id, email, message: "Usuário criado e convite enviado por e-mail." }, 201);
}) };
