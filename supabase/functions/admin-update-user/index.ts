import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "npm:@supabase/server";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

export default {
  fetch: withSupabase({ auth: "user" }, async (req, ctx) => {
    if (req.method !== "POST") return json({ error: "Método não permitido." }, 405);

    // @supabase/server exposes the verified user identity as userClaims.id.
    // Keep jwtClaims.sub as a compatibility fallback for older claim shapes.
    const callerId = ctx.userClaims?.id ?? ctx.jwtClaims?.sub;
    if (!callerId) return json({ error: "Sessão inválida.", code: "UNAUTHENTICATED" }, 401);

    const { data: me, error: meError } = await ctx.supabaseAdmin
      .from("profiles")
      .select("id,is_active,role_id,roles(key,is_active)")
      .eq("id", callerId)
      .maybeSingle();

    const callerRole = Array.isArray(me?.roles) ? me.roles[0] : me?.roles;

    if (meError) {
      return json({ error: "Não foi possível validar suas permissões.", code: "PROFILE_LOOKUP_FAILED" }, 500);
    }

    if (!me || !me.is_active || !callerRole?.is_active || callerRole.key !== "admin") {
      return json({ error: "Apenas administradores ativos podem alterar usuários.", code: "PERMISSION_DENIED" }, 403);
    }

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return json({ error: "Corpo da requisição inválido.", code: "INVALID_JSON" }, 400);
    }

    const id = String(body.id ?? "").trim();
    const fullName = String(body.fullName ?? "").trim();
    const email = body.email === undefined ? undefined : String(body.email ?? "").trim().toLowerCase();
    const roleId = body.roleId === undefined ? undefined : String(body.roleId ?? "");
    const departmentId = body.departmentId ? String(body.departmentId) : null;
    const jobTitle = body.jobTitle === undefined ? undefined : (body.jobTitle ? String(body.jobTitle).trim() : null);
    const phone = body.phone === undefined ? undefined : (body.phone ? String(body.phone).trim() : null);
    const isActive = body.isActive === undefined ? undefined : Boolean(body.isActive);

    if (!id || !fullName) return json({ error: "Usuário e nome são obrigatórios.", code: "INVALID_INPUT" }, 400);
    if (id === callerId && isActive === false) {
      return json({ error: "Você não pode desativar o próprio acesso.", code: "SELF_DEACTIVATION_BLOCKED" }, 400);
    }

    let roleKey: string | undefined;

    if (roleId !== undefined) {
      const { data: accessRole } = await ctx.supabaseAdmin
        .from("roles")
        .select("id,key,is_active")
        .eq("id", roleId)
        .single();

      if (!accessRole?.is_active || !["admin", "technician", "requester"].includes(accessRole.key)) {
        return json({ error: "Perfil de acesso inválido.", code: "INVALID_ROLE" }, 400);
      }
      roleKey = accessRole.key;
    }

    if (departmentId) {
      const { data: dept } = await ctx.supabaseAdmin
        .from("departments")
        .select("id,is_active")
        .eq("id", departmentId)
        .single();

      if (!dept?.is_active) {
        return json({ error: "Setor inválido ou inativo.", code: "INVALID_DEPARTMENT" }, 400);
      }
    }

    const authUpdate: Record<string, unknown> = { user_metadata: { full_name: fullName } };
    if (email !== undefined) authUpdate.email = email;
    if (isActive !== undefined) authUpdate.ban_duration = isActive ? "none" : "876000h";

    const { error: authError } = await ctx.supabaseAdmin.auth.admin.updateUserById(id, authUpdate);
    if (authError) return json({ error: authError.message, code: "AUTH_UPDATE_FAILED" }, 400);

    const updateData: Record<string, unknown> = { full_name: fullName };
    if (email !== undefined) updateData.email = email || null;
    if (jobTitle !== undefined) updateData.job_title = jobTitle;
    if (phone !== undefined) updateData.phone = phone;
    if (roleId !== undefined) updateData.role_id = roleId;
    if (body.departmentId !== undefined) updateData.department_id = departmentId;
    if (isActive !== undefined) updateData.is_active = isActive;

    const { data: updated, error: profileError } = await ctx.supabaseAdmin
      .from("profiles")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (profileError) {
      return json({
        error: "A conta foi atualizada, mas o perfil não pôde ser sincronizado.",
        code: "PROFILE_UPDATE_FAILED"
      }, 500);
    }

    const { error: auditError } = await ctx.supabaseAdmin.from("audit_log").insert({
      actor_id: callerId,
      action: "user_updated",
      entity_type: "user",
      entity_id: id,
      metadata: {
        changed_fields: Object.keys(updateData).filter((key) => key !== "full_name"),
        email_domain: email ? email.split("@")[1] ?? null : undefined,
        role: roleKey ?? undefined,
        department_id: body.departmentId !== undefined ? departmentId : undefined,
        is_active: isActive,
      }
    });

    if (auditError) console.error("Audit log failed after user update:", auditError.message);

    return json({ ok: true, profile: updated });
  }),
};