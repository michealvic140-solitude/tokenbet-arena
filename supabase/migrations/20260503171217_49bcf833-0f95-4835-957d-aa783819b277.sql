
-- ============ AI tables (for next phase, schema ready now) ============
CREATE TABLE public.ai_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ai_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai conv self" ON public.ai_conversations FOR ALL TO authenticated
  USING (user_id = auth.uid() OR public.is_admin(auth.uid()))
  WITH CHECK (user_id = auth.uid() OR public.is_admin(auth.uid()));

CREATE TABLE public.ai_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.ai_conversations(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user','assistant','system','tool')),
  content text,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ai_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai msg select" ON public.ai_messages FOR SELECT TO authenticated
  USING (EXISTS(SELECT 1 FROM public.ai_conversations c WHERE c.id = conversation_id AND (c.user_id = auth.uid() OR public.is_admin(auth.uid()))));
CREATE POLICY "ai msg insert" ON public.ai_messages FOR INSERT TO authenticated
  WITH CHECK (EXISTS(SELECT 1 FROM public.ai_conversations c WHERE c.id = conversation_id AND (c.user_id = auth.uid() OR public.is_admin(auth.uid()))));

CREATE TABLE public.ai_escalations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  conversation_id uuid REFERENCES public.ai_conversations(id) ON DELETE SET NULL,
  ticket_id uuid REFERENCES public.support_tickets(id) ON DELETE SET NULL,
  reason text NOT NULL,
  ai_summary text,
  ai_suggestion text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','reviewed','resolved')),
  admin_reply text,
  admin_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);
ALTER TABLE public.ai_escalations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai esc user select" ON public.ai_escalations FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_mod_or_admin(auth.uid()));
CREATE POLICY "ai esc user insert" ON public.ai_escalations FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "ai esc admin update" ON public.ai_escalations FOR UPDATE TO authenticated
  USING (public.is_mod_or_admin(auth.uid()));

ALTER PUBLICATION supabase_realtime ADD TABLE public.ai_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.ai_escalations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.token_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE public.bets;
ALTER PUBLICATION supabase_realtime ADD TABLE public.transactions;

