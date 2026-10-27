-- =====================================================================================
-- Rusting Raids — LANÇAMENTO ABERTO (2026-10-27)
-- Pedido do Ronni: "remova a obrigatoriedade de digitar uma Key ... o único método de entrada é a conta Google ...
-- gere ou vincule um Player ID único". Escolhas dele: quem já tem chave liga uma vez (a conta Google já ligada entra
-- direto; a não ligada cola a chave antiga UMA vez); o Player ID é o número de conta que o servidor já usa (roleId).
--
-- A chave continua existindo POR BAIXO: é a conta onde moram os cupons, as skins, o passe, o ADM e o personagem do
-- servidor (rustingraids_contas.json da VPS liga a chave ao roleId). O jogador não a vê mais: a conta Google sem chave
-- ganha a sua (criar_chave_da_conta, chamada pela rota POST /api/conta/criar) e o jogo a ativa sozinho.
--
--   chaves.origem     'google' = criada pela conta (as do Pix ficam com nulo)
--   chaves.player_id  o roleId do servidor (o painel guarda quando o monitor da VPS conta quem está online; as antigas
--                     vêm do mapa da VPS de uma vez). Único quando preenchido.
--
-- Rodar DEPOIS do schema.sql e do contas.sql. Só a service role chama a função.
-- =====================================================================================

alter table public.chaves add column if not exists origem    text;
alter table public.chaves add column if not exists player_id bigint;
create unique index if not exists chaves_player_id_idx on public.chaves (player_id) where player_id is not null;

-- ----------------------------------------------------------------- a conta Google ganha a sua chave
-- p_codigo vem do gerador criptográfico da rota (api/_lib/keygen.js). Colisão do código = 23505: a rota tenta outro.
-- Pedido repetido (a conta já tem chave) devolve a mesma, sem criar outra.
create or replace function public.criar_chave_da_conta(p_conta uuid, p_codigo text)
returns json
language plpgsql security definer set search_path = public as $$
declare v contas%rowtype; v_chave uuid; v_codigo text;
begin
  if p_conta is null or p_codigo is null or p_codigo !~ '^RR-[A-Z0-9]{4}-[A-Z0-9]{4}$' then
    raise exception 'dados inválidos' using errcode = '22023';
  end if;
  select * into v from contas where id = p_conta for update;
  if not found then return json_build_object('ok', false, 'erro', 'conta_inexistente'); end if;
  if v.bloqueada then return json_build_object('ok', false, 'erro', 'conta_bloqueada'); end if;

  if v.chave_id is not null then
    select c.codigo into v_codigo from chaves c where c.id = v.chave_id;
    return json_build_object('ok', true, 'criada', false, 'conta_id', v.id, 'sessao_versao', v.sessao_versao,
                             'email', v.email, 'nome', v.nome, 'chave', v_codigo);
  end if;

  insert into chaves (codigo, email, status, origem, observacao)
    values (p_codigo, coalesce(nullif(trim(v.email), ''), 'conta-google@rustingraids'), 'ativa', 'google',
            'Criada pela conta Google (lançamento aberto)')
  returning id into v_chave;
  update contas set chave_id = v_chave, vinculada_em = now() where id = v.id returning * into v;
  return json_build_object('ok', true, 'criada', true, 'conta_id', v.id, 'sessao_versao', v.sessao_versao,
                           'email', v.email, 'nome', v.nome, 'chave', p_codigo);
end $$;

revoke all on function public.criar_chave_da_conta(uuid, text) from public, anon, authenticated;
grant execute on function public.criar_chave_da_conta(uuid, text) to service_role;
