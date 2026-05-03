
-- ============ ENUMS ============
CREATE TYPE public.app_role AS ENUM ('admin','moderator','gang_leader','shooter','registered','viewer');
CREATE TYPE public.token_request_status AS ENUM ('pending','approved','denied');
CREATE TYPE public.transaction_type AS ENUM ('grant','request_approved','bet_placed','bet_won','bet_refund','cashout','adjustment');
CREATE TYPE public.match_status AS ENUM ('upcoming','live','ended','cancelled');
CREATE TYPE public.squad_type AS ENUM ('main','sub');
CREATE TYPE public.bet_status AS ENUM ('open','won','lost','cashed_out','void');
CREATE TYPE public.chat_channel_type AS ENUM ('general','gang','moderator');
CREATE TYPE public.ticket_status AS ENUM ('open','closed','reported');

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  discord_username TEXT,
  server TEXT NOT NULL DEFAULT 'LOMITA AFR',
  token_balance NUMERIC(14,2) NOT NULL DEFAULT 0,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ============ USER ROLES ============
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  assigned_by UUID,
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND role=_role) $$;

CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND role='admin') $$;

CREATE OR REPLACE FUNCTION public.is_mod_or_admin(_user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND role IN ('admin','moderator')) $$;

-- ============ AUTO PROFILE + DEFAULT ROLE ============
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, phone, discord_username, server)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(COALESCE(NEW.email,''),'@',1)),
    NEW.email,
    NEW.raw_user_meta_data->>'phone',
    NEW.raw_user_meta_data->>'discord_username',
    COALESCE(NEW.raw_user_meta_data->>'server','LOMITA AFR')
  );
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'viewer');
  RETURN NEW;
END $$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ TOKEN REQUESTS ============
CREATE TABLE public.token_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  note TEXT,
  image_url TEXT,
  status token_request_status NOT NULL DEFAULT 'pending',
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  admin_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.token_requests ENABLE ROW LEVEL SECURITY;

-- ============ TRANSACTIONS ============
CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type transaction_type NOT NULL,
  amount NUMERIC(14,2) NOT NULL,
  balance_after NUMERIC(14,2) NOT NULL,
  reference_id UUID,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- ============ CATEGORIES ============
CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  icon TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

-- ============ TEAMS ============
CREATE TABLE public.teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  short_name TEXT,
  country TEXT,
  logo_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

-- ============ MATCHES ============
CREATE TABLE public.matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  home_team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE RESTRICT,
  away_team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE RESTRICT,
  league TEXT,
  kickoff_time TIMESTAMPTZ NOT NULL,
  status match_status NOT NULL DEFAULT 'upcoming',
  home_score INT NOT NULL DEFAULT 0,
  away_score INT NOT NULL DEFAULT 0,
  winner TEXT,
  match_minute INT,
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.match_categories (
  match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  PRIMARY KEY (match_id, category_id)
);
ALTER TABLE public.match_categories ENABLE ROW LEVEL SECURITY;

-- ============ PLAYERS / SQUADS ============
CREATE TABLE public.players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  jersey_number INT,
  position TEXT,
  squad_type squad_type NOT NULL DEFAULT 'main',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;

-- ============ ODDS ============
CREATE TABLE public.odds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  market TEXT NOT NULL,
  selection TEXT NOT NULL,
  value NUMERIC(8,2) NOT NULL CHECK (value > 1),
  is_active BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (match_id, market, selection)
);
ALTER TABLE public.odds ENABLE ROW LEVEL SECURITY;

-- ============ LIVE SCORE EVENTS ============
CREATE TABLE public.live_score_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  minute INT,
  event_type TEXT NOT NULL,
  team_id UUID REFERENCES public.teams(id),
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.live_score_events ENABLE ROW LEVEL SECURITY;

-- ============ BETS ============
CREATE TABLE public.bets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stake NUMERIC(14,2) NOT NULL CHECK (stake > 0),
  total_odds NUMERIC(10,2) NOT NULL,
  potential_payout NUMERIC(14,2) NOT NULL,
  status bet_status NOT NULL DEFAULT 'open',
  payout NUMERIC(14,2),
  cashout_amount NUMERIC(14,2),
  booking_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  settled_at TIMESTAMPTZ
);
ALTER TABLE public.bets ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.bet_selections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bet_id UUID NOT NULL REFERENCES public.bets(id) ON DELETE CASCADE,
  match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE RESTRICT,
  market TEXT NOT NULL,
  selection TEXT NOT NULL,
  odds_value NUMERIC(8,2) NOT NULL,
  status bet_status NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.bet_selections ENABLE ROW LEVEL SECURITY;

-- ============ AUDIT LOGS ============
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id UUID,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- ============ CHAT ============
CREATE TABLE public.chat_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type chat_channel_type NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.chat_channels ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID NOT NULL REFERENCES public.chat_channels(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT,
  image_url TEXT,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

INSERT INTO public.chat_channels (name, type) VALUES
  ('General','general'),('Gang','gang'),('Moderators','moderator');

-- ============ SUPPORT TICKETS ============
CREATE TABLE public.support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  status ticket_status NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at TIMESTAMPTZ
);
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.ticket_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT,
  image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.ticket_messages ENABLE ROW LEVEL SECURITY;

-- ============ NOTIFICATIONS ============
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- ============ RLS POLICIES ============

