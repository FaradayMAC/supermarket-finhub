## O que será entregue

Login no sistema com e-mail+senha e Google, e quatro perfis de acesso que limitam o que cada pessoa enxerga.

### Perfis e permissões

| Perfil | Vê | Edita |
|---|---|---|
| **Administrador** | Tudo + gestão de usuários | Tudo, incluindo promover/rebaixar usuários e vincular gerentes a lojas |
| **Diretoria** | Tudo (consolidado e por unidade) | Nada — somente leitura |
| **Controladoria** | Tudo | Despesas, impostos, folha, funcionários, metas, centros de custo |
| **Gerente de Unidade** | Apenas a unidade vinculada (uma loja) | Despesas, funcionários, folha e metas **da sua loja** |

### Telas novas / alteradas

1. **`/auth`** — login e cadastro (e-mail+senha + botão Google). Rota pública.
2. **Proteção das rotas existentes** — todas as páginas internas exigem login; sem login redireciona para `/auth`.
3. **`/usuarios`** — somente Admin. Lista usuários, define perfil (admin/diretoria/controladoria/gerente) e vincula gerente à loja.
4. **AppShell** — mostra nome, perfil e botão "Sair" no topo. Menus que o usuário não pode acessar ficam ocultos.
5. **Dashboard, Comparativo, Lojas, Despesas, Funcionários, Folha, Impostos, Metas** — automaticamente filtradas pela RLS: gerente só vê sua loja; demais perfis veem tudo.

### Primeiro administrador

O e-mail/username **Pauloadm** será promovido a Administrador automaticamente no primeiro login (gatilho no banco).

---

## Detalhes técnicos

### Banco

- `profiles(id, nome, email, loja_id, created_at, updated_at)` — 1×1 com `auth.users`, criada por trigger `on_auth_user_created`.
- Enum `app_role = ('admin','diretoria','controladoria','gerente')`.
- `user_roles(user_id, role)` — separada do profile (anti-escalonamento).
- Função `has_role(_user_id, _role)` SECURITY DEFINER + `current_user_loja()` SECURITY DEFINER que devolve `profiles.loja_id` do usuário logado.
- Gatilho promove username `pauloadm` (case-insensitive) a `admin` no signup.

### RLS por tabela (substitui as policies `USING (true)` atuais)

Padrão aplicado a `lojas`, `despesas`, `funcionarios`, `folha_pagamento`, `impostos`, `metas`, `centros_custo`, `movimentacoes_financeiras`, `categorias_despesa`, `empresas`:

```text
SELECT: admin OR diretoria OR controladoria
        OR (gerente AND loja_id = current_user_loja())
INSERT/UPDATE/DELETE: admin OR controladoria
        OR (gerente AND loja_id = current_user_loja())   -- só nas tabelas operacionais
```

`profiles`: cada um lê/edita o próprio; admin lê/edita todos.
`user_roles`: todos leem para resolver permissões na UI; só admin escreve.

GRANTs `authenticated` em todas as tabelas; remoção do GRANT `anon` que existia implicitamente nas policies abertas.

### Auth

- Lovable Cloud managed Google OAuth via `supabase--configure_social_auth` (`providers: ["google"]`).
- `_authenticated` layout já gerencia o gate; basta mover as rotas internas para `src/routes/_authenticated/*`.
- `src/integrations/lovable/index` para o botão Google; `supabase.auth.signInWithPassword` para e-mail/senha.
- `useAuth()` hook que devolve `{ user, role, lojaId, isAdmin, canEdit, ... }` lendo `profiles` + `user_roles`.

### Comportamento na UI

- Itens de menu condicionais (Usuários só para admin; Diretoria não vê botões "Novo/Editar/Excluir").
- Filtros de loja escondidos para gerente (já vê só a sua).
- Mutations bloqueadas no front quando `canEdit === false` (defesa em profundidade — a RLS é a fonte da verdade).

---

## O que NÃO está no escopo desta entrega

- E-mail de boas-vindas customizado, recuperação de senha (posso adicionar depois).
- Auditoria/log de quem alterou o quê.
- Permissões granulares por módulo (só os 4 perfis combinados).