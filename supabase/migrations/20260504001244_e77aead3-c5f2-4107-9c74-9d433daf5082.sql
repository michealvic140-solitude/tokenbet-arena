
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS country text,
  ADD COLUMN IF NOT EXISTS gang_faction text,
  ADD COLUMN IF NOT EXISTS gang_type text CHECK (gang_type IN ('G','F')) DEFAULT NULL;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, phone, discord_username, server, country, gang_faction, gang_type)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(COALESCE(NEW.email,''),'@',1)),
    NEW.email,
    NEW.raw_user_meta_data->>'phone',
    NEW.raw_user_meta_data->>'discord_username',
    COALESCE(NEW.raw_user_meta_data->>'server','LOMITA AFR'),
    NEW.raw_user_meta_data->>'country',
    NEW.raw_user_meta_data->>'gang_faction',
    NULLIF(NEW.raw_user_meta_data->>'gang_type','')
  );
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'viewer');
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS location text,
  ADD COLUMN IF NOT EXISTS bookings_locked boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS image_url text;

ALTER TABLE public.bets
  ADD COLUMN IF NOT EXISTS booking_code text UNIQUE;

CREATE OR REPLACE FUNCTION public.gen_booking_code() RETURNS text
LANGUAGE plpgsql AS $$
DECLARE c text;
BEGIN
  LOOP
    c := upper(substr(replace(gen_random_uuid()::text,'-',''),1,8));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.bets WHERE booking_code = c);
  END LOOP;
  RETURN c;
END $$;

