
-- Withdrawal requests
CREATE TYPE withdrawal_status AS ENUM ('pending','approved','declined');

CREATE TABLE public.withdrawal_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  ingame_name text NOT NULL,
  ingame_gang text NOT NULL,
  amount numeric NOT NULL CHECK (amount > 0),
  ticket_ref text,
  status withdrawal_status NOT NULL DEFAULT 'pending',
  admin_note text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.withdrawal_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wr user select" ON public.withdrawal_requests FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "wr admin manage" ON public.withdrawal_requests FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- Leaderboard stats
ALTER TABLE public.leaderboard_factions
  ADD COLUMN IF NOT EXISTS top_player text,
  ADD COLUMN IF NOT EXISTS wins int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS losses int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS draws int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS played int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS points int NOT NULL DEFAULT 0;

ALTER TABLE public.leaderboard_players
  ADD COLUMN IF NOT EXISTS wins int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS losses int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS played int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS points int NOT NULL DEFAULT 0;

-- RPC: request withdrawal (deducts immediately)
CREATE OR REPLACE FUNCTION public.request_withdrawal(_ingame_name text, _ingame_gang text, _amount numeric, _ticket_ref text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE uid uuid := auth.uid(); bal numeric; rid uuid;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _amount IS NULL OR _amount <= 0 THEN RAISE EXCEPTION 'Invalid amount'; END IF;
  IF _ingame_name IS NULL OR length(trim(_ingame_name))=0 THEN RAISE EXCEPTION 'In-game name required'; END IF;
  IF _ingame_gang IS NULL OR length(trim(_ingame_gang))=0 THEN RAISE EXCEPTION 'In-game gang required'; END IF;
  SELECT token_balance INTO bal FROM profiles WHERE id=uid FOR UPDATE;
  IF bal < _amount THEN RAISE EXCEPTION 'Insufficient balance'; END IF;
  UPDATE profiles SET token_balance = token_balance - _amount, updated_at=now() WHERE id=uid;
  INSERT INTO withdrawal_requests(user_id, ingame_name, ingame_gang, amount, ticket_ref)
    VALUES (uid, _ingame_name, _ingame_gang, _amount, _ticket_ref) RETURNING id INTO rid;
  INSERT INTO transactions(user_id,type,amount,balance_after,reference_id,note)
    VALUES (uid,'admin_adjust',-_amount, bal - _amount, rid, 'Withdrawal request');
  INSERT INTO notifications(user_id,title,body,link)
    VALUES (uid,'Withdrawal requested','Your request is pending admin review.','/dashboard');
  RETURN rid;
END $$;

-- Approve
CREATE OR REPLACE FUNCTION public.approve_withdrawal(_id uuid, _note text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE r record; admin_uid uuid := auth.uid();
BEGIN
  IF NOT is_admin(admin_uid) THEN RAISE EXCEPTION 'Admin only'; END IF;
  SELECT * INTO r FROM withdrawal_requests WHERE id=_id FOR UPDATE;
  IF r IS NULL THEN RAISE EXCEPTION 'Not found'; END IF;
  IF r.status <> 'pending' THEN RAISE EXCEPTION 'Already reviewed'; END IF;
  UPDATE withdrawal_requests SET status='approved', admin_note=_note, reviewed_by=admin_uid, reviewed_at=now() WHERE id=_id;
  INSERT INTO notifications(user_id,title,body,link)
    VALUES (r.user_id,'Withdrawal approved', COALESCE(_note,'You will receive your withdrawal within 24hrs. Stay tuned for instructions.'),'/dashboard');
  INSERT INTO audit_logs(admin_id,action,target_type,target_id,metadata)
    VALUES (admin_uid,'withdrawal.approve','withdrawal_request',_id,jsonb_build_object('amount',r.amount,'note',_note));
END $$;

-- Decline (refund)
CREATE OR REPLACE FUNCTION public.decline_withdrawal(_id uuid, _note text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE r record; bal numeric; admin_uid uuid := auth.uid();
BEGIN
  IF NOT is_admin(admin_uid) THEN RAISE EXCEPTION 'Admin only'; END IF;
  SELECT * INTO r FROM withdrawal_requests WHERE id=_id FOR UPDATE;
  IF r IS NULL THEN RAISE EXCEPTION 'Not found'; END IF;
  IF r.status <> 'pending' THEN RAISE EXCEPTION 'Already reviewed'; END IF;
  SELECT token_balance INTO bal FROM profiles WHERE id=r.user_id FOR UPDATE;
  UPDATE profiles SET token_balance = token_balance + r.amount, updated_at=now() WHERE id=r.user_id;
  UPDATE withdrawal_requests SET status='declined', admin_note=_note, reviewed_by=admin_uid, reviewed_at=now() WHERE id=_id;
  INSERT INTO transactions(user_id,type,amount,balance_after,reference_id,note)
    VALUES (r.user_id,'admin_adjust', r.amount, bal + r.amount, _id, COALESCE(_note,'Withdrawal declined - refund'));
  INSERT INTO notifications(user_id,title,body,link)
    VALUES (r.user_id,'Withdrawal declined', COALESCE(_note,'Your withdrawal was declined and tokens were refunded.'),'/dashboard');
  INSERT INTO audit_logs(admin_id,action,target_type,target_id,metadata)
    VALUES (admin_uid,'withdrawal.decline','withdrawal_request',_id,jsonb_build_object('amount',r.amount,'note',_note));
END $$;
