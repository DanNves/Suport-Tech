import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "npm:@supabase/server";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

export default { fetch: withSupabase({ auth: "user" }, async (req, ctx) => {
  if (req.method !== "POST") return json({ error: "Método não permitido." }, 405);
  const { data: me } = await ctx.supabase.from("profiles").select("id,roles(key)").eq("id", ctx.userClaims?.sub).single();
  const myRole = Array.isArray(me?.roles) ? me.roles[0]?.key : (me?.roles as { key?: string } | null)?.key;
  if (myRole !== "admin") return json({ error: "Apenas administradores podem alterar usuários.", code: "PERMISSION_DENIED" }, 403);
  const body = await req.json(), id = String(body.id ?? ""), fullName = String(body.fullName ?? "").trim();
  const email = body.email === undefined ? undefined : String(body.email ?? "").trim().toLowerCase(), roleId = body.roleId === undefined ? undefined : String(body.roleId ?? "");
  const departmentId = body.departmentId ? String(body.departmentId) : null, jobTitle = body.jobTitle === undefined ? undefined : (body.jobTitle ? String(body.jobTitle).trim() : null), phone = body.phone === undefined ? undefined : (body.phone ? String(body.phone).trim() : null), isActive = body.isActive === undefined ? undefined : Boolean(body.isActive);
  if (!id || !fullName) return json({ error: "Usuário e nome são obrigatórios.", code: "INVALID_INPUT" }, 400);
  if (id === ctx.userClaims?.sub && isActive === false) return json({ error: "Você não pode desativar o próprio acesso.", code: "SELF_DEACTIVATION_BLOCKED" }, 400);
  if (roleId !== undefined) { const { data: role } = await ctx.supabaseAdmin.from("roles").select("key,is_active").eq("id", roleId).single(); if (!role?.is_active || !["admin","technician","requester"].includes(role.key)) return json({ error: "Perfil de acesso inválido.", code: "INVALID_ROLE" }, 400); }
  if (departmentId) { const { data: dept } = await ctx.supabaseAdmin.from("departments").select("id,is_active").eq("id", departmentId).single(); if (!dept?.is_active) return json({ error: "Setor inválido ou inativo.", code: "INVALID_DEPARTMENT" }, 400); }
  const authUpdate: Record<string, unknown> = { user_metadata: { full_name: fullName } };
  if (email !== undefined) authUpdate.email = email;
  if (isActive !== undefined) authUpdate.ban_duration = isActive ? "none" : "876000h";
  const { error: authError } = await ctx.supabaseAdmin.auth.admin.updateUserById(id, authUpdate);
  if (authError) return json({ error: authError.message, code: "AUTH_UPDATE_FAILED" }, 400);
  const updateData: Record<string, unknown> = { full_name: fullName };
  if (email !== undefined) updateData.email = email || null; if (jobTitle !== undefined) updateData.job_title = jobTitle; if (phone !== undefined) updateData.phone = phone; if (roleId !== undefined) updateData.role_id = roleId; if (body.departmentId !== undefined) updateData.department_id = departmentId; if (isActive !== undefined) updateData.is_active = isActive;
  const { data: updated, error: profileError } = await ctx.supabaseAdmin.from("profiles").update(updateData).eq("id", id).select().single();
  if (profileError) return json({ error: "A conta foi atualizada, mas o perfil não pôde ser sincronizado.", code: "PROFILE_UPDATE_FAILED" }, 500);
  return json({ ok: true, profile: updated });
}) };