CREATE OR REPLACE FUNCTION public.place_bet(_stake numeric, _selections jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  uid uuid := auth.uid();
  bal numeric;
  total_odds numeric := 1;
  payout numeric;
  bet_id uuid;
  sel jsonb;
  count_sel int;
  locked boolean;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _stake IS NULL OR _stake <= 0 THEN RAISE EXCEPTION 'Invalid stake'; END IF;
  count_sel := jsonb_array_length(_selections);
  IF count_sel = 0 THEN RAISE EXCEPTION 'No selections'; END IF;
  FOR sel IN SELECT * FROM jsonb_array_elements(_selections) LOOP
    SELECT bookings_locked INTO locked FROM public.matches WHERE id = (sel->>'match_id')::uuid;
    IF COALESCE(locked,false) THEN RAISE EXCEPTION 'Bookings closed for one of the selected matches'; END IF;
  END LOOP;
  SELECT token_balance INTO bal FROM public.profiles WHERE id = uid FOR UPDATE;
  IF bal < _stake THEN RAISE EXCEPTION 'Insufficient balance'; END IF;
  FOR sel IN SELECT * FROM jsonb_array_elements(_selections) LOOP
    total_odds := total_odds * (sel->>'odds_value')::numeric;
  END LOOP;
  payout := round(_stake * total_odds, 2);
  UPDATE public.profiles SET token_balance = token_balance - _stake, updated_at = now() WHERE id = uid;
  INSERT INTO public.bets (user_id, stake, total_odds, potential_payout, status, booking_code)
    VALUES (uid, _stake, round(total_odds, 4), payout, 'open', public.gen_booking_code()) RETURNING id INTO bet_id;
  FOR sel IN SELECT * FROM jsonb_array_elements(_selections) LOOP
    INSERT INTO public.bet_selections (bet_id, match_id, market, selection, odds_value)
    VALUES (bet_id, (sel->>'match_id')::uuid, sel->>'market', sel->>'selection', (sel->>'odds_value')::numeric);
  END LOOP;
  INSERT INTO public.transactions (user_id, type, amount, balance_after, reference_id, note)
    VALUES (uid, 'bet_stake', -_stake, bal - _stake, bet_id, 'Bet placed');
  RETURN bet_id;
END $$;

CREATE OR REPLACE FUNCTION public.book_by_code(_code text, _stake numeric)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE src record; sel record; arr jsonb := '[]'::jsonb;
BEGIN
  SELECT * INTO src FROM public.bets WHERE booking_code = upper(_code);
  IF src IS NULL THEN RAISE EXCEPTION 'Booking code not found'; END IF;
  FOR sel IN SELECT * FROM public.bet_selections WHERE bet_id = src.id LOOP
    arr := arr || jsonb_build_object('match_id', sel.match_id, 'market', sel.market, 'selection', sel.selection, 'odds_value', sel.odds_value);
  END LOOP;
  RETURN public.place_bet(_stake, arr);
END $$;

CREATE TABLE IF NOT EXISTS public.events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL, description text, image_url text,
  countdown_to timestamptz, is_active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "events read" ON public.events;
CREATE POLICY "events read" ON public.events FOR SELECT USING (is_active);
DROP POLICY IF EXISTS "events admin" ON public.events;
CREATE POLICY "events admin" ON public.events FOR ALL TO authenticated USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

CREATE TABLE IF NOT EXISTS public.announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text, description text, image_url text, link text,
  is_active boolean NOT NULL DEFAULT true, sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ann read" ON public.announcements;
CREATE POLICY "ann read" ON public.announcements FOR SELECT USING (is_active);
DROP POLICY IF EXISTS "ann admin" ON public.announcements;
CREATE POLICY "ann admin" ON public.announcements FOR ALL TO authenticated USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

CREATE TABLE IF NOT EXISTS public.advertisements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL, description text, image_url text, link text,
  match_id uuid, is_active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.advertisements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ad read" ON public.advertisements;
CREATE POLICY "ad read" ON public.advertisements FOR SELECT USING (is_active);
DROP POLICY IF EXISTS "ad admin" ON public.advertisements;
CREATE POLICY "ad admin" ON public.advertisements FOR ALL TO authenticated USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

CREATE TABLE IF NOT EXISTS public.leaderboard_factions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rank int NOT NULL, name text NOT NULL,
  type text NOT NULL CHECK (type IN ('G','F')),
  score numeric NOT NULL DEFAULT 0, notes text,
  week_start date NOT NULL DEFAULT date_trunc('week', now())::date,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.leaderboard_factions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "lbf read" ON public.leaderboard_factions;
CREATE POLICY "lbf read" ON public.leaderboard_factions FOR SELECT USING (true);
DROP POLICY IF EXISTS "lbf admin" ON public.leaderboard_factions;
CREATE POLICY "lbf admin" ON public.leaderboard_factions FOR ALL TO authenticated USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

CREATE TABLE IF NOT EXISTS public.leaderboard_players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rank int NOT NULL, player_name text NOT NULL,
  gang_or_faction text, gf_type text CHECK (gf_type IN ('G','F')),
  score numeric NOT NULL DEFAULT 0, player_role text,
  week_start date NOT NULL DEFAULT date_trunc('week', now())::date,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.leaderboard_players ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "lbp read" ON public.leaderboard_players;
CREATE POLICY "lbp read" ON public.leaderboard_players FOR SELECT USING (true);
DROP POLICY IF EXISTS "lbp admin" ON public.leaderboard_players;
CREATE POLICY "lbp admin" ON public.leaderboard_players FOR ALL TO authenticated USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

CREATE TABLE IF NOT EXISTS public.live_highlights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid, custom_title text, custom_subtitle text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.live_highlights ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "lh read" ON public.live_highlights;
CREATE POLICY "lh read" ON public.live_highlights FOR SELECT USING (is_active);
DROP POLICY IF EXISTS "lh admin" ON public.live_highlights;
CREATE POLICY "lh admin" ON public.live_highlights FOR ALL TO authenticated USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

CREATE TABLE IF NOT EXISTS public.ai_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid, conversation_id uuid, ticket_id uuid,
  kind text NOT NULL, model text,
  prompt_tokens int, completion_tokens int,
  prompt_preview text, response_preview text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ai_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ailog admin read" ON public.ai_logs;
CREATE POLICY "ailog admin read" ON public.ai_logs FOR SELECT TO authenticated USING (is_admin(auth.uid()));
DROP POLICY IF EXISTS "ailog insert any" ON public.ai_logs;
CREATE POLICY "ailog insert any" ON public.ai_logs FOR INSERT TO authenticated WITH CHECK (true);

ALTER TABLE public.ai_conversations
  ADD COLUMN IF NOT EXISTS ticket_id uuid,
  ADD COLUMN IF NOT EXISTS escalated boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.admin_grant_tokens(_user_id uuid, _amount numeric, _note text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE admin_uid uuid := auth.uid(); bal numeric;
BEGIN
  IF NOT public.is_admin(admin_uid) THEN RAISE EXCEPTION 'Admin only'; END IF;
  IF _amount = 0 THEN RAISE EXCEPTION 'Amount cannot be zero'; END IF;
  SELECT token_balance INTO bal FROM public.profiles WHERE id = _user_id FOR UPDATE;
  IF bal IS NULL THEN RAISE EXCEPTION 'User not found'; END IF;
  UPDATE public.profiles SET token_balance = token_balance + _amount, updated_at = now() WHERE id = _user_id;
  INSERT INTO public.transactions (user_id, type, amount, balance_after, note)
    VALUES (_user_id, CASE WHEN _amount>0 THEN 'token_grant' ELSE 'admin_adjust' END, _amount, bal + _amount, COALESCE(_note,'Admin adjustment'));
  INSERT INTO public.notifications (user_id, title, body, link)
    VALUES (_user_id, CASE WHEN _amount>0 THEN 'Tokens granted' ELSE 'Token adjustment' END, COALESCE(_note,'Admin updated your balance'), '/tokens');
  INSERT INTO public.audit_logs (admin_id, action, target_type, target_id, metadata)
    VALUES (admin_uid, 'tokens.grant', 'profile', _user_id, jsonb_build_object('amount', _amount, 'note', _note));
END $$;

CREATE OR REPLACE FUNCTION public.settle_match(_match_id uuid, _winner text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  admin_uid uuid := auth.uid();
  bet record;
  win_sel text;
  any_loss boolean;
  any_open boolean;
  payout numeric;
  bal numeric;
BEGIN
  IF NOT public.is_admin(admin_uid) THEN RAISE EXCEPTION 'Admin only'; END IF;
  IF _winner NOT IN ('home','away','draw') THEN RAISE EXCEPTION 'winner must be home|away|draw'; END IF;
  win_sel := CASE _winner WHEN 'home' THEN '1' WHEN 'draw' THEN 'X' ELSE '2' END;
  UPDATE public.matches SET status='ended', winner=_winner, ended_at=now(), bookings_locked=true WHERE id=_match_id;
  UPDATE public.bet_selections SET status =
    CASE WHEN market='1X2' AND selection=win_sel THEN 'won'
         WHEN market='1X2' THEN 'lost'
         ELSE status END
   WHERE match_id=_match_id;
  FOR bet IN SELECT b.* FROM public.bets b WHERE b.status='open' AND b.id IN (SELECT bet_id FROM public.bet_selections WHERE match_id=_match_id) LOOP
    SELECT bool_or(status='lost'), bool_or(status='open') INTO any_loss, any_open FROM public.bet_selections WHERE bet_id=bet.id;
    IF any_loss THEN
      UPDATE public.bets SET status='lost', payout=0, settled_at=now() WHERE id=bet.id;
    ELSIF NOT any_open THEN
      payout := bet.potential_payout;
      SELECT token_balance INTO bal FROM public.profiles WHERE id=bet.user_id FOR UPDATE;
      UPDATE public.profiles SET token_balance = token_balance + payout, updated_at=now() WHERE id=bet.user_id;
      UPDATE public.bets SET status='won', payout=payout, settled_at=now() WHERE id=bet.id;
      INSERT INTO public.transactions (user_id, type, amount, balance_after, reference_id, note)
        VALUES (bet.user_id, 'bet_payout', payout, bal+payout, bet.id, 'Bet won');
    END IF;
  END LOOP;
  INSERT INTO public.audit_logs (admin_id, action, target_type, target_id, metadata)
    VALUES (admin_uid, 'match.settle', 'match', _match_id, jsonb_build_object('winner', _winner));
END $$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['events','announcements','advertisements','leaderboard_factions','leaderboard_players','live_highlights','ticket_messages','support_tickets']
  LOOP
    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END LOOP;
END $$;

INSERT INTO public.chat_channels (name, type)
SELECT 'General', 'general'::chat_channel_type
WHERE NOT EXISTS (SELECT 1 FROM public.chat_channels WHERE type='general');
INSERT INTO public.chat_channels (name, type)
SELECT 'Moderators', 'moderator'::chat_channel_type
WHERE NOT EXISTS (SELECT 1 FROM public.chat_channels WHERE type='moderator');
INSERT INTO public.chat_channels (name, type)
SELECT 'Gang Leaders', 'gang'::chat_channel_type
WHERE NOT EXISTS (SELECT 1 FROM public.chat_channels WHERE type='gang');
