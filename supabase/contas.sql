-- =====================================================================================
-- Rusting Raids — CONTA GOOGLE e PROGRESSO NA NUVEM (2026-10-12)
-- Pedido do Ronni: "Entrar com Google", ligar a conta Google à chave de acesso que o jogador já tem (RR-XXXX-XXXX)
-- e guardar o save na nuvem. A chave continua sendo o que abre o jogo; a conta Google é o jeito de recuperar a chave
-- num aparelho novo e de levar o progresso junto.
--
-- Tabelas:
--   contas              uma por conta Google (google_id = o "sub" do id_token, estável). chave_id = a licença
--                       ligada (no máximo uma conta por chave e uma chave por conta).
--   progresso_na_nuvem  o save do jogador (o rustingraids_save.json inteiro, em JSONB) com versão para não
--                       sobrescrever o que outro aparelho gravou depois.
--
-- Rodar DEPOIS do schema.sql. Só a service role acessa (RLS ligada, sem políticas, e os papéis públicos sem privilégio).
-- As funções recebem o save como TEXTO e convertem com ::jsonb aqui dentro: um inteiro de 64 bits (ticks do relógio,
-- ids) nunca passa pelo double do JavaScript, e a leitura devolve dados::text pelo mesmo motivo.
-- =====================================================================================

create extension if not exists pgcrypto;

-- ----------------------------------------------------------------- contas
create table if not exists public.contas (
  id            uuid primary key default gen_random_uuid(),
  google_id     text unique,                 -- "sub" do Google; nulo fica livre para outro provedor no futuro
  email         text,                        -- só informativo (o Google pode trocar); a identidade é o google_id
  nome          text,
  chave_id      uuid unique references public.chaves(id) on delete set null,
  sessao_versao integer not null default 1,  -- subir derruba todas as sessões desta conta (painel)
  bloqueada     boolean not null default false,
  criado_em     timestamptz not null default now(),
  ultimo_login  timestamptz,
  vinculada_em  timestamptz
);
create index if not exists contas_email_idx on public.contas (lower(email));

-- ----------------------------------------------------------------- progresso
create table if not exists public.progresso_na_nuvem (
  conta_id       uuid primary key references public.contas(id) on delete cascade,
  dados          jsonb not null,
  versao         integer not null default 1 check (versao > 0),
  tamanho        integer not null default 0,   -- caracteres do texto recebido
  disp           text,                         -- resumo do aparelho que gravou por último
  versao_do_jogo text,
  atualizado_em  timestamptz not null default now(),
  constraint progresso_e_objeto check (jsonb_typeof(dados) = 'object')
);

alter table public.contas             enable row level security;
alter table public.progresso_na_nuvem enable row level security;
revoke all on table public.contas, public.progresso_na_nuvem from anon, authenticated;

-- ----------------------------------------------------------------- entrar com Google
-- Cria a conta na primeira vez, senão atualiza e-mail/nome. Devolve o que a sessão e o jogo precisam, com a chave
-- ligada (código e situação) para o jogo recuperá-la num aparelho novo.
create or replace function public.entrar_com_google(p_google text, p_email text, p_nome text)
returns json
language plpgsql security definer set search_path = public as $$
declare v contas%rowtype; v_codigo text; v_status text;
begin
  if p_google is null or length(p_google) = 0 or length(p_google) > 255 then
    raise exception 'google_id inválido' using errcode = '22023';
  end if;
  insert into contas (google_id, email, nome, ultimo_login)
    values (p_google, p_email, p_nome, now())
  on conflict (google_id) do update
    set email = coalesce(excluded.email, contas.email),
        nome = coalesce(excluded.nome, contas.nome),
        ultimo_login = now()
  returning * into v;
  if v.chave_id is not null then
    select c.codigo, c.status into v_codigo, v_status from chaves c where c.id = v.chave_id;
  end if;
  return json_build_object('conta_id', v.id, 'sessao_versao', v.sessao_versao, 'bloqueada', v.bloqueada,
                           'email', v.email, 'nome', v.nome, 'chave', v_codigo, 'chave_status', v_status);
end $$;

-- ----------------------------------------------------------------- ligar a conta Google à chave
-- Quem chama já conferiu que o aparelho é dono da chave (autenticarJogador). Trava as duas pontas na ordem
-- chave → conta para duas ligações ao mesmo tempo entrarem em fila. Erros com código fixo; a rota escreve a frase.
create or replace function public.vincular_google(p_google text, p_email text, p_nome text, p_chave uuid)
returns json
language plpgsql security definer set search_path = public as $$
declare v_dono contas%rowtype; v contas%rowtype; v_outra text;
begin
  if p_google is null or length(p_google) = 0 or length(p_google) > 255 or p_chave is null then
    raise exception 'dados inválidos' using errcode = '22023';
  end if;
  perform 1 from chaves c where c.id = p_chave for update;
  if not found then return json_build_object('ok', false, 'erro', 'chave_inexistente'); end if;

  select * into v_dono from contas where chave_id = p_chave for update;
  select * into v from contas where google_id = p_google for update;

  -- A chave já é de OUTRA conta Google.
  if v_dono.id is not null and v_dono.google_id is distinct from p_google then
    return json_build_object('ok', false, 'erro', 'chave_de_outra_conta');
  end if;
  -- Esta conta Google já tem OUTRA chave.
  if v.id is not null and v.chave_id is not null and v.chave_id <> p_chave then
    select c.codigo into v_outra from chaves c where c.id = v.chave_id;
    return json_build_object('ok', false, 'erro', 'conta_com_outra_chave', 'chave', v_outra);
  end if;
  if v.bloqueada then return json_build_object('ok', false, 'erro', 'conta_bloqueada'); end if;

  if v.id is null then
    insert into contas (google_id, email, nome, chave_id, ultimo_login, vinculada_em)
      values (p_google, p_email, p_nome, p_chave, now(), now())
    returning * into v;
  else
    update contas set chave_id = p_chave,
                      vinculada_em = case when contas.chave_id is null then now() else contas.vinculada_em end,
                      email = coalesce(p_email, contas.email), nome = coalesce(p_nome, contas.nome),
                      ultimo_login = now()
      where contas.id = v.id
    returning * into v;
  end if;
  return json_build_object('ok', true, 'conta_id', v.id, 'sessao_versao', v.sessao_versao,
                           'email', v.email, 'nome', v.nome,
                           'chave', (select c.codigo from chaves c where c.id = p_chave));
