
-- Profile moderation flags
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_banned boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ban_reason text,
  ADD COLUMN IF NOT EXISTS banned_at timestamptz,
  ADD COLUMN IF NOT EXISTS is_muted boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS mute_reason text,
  ADD COLUMN IF NOT EXISTS is_restricted boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS restrict_reason text;

-- Bets: ticket code & duplicate guard
ALTER TABLE public.bets
  ADD COLUMN IF NOT EXISTS ticket_code text,
  ADD COLUMN IF NOT EXISTS selection_hash text;

CREATE UNIQUE INDEX IF NOT EXISTS bets_user_selection_open_uniq
  ON public.bets(user_id, selection_hash) WHERE status = 'open';

-- Platform settings (singleton)
CREATE TABLE IF NOT EXISTS public.platform_settings (
  id int PRIMARY KEY DEFAULT 1,
  maintenance_mode boolean NOT NULL DEFAULT false,
  maintenance_message text DEFAULT 'We are upgrading the arena. Back in a few hours.',
  max_payout numeric NOT NULL DEFAULT 60000000,
  min_stake numeric NOT NULL DEFAULT 2000000,
  max_stake numeric NOT NULL DEFAULT 20000000,
  contact_email text,
  contact_phone text,
  contact_whatsapp text,
  contact_sms text,
  about_us text,
  why_trust_us text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT singleton CHECK (id = 1)
);
INSERT INTO public.platform_settings (id) VALUES (1) ON CONFLICT DO NOTHING;
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ps read" ON public.platform_settings;
CREATE POLICY "ps read" ON public.platform_settings FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "ps admin" ON public.platform_settings;
CREATE POLICY "ps admin" ON public.platform_settings FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- Terms & Conditions sections
CREATE TABLE IF NOT EXISTS public.terms_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.terms_sections ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ts read" ON public.terms_sections;
CREATE POLICY "ts read" ON public.terms_sections FOR SELECT TO public USING (is_active);
DROP POLICY IF EXISTS "ts admin" ON public.terms_sections;
CREATE POLICY "ts admin" ON public.terms_sections FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- Promo codes
CREATE TABLE IF NOT EXISTS public.promo_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  amount numeric NOT NULL,
  max_uses int NOT NULL DEFAULT 1,
  uses int NOT NULL DEFAULT 0,
  expires_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  note text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "pc admin" ON public.promo_codes;
CREATE POLICY "pc admin" ON public.promo_codes FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE TABLE IF NOT EXISTS public.promo_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  promo_id uuid NOT NULL REFERENCES public.promo_codes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  amount numeric NOT NULL,
  redeemed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(promo_id, user_id)
);
ALTER TABLE public.promo_redemptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "pr admin" ON public.promo_redemptions;
CREATE POLICY "pr admin" ON public.promo_redemptions FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
DROP POLICY IF EXISTS "pr self read" ON public.promo_redemptions;
CREATE POLICY "pr self read" ON public.promo_redemptions FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Appeals
CREATE TABLE IF NOT EXISTS public.appeals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('ban','mute','restrict','other')),
  message text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  admin_reply text,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);
ALTER TABLE public.appeals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ap user insert" ON public.appeals;
CREATE POLICY "ap user insert" ON public.appeals FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "ap user select" ON public.appeals;
CREATE POLICY "ap user select" ON public.appeals FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_mod_or_admin(auth.uid()));
DROP POLICY IF EXISTS "ap admin update" ON public.appeals;
CREATE POLICY "ap admin update" ON public.appeals FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()));

-- Ticket code generator
CREATE OR REPLACE FUNCTION public.gen_ticket_code() RETURNS text
LANGUAGE plpgsql AS $$
DECLARE n int; c text;
BEGIN
  LOOP
    SELECT count(*)+1 INTO n FROM public.bets;
    c := 'LSL' || lpad(n::text, 4, '0') || upper(substr(md5(gen_random_uuid()::text),1,3));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.bets WHERE ticket_code = c);
  END LOOP;
  RETURN c;
