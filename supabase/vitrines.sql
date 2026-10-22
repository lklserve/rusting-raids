-- A VITRINE DE CADA JOGADOR (22/10). Pedidos do Ronni do mesmo dia: "não tá aparecendo as molduras e avatar de perfil no
-- rank de magnata, e quando eu clico no perfil deles não abre", "no esquadrão não aparece o perfil deles".
--
-- O perfil de um jogador (avatar, moldura, skin vestida, arma na mão, horas, coleção) só existia DENTRO do servidor do
-- jogo, e só de quem está nele. O jogo agora conta a sua vitrine ao site (POST /api/jogo/loja/vitrine), e qualquer tela
-- pede a dos outros pelo roleId (POST /api/jogo/loja/perfis): o lobby, os Magnatas, o clã com o membro offline.
--
-- O roleId é o ID do jogador no servidor, e o site o CONFERE sem confiar no aparelho: é o hash de um jogador da própria
-- chave (Game.Core.Servidor.BilheteDoSite.IdDoJogador: SHA-256 do uuid do jogador, 8 primeiros bytes, faixa
-- 1.000.000.000 a 9.999.999.999; conferido em 22/10 contra o mapa chave → roleId da VPS: 245 de 245).
-- Uma vitrine por chave. Os dados são só visuais (como o servidor do jogo, o site não confere a coleção comprada).
-- Rodar UMA vez no SQL Editor do Supabase (idempotente).

create table if not exists public.vitrines (
  chave_id      uuid primary key references public.chaves(id) on delete cascade,
  role_id       bigint not null unique,
  dados         jsonb not null default '{}'::jsonb,   -- nome, avatar, moldura, balao, mochila, skin, arma, espera, papel, cabelo, masc, segundos, trocas
  skins         integer[] not null default '{}',      -- a coleção (à parte: os Magnatas leem os dados sem ela)
  atualizado_em timestamptz not null default now()
);
alter table public.vitrines enable row level security;
revoke all on table public.vitrines from public, anon, authenticated;
grant select, insert, update on table public.vitrines to service_role;

-- Grava a vitrine da chave (a rota já conferiu a chave e o roleId). O mesmo roleId em OUTRA chave não acontece (é o hash de
-- um jogador desta); se acontecer, recusa em vez de trocar o dono.
create or replace function public.gravar_vitrine(p_chave uuid, p_role bigint, p_dados jsonb, p_skins integer[])
returns table (ok boolean, erro text)
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.vitrines v where v.role_id = p_role and v.chave_id <> p_chave) then
    return query select false, 'Este ID é de outra chave.'::text;
    return;
  end if;
  insert into public.vitrines as v (chave_id, role_id, dados, skins, atualizado_em)
  values (p_chave, p_role, p_dados, coalesce(p_skins, '{}'), now())
  on conflict (chave_id) do update
    set role_id = excluded.role_id, dados = excluded.dados, skins = excluded.skins, atualizado_em = now();
  return query select true, null::text;
end $$;
revoke all on function public.gravar_vitrine(uuid, bigint, jsonb, integer[]) from public, anon, authenticated;
grant execute on function public.gravar_vitrine(uuid, bigint, jsonb, integer[]) to service_role;

-- As vitrines de vários roleIds, com o apelido da chave; chave banida fica de fora.
create or replace function public.vitrines_por_role(p_ids bigint[])
returns table (role_id bigint, apelido text, dados jsonb, skins integer[], atualizado_em timestamptz)
language sql stable security definer set search_path = public as $$
  select v.role_id, a.apelido, v.dados, v.skins, v.atualizado_em
  from public.vitrines v
  join public.chaves c on c.id = v.chave_id
  left join public.apelidos_da_chave a on a.chave_id = v.chave_id
  where v.role_id = any(p_ids) and c.status <> 'banida'
$$;
revoke all on function public.vitrines_por_role(bigint[]) from public, anon, authenticated;
grant execute on function public.vitrines_por_role(bigint[]) to service_role;
