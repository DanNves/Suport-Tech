import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "npm:@supabase/server";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

export default { fetch: withSupabase({ auth: "user" }, async (req, ctx) => {
  if (req.method !== "POST") return json({ error: "Método não permitido." }, 405);
  const { data: me } = await ctx.supabase.from("profiles").select("id,roles(key)").eq("id", ctx.userClaims?.sub).single();
  const myRole = Array.isArray(me?.roles) ? me.roles[0]?.key : (me?.roles as { key?: string } | null)?.key;
  if (myRole !== "admin") return json({ error: "Apenas administradores podem cadastrar usuários.", code: "PERMISSION_DENIED" }, 403);
  const body = await req.json();
  const fullName = String(body.fullName ?? "").trim(), email = String(body.email ?? "").trim().toLowerCase(), roleId = String(body.roleId ?? "");
  const departmentId = body.departmentId ? String(body.departmentId) : null, jobTitle = body.jobTitle ? String(body.jobTitle).trim() : null, phone = body.phone ? String(body.phone).trim() : null;
  if (!fullName || !email || !roleId) return json({ error: "Nome, e-mail e perfil são obrigatórios.", code: "INVALID_INPUT" }, 400);
  const { data: role } = await ctx.supabaseAdmin.from("roles").select("id,key,is_active").eq("id", roleId).single();
  if (!role?.is_active || !["admin","technician","requester"].includes(role.key)) return json({ error: "Perfil de acesso inválido.", code: "INVALID_ROLE" }, 400);
  if (departmentId) { const { data: dept } = await ctx.supabaseAdmin.from("departments").select("id,is_active").eq("id", departmentId).single(); if (!dept?.is_active) return json({ error: "Setor inválido ou inativo.", code: "INVALID_DEPARTMENT" }, 400); }
  const { data: invited, error: inviteError } = await ctx.supabaseAdmin.auth.admin.inviteUserByEmail(email, { data: { full_name: fullName } });
  if (inviteError || !invited.user) return json({ error: inviteError?.message ?? "Não foi possível enviar o convite.", code: "AUTH_INVITE_FAILED" }, 400);
  const { error: profileError } = await ctx.supabaseAdmin.from("profiles").insert({ id: invited.user.id, full_name: fullName, email, job_title: jobTitle, phone, role_id: roleId, department_id: departmentId, is_active: true });
  if (profileError) { await ctx.supabaseAdmin.auth.admin.deleteUser(invited.user.id); return json({ error: "Não foi possível criar o perfil do usuário.", code: "PROFILE_CREATE_FAILED" }, 400); }
  return json({ ok: true, userId: invited.user.id, email, message: "Usuário criado e convite enviado por e-mail." }, 201);
}) };