END $$;

-- Replace place_bet with: payout cap, duplicate guard, ban/restrict/maintenance check, ticket code
CREATE OR REPLACE FUNCTION public.place_bet(_stake numeric, _selections jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
  bal numeric;
  total_odds numeric := 1;
  payout numeric;
  bet_id uuid;
  sel jsonb;
  count_sel int;
  locked boolean;
  prof record;
  cap numeric;
  hash text;
  s text := '';
  maint boolean;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT maintenance_mode, max_payout INTO maint, cap FROM public.platform_settings WHERE id=1;
  IF maint THEN RAISE EXCEPTION 'Platform is under maintenance'; END IF;
  SELECT * INTO prof FROM public.profiles WHERE id = uid FOR UPDATE;
  IF prof.is_banned THEN RAISE EXCEPTION 'Account banned: %', COALESCE(prof.ban_reason,''); END IF;
  IF prof.is_restricted THEN RAISE EXCEPTION 'Account restricted: %', COALESCE(prof.restrict_reason,''); END IF;
  IF _stake IS NULL OR _stake <= 0 THEN RAISE EXCEPTION 'Invalid stake'; END IF;
  count_sel := jsonb_array_length(_selections);
  IF count_sel = 0 THEN RAISE EXCEPTION 'No selections'; END IF;
  -- Build deterministic hash for duplicate detection
  FOR sel IN SELECT * FROM jsonb_array_elements(_selections) ORDER BY (value->>'match_id') LOOP
    s := s || (sel->>'match_id') || '|' || (sel->>'market') || '|' || (sel->>'selection') || ';';
  END LOOP;
  hash := md5(s);
  IF EXISTS (SELECT 1 FROM public.bets WHERE user_id = uid AND selection_hash = hash AND status = 'open') THEN
    RAISE EXCEPTION 'You already have an identical open bet';
  END IF;
  FOR sel IN SELECT * FROM jsonb_array_elements(_selections) LOOP
    SELECT bookings_locked INTO locked FROM public.matches WHERE id = (sel->>'match_id')::uuid;
    IF COALESCE(locked,false) THEN RAISE EXCEPTION 'Bookings closed for one of the selected matches'; END IF;
    total_odds := total_odds * (sel->>'odds_value')::numeric;
  END LOOP;
  bal := prof.token_balance;
  IF bal < _stake THEN RAISE EXCEPTION 'Insufficient balance'; END IF;
  payout := round(_stake * total_odds, 2);
  IF payout > cap THEN payout := cap; END IF;
  UPDATE public.profiles SET token_balance = token_balance - _stake, updated_at = now() WHERE id = uid;
  INSERT INTO public.bets (user_id, stake, total_odds, potential_payout, status, booking_code, ticket_code, selection_hash)
    VALUES (uid, _stake, round(total_odds, 4), payout, 'open', public.gen_booking_code(), public.gen_ticket_code(), hash) RETURNING id INTO bet_id;
  FOR sel IN SELECT * FROM jsonb_array_elements(_selections) LOOP
    INSERT INTO public.bet_selections (bet_id, match_id, market, selection, odds_value)
    VALUES (bet_id, (sel->>'match_id')::uuid, sel->>'market', sel->>'selection', (sel->>'odds_value')::numeric);
  END LOOP;
  INSERT INTO public.transactions (user_id, type, amount, balance_after, reference_id, note)
    VALUES (uid, 'bet_stake', -_stake, bal - _stake, bet_id, 'Bet placed');
  RETURN bet_id;
END $$;

-- Admin moderation RPCs
CREATE OR REPLACE FUNCTION public.admin_ban_user(_user_id uuid, _ban boolean, _reason text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE admin_uid uuid := auth.uid();
BEGIN
  IF NOT public.is_admin(admin_uid) THEN RAISE EXCEPTION 'Admin only'; END IF;
  UPDATE public.profiles SET is_banned=_ban, ban_reason=CASE WHEN _ban THEN _reason ELSE NULL END,
    banned_at=CASE WHEN _ban THEN now() ELSE NULL END WHERE id=_user_id;
  INSERT INTO public.notifications (user_id, title, body, link)
    VALUES (_user_id, CASE WHEN _ban THEN 'Account banned' ELSE 'Ban lifted' END,
      COALESCE(_reason, CASE WHEN _ban THEN 'Your account has been banned.' ELSE 'Welcome back.' END), '/dashboard');
  INSERT INTO public.audit_logs (admin_id, action, target_type, target_id, metadata)
    VALUES (admin_uid, CASE WHEN _ban THEN 'user.ban' ELSE 'user.unban' END, 'profile', _user_id, jsonb_build_object('reason', _reason));
END $$;

CREATE OR REPLACE FUNCTION public.admin_mute_user(_user_id uuid, _mute boolean, _reason text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE admin_uid uuid := auth.uid();
BEGIN
  IF NOT public.is_admin(admin_uid) THEN RAISE EXCEPTION 'Admin only'; END IF;
  UPDATE public.profiles SET is_muted=_mute, mute_reason=CASE WHEN _mute THEN _reason ELSE NULL END WHERE id=_user_id;
  INSERT INTO public.notifications (user_id, title, body, link)
    VALUES (_user_id, CASE WHEN _mute THEN 'You were muted' ELSE 'Mute lifted' END, COALESCE(_reason,''), '/dashboard');
  INSERT INTO public.audit_logs (admin_id, action, target_type, target_id, metadata)
    VALUES (admin_uid, CASE WHEN _mute THEN 'user.mute' ELSE 'user.unmute' END, 'profile', _user_id, jsonb_build_object('reason', _reason));
END $$;

CREATE OR REPLACE FUNCTION public.admin_restrict_user(_user_id uuid, _restrict boolean, _reason text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE admin_uid uuid := auth.uid();
BEGIN
  IF NOT public.is_admin(admin_uid) THEN RAISE EXCEPTION 'Admin only'; END IF;
  UPDATE public.profiles SET is_restricted=_restrict, restrict_reason=CASE WHEN _restrict THEN _reason ELSE NULL END WHERE id=_user_id;
  INSERT INTO public.notifications (user_id, title, body, link)
    VALUES (_user_id, CASE WHEN _restrict THEN 'Betting restricted' ELSE 'Restriction lifted' END, COALESCE(_reason,''), '/dashboard');
  INSERT INTO public.audit_logs (admin_id, action, target_type, target_id, metadata)
    VALUES (admin_uid, CASE WHEN _restrict THEN 'user.restrict' ELSE 'user.unrestrict' END, 'profile', _user_id, jsonb_build_object('reason', _reason));
END $$;

CREATE OR REPLACE FUNCTION public.admin_remove_tokens(_user_id uuid, _amount numeric, _reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE admin_uid uuid := auth.uid(); bal numeric;
BEGIN
  IF NOT public.is_admin(admin_uid) THEN RAISE EXCEPTION 'Admin only'; END IF;
  IF _amount <= 0 THEN RAISE EXCEPTION 'Amount must be positive'; END IF;
  SELECT token_balance INTO bal FROM public.profiles WHERE id=_user_id FOR UPDATE;
  IF bal IS NULL THEN RAISE EXCEPTION 'User not found'; END IF;
  IF bal < _amount THEN RAISE EXCEPTION 'User balance too low'; END IF;
  UPDATE public.profiles SET token_balance = token_balance - _amount, updated_at=now() WHERE id=_user_id;
  INSERT INTO public.transactions (user_id, type, amount, balance_after, note)
    VALUES (_user_id, 'admin_adjust', -_amount, bal - _amount, _reason);
  INSERT INTO public.notifications (user_id, title, body, link)
    VALUES (_user_id, 'Tokens removed', _reason, '/tokens');
  INSERT INTO public.audit_logs (admin_id, action, target_type, target_id, metadata)
    VALUES (admin_uid, 'tokens.remove', 'profile', _user_id, jsonb_build_object('amount', _amount, 'reason', _reason));
END $$;

CREATE OR REPLACE FUNCTION public.redeem_promo(_code text)
RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); p record; bal numeric;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO p FROM public.promo_codes WHERE code = upper(_code) FOR UPDATE;
  IF p IS NULL THEN RAISE EXCEPTION 'Invalid code'; END IF;
  IF NOT p.is_active THEN RAISE EXCEPTION 'Code disabled'; END IF;
  IF p.expires_at IS NOT NULL AND p.expires_at < now() THEN RAISE EXCEPTION 'Code expired'; END IF;
  IF p.uses >= p.max_uses THEN RAISE EXCEPTION 'Code fully redeemed'; END IF;
  IF EXISTS(SELECT 1 FROM public.promo_redemptions WHERE promo_id=p.id AND user_id=uid) THEN
    RAISE EXCEPTION 'You already redeemed this code';
  END IF;
  SELECT token_balance INTO bal FROM public.profiles WHERE id=uid FOR UPDATE;
  UPDATE public.profiles SET token_balance = token_balance + p.amount, updated_at=now() WHERE id=uid;
  UPDATE public.promo_codes SET uses = uses + 1 WHERE id = p.id;
  INSERT INTO public.promo_redemptions (promo_id, user_id, amount) VALUES (p.id, uid, p.amount);
  INSERT INTO public.transactions (user_id, type, amount, balance_after, note)
    VALUES (uid, 'token_grant', p.amount, bal + p.amount, 'Promo code: ' || p.code);
  INSERT INTO public.notifications (user_id, title, body, link)
    VALUES (uid, 'Promo redeemed', p.amount || ' tokens added', '/dashboard');
  RETURN p.amount;
END $$;

-- Mute check trigger for chat
CREATE OR REPLACE FUNCTION public.check_chat_not_muted() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF EXISTS(SELECT 1 FROM public.profiles WHERE id = NEW.user_id AND is_muted = true) THEN
    RAISE EXCEPTION 'You are muted and cannot send messages';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS chat_mute_check ON public.chat_messages;
CREATE TRIGGER chat_mute_check BEFORE INSERT ON public.chat_messages
  FOR EACH ROW EXECUTE FUNCTION public.check_chat_not_muted();

-- Seed terms
INSERT INTO public.terms_sections (category, title, body, sort_order) VALUES
('Account', 'Account Creation', 'You must provide accurate information including country, server, gang/faction. One account per person.', 1),
('Account', 'Account Management', 'Keep your credentials safe. Sharing accounts is forbidden.', 2),
('Betting', 'Placing Bets', 'Minimum stake 2,000,000. Maximum stake 20,000,000. Minimum 3 matches per ticket. Max payout is capped at 60,000,000 tokens regardless of stake/odds.', 1),
('Betting', 'No Refund Policy', 'Once a match has started, no refund is possible. All bets are final.', 2),
('Tokens', 'Token Requests', 'Tokens are virtual. Submit a request with proof. Admin approval is required.', 1),
('Tokens', 'Promo Codes', 'Promo codes can only be redeemed once per user.', 2),
('Chat', 'Texting Rules', 'No harassment, hate speech, or doxxing. Violations result in mute or ban.', 1),
('Security', 'Suspicious Activity', 'Multi-accounting, exploiting bugs, or fraud will result in permanent ban.', 1),
('Security', 'Login Tracking', 'We track logins for security. Unusual activity may temporarily lock your account.', 2)
ON CONFLICT DO NOTHING;