-- ============ place_bet ============
CREATE OR REPLACE FUNCTION public.place_bet(
  _stake numeric,
  _selections jsonb  -- [{match_id, market, selection, odds_value}]
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  bal numeric;
  total_odds numeric := 1;
  payout numeric;
  bet_id uuid;
  sel jsonb;
  count_sel int;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _stake IS NULL OR _stake <= 0 THEN RAISE EXCEPTION 'Invalid stake'; END IF;
  count_sel := jsonb_array_length(_selections);
  IF count_sel = 0 THEN RAISE EXCEPTION 'No selections'; END IF;

  SELECT token_balance INTO bal FROM public.profiles WHERE id = uid FOR UPDATE;
  IF bal < _stake THEN RAISE EXCEPTION 'Insufficient balance'; END IF;

  FOR sel IN SELECT * FROM jsonb_array_elements(_selections) LOOP
    total_odds := total_odds * (sel->>'odds_value')::numeric;
  END LOOP;
  payout := round(_stake * total_odds, 2);

  UPDATE public.profiles SET token_balance = token_balance - _stake, updated_at = now() WHERE id = uid;
  INSERT INTO public.bets (user_id, stake, total_odds, potential_payout, status)
    VALUES (uid, _stake, round(total_odds, 4), payout, 'open') RETURNING id INTO bet_id;

  FOR sel IN SELECT * FROM jsonb_array_elements(_selections) LOOP
    INSERT INTO public.bet_selections (bet_id, match_id, market, selection, odds_value)
    VALUES (bet_id, (sel->>'match_id')::uuid, sel->>'market', sel->>'selection', (sel->>'odds_value')::numeric);
  END LOOP;

  INSERT INTO public.transactions (user_id, type, amount, balance_after, reference_id, note)
    VALUES (uid, 'bet_stake', -_stake, bal - _stake, bet_id, 'Bet placed');

  RETURN bet_id;
END $$;

-- ============ edit_bet ============
CREATE OR REPLACE FUNCTION public.edit_bet(
  _bet_id uuid,
  _new_stake numeric,
  _add_selections jsonb,        -- same shape
  _remove_selection_ids uuid[]
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  b record;
  bal numeric;
  total_odds numeric := 1;
  payout numeric;
  diff numeric;
  sel jsonb;
  cnt int;
BEGIN
  SELECT * INTO b FROM public.bets WHERE id = _bet_id FOR UPDATE;
  IF b IS NULL THEN RAISE EXCEPTION 'Bet not found'; END IF;
  IF b.user_id <> uid THEN RAISE EXCEPTION 'Not your bet'; END IF;
  IF b.status <> 'open' THEN RAISE EXCEPTION 'Bet is not open'; END IF;

  IF _remove_selection_ids IS NOT NULL AND array_length(_remove_selection_ids,1) > 0 THEN
    DELETE FROM public.bet_selections WHERE bet_id = _bet_id AND id = ANY(_remove_selection_ids);
  END IF;
  IF _add_selections IS NOT NULL AND jsonb_array_length(_add_selections) > 0 THEN
    FOR sel IN SELECT * FROM jsonb_array_elements(_add_selections) LOOP
      INSERT INTO public.bet_selections (bet_id, match_id, market, selection, odds_value)
      VALUES (_bet_id, (sel->>'match_id')::uuid, sel->>'market', sel->>'selection', (sel->>'odds_value')::numeric);
    END LOOP;
  END IF;

  SELECT count(*), COALESCE(exp(sum(ln(odds_value))), 1) INTO cnt, total_odds
    FROM public.bet_selections WHERE bet_id = _bet_id;
  IF cnt = 0 THEN RAISE EXCEPTION 'Bet must have at least one selection'; END IF;

  IF _new_stake IS NOT NULL AND _new_stake <> b.stake THEN
    IF _new_stake <= 0 THEN RAISE EXCEPTION 'Invalid stake'; END IF;
    diff := _new_stake - b.stake;
    SELECT token_balance INTO bal FROM public.profiles WHERE id = uid FOR UPDATE;
    IF diff > 0 AND bal < diff THEN RAISE EXCEPTION 'Insufficient balance'; END IF;
    UPDATE public.profiles SET token_balance = token_balance - diff, updated_at = now() WHERE id = uid;
    INSERT INTO public.transactions (user_id, type, amount, balance_after, reference_id, note)
      VALUES (uid, 'bet_edit', -diff, bal - diff, _bet_id, 'Bet stake adjusted');
  ELSE
    _new_stake := b.stake;
  END IF;

  payout := round(_new_stake * total_odds, 2);
  UPDATE public.bets SET stake = _new_stake, total_odds = round(total_odds,4), potential_payout = payout WHERE id = _bet_id;
END $$;

-- ============ cashout_bet (partial 0<frac<=1) ============
CREATE OR REPLACE FUNCTION public.cashout_bet(_bet_id uuid, _fraction numeric DEFAULT 1)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  b record;
  full_cashout numeric;
  pay numeric;
  bal numeric;
  new_stake numeric;
BEGIN
  IF _fraction IS NULL OR _fraction <= 0 OR _fraction > 1 THEN RAISE EXCEPTION 'Fraction must be in (0,1]'; END IF;
  SELECT * INTO b FROM public.bets WHERE id = _bet_id FOR UPDATE;
  IF b IS NULL THEN RAISE EXCEPTION 'Bet not found'; END IF;
  IF b.user_id <> uid THEN RAISE EXCEPTION 'Not your bet'; END IF;
  IF b.status <> 'open' THEN RAISE EXCEPTION 'Bet is not open'; END IF;

  -- Cashout formula: stake + (potential - stake) * 0.5
  full_cashout := round(b.stake + (b.potential_payout - b.stake) * 0.5, 2);
  pay := round(full_cashout * _fraction, 2);

  SELECT token_balance INTO bal FROM public.profiles WHERE id = uid FOR UPDATE;
  UPDATE public.profiles SET token_balance = token_balance + pay, updated_at = now() WHERE id = uid;

  IF _fraction = 1 THEN
    UPDATE public.bets SET status = 'cashed_out', cashout_amount = pay, payout = pay, settled_at = now()
      WHERE id = _bet_id;
  ELSE
    new_stake := round(b.stake * (1 - _fraction), 2);
    UPDATE public.bets
      SET stake = new_stake,
          potential_payout = round(new_stake * b.total_odds, 2),
          cashout_amount = COALESCE(cashout_amount,0) + pay
      WHERE id = _bet_id;
  END IF;

  INSERT INTO public.transactions (user_id, type, amount, balance_after, reference_id, note)
    VALUES (uid, 'cashout', pay, bal + pay, _bet_id, CASE WHEN _fraction = 1 THEN 'Full cashout' ELSE 'Partial cashout' END);
  RETURN pay;
END $$;

-- ============ approve / deny token request ============
CREATE OR REPLACE FUNCTION public.approve_token_request(_req_id uuid, _admin_note text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  admin_uid uuid := auth.uid();
  r record;
  bal numeric;
BEGIN
  IF NOT public.is_admin(admin_uid) THEN RAISE EXCEPTION 'Admin only'; END IF;
  SELECT * INTO r FROM public.token_requests WHERE id = _req_id FOR UPDATE;
  IF r IS NULL THEN RAISE EXCEPTION 'Request not found'; END IF;
  IF r.status <> 'pending' THEN RAISE EXCEPTION 'Already reviewed'; END IF;

  SELECT token_balance INTO bal FROM public.profiles WHERE id = r.user_id FOR UPDATE;
  UPDATE public.profiles SET token_balance = token_balance + r.amount, updated_at = now() WHERE id = r.user_id;
  UPDATE public.token_requests SET status = 'approved', admin_note = _admin_note, reviewed_by = admin_uid, reviewed_at = now() WHERE id = _req_id;

  INSERT INTO public.transactions (user_id, type, amount, balance_after, reference_id, note)
    VALUES (r.user_id, 'token_grant', r.amount, bal + r.amount, _req_id, COALESCE(_admin_note, 'Token request approved'));
  INSERT INTO public.notifications (user_id, title, body, link)
    VALUES (r.user_id, 'Tokens approved', 'Your token request was approved.', '/tokens');
  INSERT INTO public.audit_logs (admin_id, action, target_type, target_id, metadata)
    VALUES (admin_uid, 'token_request.approve', 'token_request', _req_id, jsonb_build_object('amount', r.amount));
END $$;

CREATE OR REPLACE FUNCTION public.deny_token_request(_req_id uuid, _admin_note text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE admin_uid uuid := auth.uid(); r record;
BEGIN
  IF NOT public.is_admin(admin_uid) THEN RAISE EXCEPTION 'Admin only'; END IF;
  SELECT * INTO r FROM public.token_requests WHERE id = _req_id FOR UPDATE;
  IF r IS NULL THEN RAISE EXCEPTION 'Request not found'; END IF;
  IF r.status <> 'pending' THEN RAISE EXCEPTION 'Already reviewed'; END IF;
  UPDATE public.token_requests SET status = 'denied', admin_note = _admin_note, reviewed_by = admin_uid, reviewed_at = now() WHERE id = _req_id;
  INSERT INTO public.notifications (user_id, title, body, link)
    VALUES (r.user_id, 'Tokens denied', COALESCE(_admin_note,'Your token request was denied.'), '/tokens');
  INSERT INTO public.audit_logs (admin_id, action, target_type, target_id, metadata)
    VALUES (admin_uid, 'token_request.deny', 'token_request', _req_id, jsonb_build_object('amount', r.amount, 'note', _admin_note));
END $$;

-- ============ Admin user creation ============
DO $$
DECLARE uid uuid;
BEGIN
  SELECT id INTO uid FROM auth.users WHERE email = 'osrpbet@gmail.com';
  IF uid IS NULL THEN
    uid := gen_random_uuid();
    INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, confirmation_token, recovery_token, email_change, email_change_token_new)
    VALUES ('00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated', 'osrpbet@gmail.com',
            crypt('Goodynessy1', gen_salt('bf')), now(), now(), now(),
            '{"provider":"email","providers":["email"]}'::jsonb,
            '{"full_name":"Shooters Admin"}'::jsonb, '', '', '', '');
    INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    VALUES (gen_random_uuid(), uid, uid::text, jsonb_build_object('sub', uid::text, 'email', 'osrpbet@gmail.com'), 'email', now(), now(), now());
  END IF;
  -- ensure profile (handle_new_user trigger should have created it, but be safe)
  INSERT INTO public.profiles (id, full_name, email, server)
    VALUES (uid, 'Shooters Admin', 'osrpbet@gmail.com', 'LOMITA AFR')
    ON CONFLICT (id) DO NOTHING;
  -- grant admin role (remove default viewer if present, add admin)
  INSERT INTO public.user_roles (user_id, role) VALUES (uid, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
END $$;