end $$;

-- ----------------------------------------------------------------- conferir a sessão
-- A cada pedido com sessão: a conta ainda existe, a versão da sessão bate (o painel pode derrubar todas) e nem a
-- conta nem a chave ligada estão banidas.
create or replace function public.conta_da_sessao(p_conta uuid)
returns json
language sql stable security definer set search_path = public as $$
  select json_build_object('sessao_versao', c.sessao_versao, 'bloqueada', c.bloqueada,
                           'chave_status', k.status, 'chave', k.codigo)
    from contas c left join chaves k on k.id = c.chave_id
   where c.id = p_conta;
$$;

-- ----------------------------------------------------------------- gravar o progresso
-- Controle de versão otimista: o jogo manda a versão da nuvem que ele conhece (p_versao_base; 0 = "não sei de save
-- nenhum"). Se outra gravação entrou depois, devolve conflito com a versão atual e NÃO grava — a menos que o
-- jogador tenha escolhido sobrescrever (p_forcar). Sem linha ainda, grava a versão 1.
create or replace function public.gravar_progresso(p_conta uuid, p_dados text, p_versao_base integer,
                                                   p_forcar boolean, p_disp text, p_versao_jogo text)
returns json
language plpgsql security definer set search_path = public as $$
declare v_dados jsonb; v_atual int; v_quando timestamptz; v_nova int;
begin
  v_dados := p_dados::jsonb;
  if jsonb_typeof(v_dados) <> 'object' then
    raise exception 'o progresso tem de ser um objeto JSON' using errcode = '22023';
  end if;
  -- Serializa as gravações da mesma conta (cobre também a primeira, quando ainda não há linha para travar).
  perform pg_advisory_xact_lock(hashtextextended('progresso:' || p_conta::text, 0));
  select p.versao, p.atualizado_em into v_atual, v_quando from progresso_na_nuvem p where p.conta_id = p_conta;

  if v_atual is null then
    insert into progresso_na_nuvem (conta_id, dados, versao, tamanho, disp, versao_do_jogo, atualizado_em)
      values (p_conta, v_dados, 1, length(p_dados), p_disp, p_versao_jogo, now())
    returning versao, atualizado_em into v_nova, v_quando;
    return json_build_object('ok', true, 'versao', v_nova, 'atualizado_em', v_quando);
  end if;

  if not coalesce(p_forcar, false) and v_atual <> coalesce(p_versao_base, 0) then
    return json_build_object('ok', false, 'conflito', true, 'versao', v_atual, 'atualizado_em', v_quando);
  end if;

  update progresso_na_nuvem set dados = v_dados, versao = v_atual + 1, tamanho = length(p_dados),
                                disp = p_disp, versao_do_jogo = p_versao_jogo, atualizado_em = now()
   where conta_id = p_conta
  returning versao, atualizado_em into v_nova, v_quando;
  return json_build_object('ok', true, 'versao', v_nova, 'atualizado_em', v_quando);
end $$;

-- ----------------------------------------------------------------- ler o progresso
-- p_com_dados = false devolve só a versão e a data (o jogo decide sem baixar o save inteiro).
create or replace function public.ler_progresso(p_conta uuid, p_com_dados boolean)
returns json
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select json_build_object('existe', true, 'versao', p.versao, 'atualizado_em', p.atualizado_em,
                              'tamanho', p.tamanho, 'versao_do_jogo', p.versao_do_jogo,
                              'dados', case when p_com_dados then p.dados::text end)
       from progresso_na_nuvem p where p.conta_id = p_conta),
    json_build_object('existe', false));
$$;

revoke all on function public.entrar_com_google(text, text, text)                              from public, anon, authenticated;
revoke all on function public.vincular_google(text, text, text, uuid)                          from public, anon, authenticated;
revoke all on function public.conta_da_sessao(uuid)                                            from public, anon, authenticated;
revoke all on function public.gravar_progresso(uuid, text, integer, boolean, text, text)       from public, anon, authenticated;
revoke all on function public.ler_progresso(uuid, boolean)                                     from public, anon, authenticated;
grant execute on function public.entrar_com_google(text, text, text)                           to service_role;
grant execute on function public.vincular_google(text, text, text, uuid)                       to service_role;
grant execute on function public.conta_da_sessao(uuid)                                         to service_role;
grant execute on function public.gravar_progresso(uuid, text, integer, boolean, text, text)    to service_role;
grant execute on function public.ler_progresso(uuid, boolean)                                  to service_role;
