import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const MODULOS = [
  "vendas","compras","despesas","caixa","titulos","conciliacao","impostos","metas",
  "indicadores","dre","comparativo","funcionarios","cargos","faltas_rh","contracheque",
  "rescisao","prestadores","lojas","usuarios",
] as const;

async function assertGestorUsuarios(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("has_module_access", {
    _user_id: userId,
    _modulo: "usuarios",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Acesso negado: sem permissão no módulo Usuários");
}

async function assertNotAdminMaster(supabaseAdmin: any, userId: string) {
  const { data } = await supabaseAdmin.from("profiles").select("admin_master").eq("id", userId).maybeSingle();
  if (data?.admin_master) throw new Error("O Admin Master não pode ser alterado ou removido");
}

async function setModulos(supabaseAdmin: any, userId: string, modulos: string[]) {
  await supabaseAdmin.from("usuario_modulos").delete().eq("usuario_id", userId);
  if (modulos.length) {
    const { error } = await supabaseAdmin
      .from("usuario_modulos")
      .insert(modulos.map((m) => ({ usuario_id: userId, modulo_id: m })));
    if (error) throw new Error(error.message);
  }
}

export const adminCreateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      email: z.string().email(),
      password: z.string().min(6),
      nome: z.string().min(1),
      modulos: z.array(z.enum(MODULOS)).default([]),
      loja_id: z.string().uuid().nullable().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertGestorUsuarios(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.nome },
    });
    if (error) throw new Error(error.message);
    const uid = created.user!.id;
    await supabaseAdmin.from("profiles").upsert({
      id: uid, email: data.email, nome: data.nome, loja_id: data.loja_id ?? null, approved: true,
    });
    await setModulos(supabaseAdmin, uid, data.modulos);
    return { ok: true, id: uid };
  });

export const adminUpdateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      userId: z.string().uuid(),
      email: z.string().email().optional(),
      nome: z.string().optional(),
      password: z.string().min(6).optional().or(z.literal("")),
      modulos: z.array(z.enum(MODULOS)).optional(),
      loja_id: z.string().uuid().nullable().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertGestorUsuarios(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.userId !== context.userId) await assertNotAdminMaster(supabaseAdmin, data.userId);
    const authUpdates: any = {};
    if (data.email) authUpdates.email = data.email;
    if (data.password) authUpdates.password = data.password;
    if (data.nome) authUpdates.user_metadata = { full_name: data.nome };
    if (Object.keys(authUpdates).length) {
      const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, authUpdates);
      if (error) throw new Error(error.message);
    }
    const profUpdates: any = {};
    if (data.email) profUpdates.email = data.email;
    if (data.nome) profUpdates.nome = data.nome;
    if (data.loja_id !== undefined) profUpdates.loja_id = data.loja_id;
    if (Object.keys(profUpdates).length) {
      const { error } = await supabaseAdmin.from("profiles").update(profUpdates).eq("id", data.userId);
      if (error) throw new Error(error.message);
    }
    if (data.modulos) await setModulos(supabaseAdmin, data.userId, data.modulos);
    return { ok: true };
  });

export const adminDeleteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ userId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertGestorUsuarios(context.supabase, context.userId);
    if (data.userId === context.userId) throw new Error("Você não pode excluir a si mesmo");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await assertNotAdminMaster(supabaseAdmin, data.userId);
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminResetPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ userId: z.string().uuid(), password: z.string().min(6) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertGestorUsuarios(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.userId !== context.userId) await assertNotAdminMaster(supabaseAdmin, data.userId);
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, { password: data.password });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminSetApproved = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ userId: z.string().uuid(), approved: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertGestorUsuarios(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await assertNotAdminMaster(supabaseAdmin, data.userId);
    const { error } = await supabaseAdmin.from("profiles").update({ approved: data.approved }).eq("id", data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