-- profiles
CREATE POLICY "profiles self select" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid() OR public.is_mod_or_admin(auth.uid()));
CREATE POLICY "profiles self update" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid());
CREATE POLICY "profiles admin all" ON public.profiles FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- user_roles
CREATE POLICY "roles read self" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_mod_or_admin(auth.uid()));
CREATE POLICY "roles admin manage" ON public.user_roles FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- token_requests
CREATE POLICY "tr user select" ON public.token_requests FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "tr user insert" ON public.token_requests FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "tr admin update" ON public.token_requests FOR UPDATE TO authenticated USING (public.is_admin(auth.uid()));

-- transactions
CREATE POLICY "tx user select" ON public.transactions FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "tx admin manage" ON public.transactions FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- categories / teams / matches / match_categories / players / odds / live_score_events: public read, admin write
CREATE POLICY "cat read" ON public.categories FOR SELECT USING (true);
CREATE POLICY "cat admin" ON public.categories FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "teams read" ON public.teams FOR SELECT USING (true);
CREATE POLICY "teams admin" ON public.teams FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "matches read" ON public.matches FOR SELECT USING (true);
CREATE POLICY "matches admin" ON public.matches FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "mc read" ON public.match_categories FOR SELECT USING (true);
CREATE POLICY "mc admin" ON public.match_categories FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "players read" ON public.players FOR SELECT USING (true);
CREATE POLICY "players admin" ON public.players FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "odds read" ON public.odds FOR SELECT USING (true);
CREATE POLICY "odds admin" ON public.odds FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "lse read" ON public.live_score_events FOR SELECT USING (true);
CREATE POLICY "lse admin" ON public.live_score_events FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- bets
CREATE POLICY "bets user select" ON public.bets FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "bets admin manage" ON public.bets FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "bs user select" ON public.bet_selections FOR SELECT TO authenticated USING (
  EXISTS(SELECT 1 FROM public.bets b WHERE b.id = bet_id AND (b.user_id = auth.uid() OR public.is_admin(auth.uid())))
);
CREATE POLICY "bs admin manage" ON public.bet_selections FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- audit
CREATE POLICY "audit admin read" ON public.audit_logs FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "audit admin insert" ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));

-- chat_channels: read by role gate
CREATE POLICY "channels read" ON public.chat_channels FOR SELECT TO authenticated USING (
  type='general'
  OR (type='gang' AND (public.has_role(auth.uid(),'gang_leader') OR public.is_mod_or_admin(auth.uid())))
  OR (type='moderator' AND public.is_mod_or_admin(auth.uid()))
);

-- chat_messages
CREATE POLICY "chat read" ON public.chat_messages FOR SELECT TO authenticated USING (
  EXISTS(SELECT 1 FROM public.chat_channels c WHERE c.id=channel_id AND (
    c.type='general'
    OR (c.type='gang' AND (public.has_role(auth.uid(),'gang_leader') OR public.is_mod_or_admin(auth.uid())))
    OR (c.type='moderator' AND public.is_mod_or_admin(auth.uid()))
  ))
);
CREATE POLICY "chat insert" ON public.chat_messages FOR INSERT TO authenticated WITH CHECK (
  user_id = auth.uid() AND
  EXISTS(SELECT 1 FROM public.chat_channels c WHERE c.id=channel_id AND (
    c.type='general'
    OR (c.type='gang' AND (public.has_role(auth.uid(),'gang_leader') OR public.is_mod_or_admin(auth.uid())))
    OR (c.type='moderator' AND public.is_mod_or_admin(auth.uid()))
  ))
);
CREATE POLICY "chat mod delete" ON public.chat_messages FOR UPDATE TO authenticated USING (public.is_mod_or_admin(auth.uid()));

-- tickets
CREATE POLICY "tk user select" ON public.support_tickets FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_mod_or_admin(auth.uid()));
CREATE POLICY "tk user insert" ON public.support_tickets FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "tk mod update" ON public.support_tickets FOR UPDATE TO authenticated USING (public.is_mod_or_admin(auth.uid()) OR user_id=auth.uid());
CREATE POLICY "tk admin delete" ON public.support_tickets FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

CREATE POLICY "tm select" ON public.ticket_messages FOR SELECT TO authenticated USING (
  EXISTS(SELECT 1 FROM public.support_tickets t WHERE t.id=ticket_id AND (t.user_id=auth.uid() OR public.is_mod_or_admin(auth.uid())))
);
CREATE POLICY "tm insert" ON public.ticket_messages FOR INSERT TO authenticated WITH CHECK (
  user_id = auth.uid() AND
  EXISTS(SELECT 1 FROM public.support_tickets t WHERE t.id=ticket_id AND (t.user_id=auth.uid() OR public.is_mod_or_admin(auth.uid())))
);

-- notifications
CREATE POLICY "notif self" ON public.notifications FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "notif update self" ON public.notifications FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "notif admin" ON public.notifications FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- ============ REALTIME ============
ALTER PUBLICATION supabase_realtime ADD TABLE public.matches;
ALTER PUBLICATION supabase_realtime ADD TABLE public.odds;
ALTER PUBLICATION supabase_realtime ADD TABLE public.live_score_events;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.ticket_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.players;

-- ============ STORAGE BUCKET ============
INSERT INTO storage.buckets (id, name, public) VALUES ('uploads','uploads', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "uploads public read" ON storage.objects FOR SELECT USING (bucket_id='uploads');
CREATE POLICY "uploads auth insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id='uploads' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "uploads owner update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id='uploads' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "uploads owner delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id='uploads' AND auth.uid()::text = (storage.foldername(name))[1]);
