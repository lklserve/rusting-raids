-- =====================================================================================
-- Rusting Raids — TROCAR A CHAVE DA CONTA GOOGLE (2026-10-28)
-- O caso que trouxe isto: um jogador tinha a conta Google ligada à chave SECUNDÁRIA desde 13/10; a principal nunca foi
-- ligada. Com a entrada só pelo Google (lançamento aberto, 1.45), ele passou a cair sempre na secundária, e o "Tenho uma
-- chave" do jogo só aparece para a conta Google SEM chave. Pedido do Ronni (28/10): "quero os dois botões, mas bem feito":
--   - no PAINEL, o ADM liga a conta Google a outra chave (vendo as duas lado a lado e os aparelhos em comum);
--   - no JOGO, o próprio jogador troca, com a chave que este aparelho já usou (POST /api/conta/trocar).
--
-- A conta Google passa a abrir a chave nova; a de antes fica LIVRE (pode ser ligada a outro Google pelo "Tenho uma
-- chave"). Nada se apaga: cupons, skins e personagem continuam em cada chave. Cada troca fica no histórico
-- (contas_trocas), e o painel desfaz a última enquanto ninguém mexeu de novo.
--
-- Regras (as duas portas passam pela mesma função):
--   - a conta Google não pode estar bloqueada; a chave nova tem de existir, não estar banida e não ser de outra conta;
--   - pelo jogo: no máximo 3 trocas por conta em 7 dias (quem errou ainda volta; ninguém fica revezando chaves);
--   - a prova de dono pelo jogo (o aparelho ativado na chave nova) é da rota, que confere antes de chamar.
--
-- Rodar DEPOIS do schema.sql e do contas.sql. Só a service role chama as funções.
-- =====================================================================================

create table if not exists public.contas_trocas (
  id            uuid primary key default gen_random_uuid(),
  conta_id      uuid not null references public.contas(id) on delete cascade,
  chave_antes   uuid references public.chaves(id) on delete set null,
  chave_depois  uuid references public.chaves(id) on delete set null,
  origem        text not null check (origem in ('jogo', 'painel', 'desfazer')),
  por           text,            -- 'jogo' ou 'painel (ip)'
  motivo        text,            -- o que o ADM escreveu
  device_id     text,            -- o aparelho de onde o jogador trocou
  criado_em     timestamptz not null default now()
);
create index if not exists contas_trocas_conta_idx on public.contas_trocas (conta_id, criado_em desc);
create index if not exists contas_trocas_chaves_idx on public.contas_trocas (chave_depois, criado_em desc);

alter table public.contas_trocas enable row level security;
revoke all on table public.contas_trocas from anon, authenticated;

-- ----------------------------------------------------------------- a troca
create or replace function public.trocar_chave_da_conta(p_conta uuid, p_destino uuid, p_origem text, p_por text,
                                                        p_motivo text, p_device text)
returns json
language plpgsql security definer set search_path = public as $$
declare v contas%rowtype; v_dest chaves%rowtype; v_dono uuid; v_n int; v_troca uuid; v_antes text;
begin
  if p_conta is null or p_destino is null or p_origem is null or p_origem not in ('jogo', 'painel', 'desfazer') then
    raise exception 'dados inválidos' using errcode = '22023';
  end if;
  select * into v from contas where id = p_conta for update;
  if not found then return json_build_object('ok', false, 'erro', 'conta_inexistente'); end if;
  if v.bloqueada then return json_build_object('ok', false, 'erro', 'conta_bloqueada'); end if;

  -- A chave nova trancada: duas trocas para a mesma chave ao mesmo tempo, a segunda vê a primeira.
  select * into v_dest from chaves where id = p_destino for update;
  if not found then return json_build_object('ok', false, 'erro', 'chave_inexistente'); end if;
  if v_dest.status = 'banida' then return json_build_object('ok', false, 'erro', 'chave_banida'); end if;
  if v.chave_id is not distinct from p_destino then return json_build_object('ok', false, 'erro', 'mesma_chave'); end if;
  select id into v_dono from contas where chave_id = p_destino;
  if v_dono is not null then return json_build_object('ok', false, 'erro', 'chave_de_outra_conta'); end if;

  if p_origem = 'jogo' then
    select count(*) into v_n from contas_trocas
     where conta_id = p_conta and origem = 'jogo' and criado_em > now() - interval '7 days';
    if v_n >= 3 then return json_build_object('ok', false, 'erro', 'limite'); end if;
  end if;

  select codigo into v_antes from chaves where id = v.chave_id;
  insert into contas_trocas (conta_id, chave_antes, chave_depois, origem, por, motivo, device_id)
    values (p_conta, v.chave_id, p_destino, p_origem, left(p_por, 120), left(p_motivo, 300), left(p_device, 128))
    returning id into v_troca;
  update contas set chave_id = p_destino, vinculada_em = now() where id = p_conta returning * into v;
  return json_build_object('ok', true, 'troca', v_troca, 'conta_id', v.id, 'sessao_versao', v.sessao_versao,
                           'email', v.email, 'nome', v.nome, 'chave', v_dest.codigo, 'chave_antes', v_antes);
end $$;

-- ----------------------------------------------------------------- desfazer (painel)
-- Volta a conta à chave de antes daquela troca, se a conta ainda está na chave que a troca pôs e a de antes ainda está
-- livre. Vira uma troca nova no histórico (origem 'desfazer'), então dá para ver tudo o que aconteceu.
create or replace function public.desfazer_troca_de_chave(p_troca uuid, p_por text)
returns json
language plpgsql security definer set search_path = public as $$
declare t contas_trocas%rowtype; v_atual uuid;
begin
  if p_troca is null then raise exception 'dados inválidos' using errcode = '22023'; end if;
  select * into t from contas_trocas where id = p_troca;
  if not found then return json_build_object('ok', false, 'erro', 'troca_inexistente'); end if;
  if t.chave_antes is null then return json_build_object('ok', false, 'erro', 'sem_chave_antes'); end if;
  select chave_id into v_atual from contas where id = t.conta_id for update;
  if v_atual is distinct from t.chave_depois then return json_build_object('ok', false, 'erro', 'ja_mudou'); end if;
  return trocar_chave_da_conta(t.conta_id, t.chave_antes, 'desfazer', p_por, 'desfaz a troca de ' ||
                               to_char(t.criado_em at time zone 'America/Sao_Paulo', 'DD/MM HH24:MI'), null);
end $$;

revoke all on function public.trocar_chave_da_conta(uuid, uuid, text, text, text, text) from public, anon, authenticated;
revoke all on function public.desfazer_troca_de_chave(uuid, text)                      from public, anon, authenticated;
grant execute on function public.trocar_chave_da_conta(uuid, uuid, text, text, text, text) to service_role;
grant execute on function public.desfazer_troca_de_chave(uuid, text)                      to service_role;
