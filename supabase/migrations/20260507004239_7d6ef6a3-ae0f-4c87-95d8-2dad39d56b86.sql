
CREATE OR REPLACE FUNCTION public.broadcast_notification(_title text, _body text, _link text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  INSERT INTO public.notifications (user_id, title, body, link)
  SELECT id, _title, _body, _link FROM public.profiles WHERE COALESCE(is_banned,false)=false;
END $$;

CREATE OR REPLACE FUNCTION public.notify_match_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE htn text; atn text;
BEGIN
  SELECT name INTO htn FROM public.teams WHERE id = NEW.home_team_id;
  SELECT name INTO atn FROM public.teams WHERE id = NEW.away_team_id;
  IF (TG_OP='INSERT') THEN
    PERFORM public.broadcast_notification('New match: '||htn||' vs '||atn,
      COALESCE(NEW.league,'')||' • Kickoff '||to_char(NEW.kickoff_time,'DD Mon HH24:MI'),
      '/match/'||NEW.id);
  ELSIF (TG_OP='UPDATE') AND OLD.status<>NEW.status THEN
    IF NEW.status='live' THEN
      PERFORM public.broadcast_notification('🔴 LIVE NOW: '||htn||' vs '||atn,'Tap to watch and bet','/match/'||NEW.id);
    ELSIF NEW.status='ended' THEN
      PERFORM public.broadcast_notification('Match ended: '||htn||' vs '||atn,
        'Final '||NEW.home_score||'–'||NEW.away_score||' • Winner: '||COALESCE(NEW.winner,'?'),
        '/match/'||NEW.id);
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_notify_match ON public.matches;
CREATE TRIGGER trg_notify_match AFTER INSERT OR UPDATE ON public.matches
FOR EACH ROW EXECUTE FUNCTION public.notify_match_change();

CREATE OR REPLACE FUNCTION public.notify_event_new()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NEW.is_active THEN PERFORM public.broadcast_notification('📣 Upcoming event: '||NEW.title, COALESCE(NEW.description,''), '/'); END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_notify_event ON public.events;
CREATE TRIGGER trg_notify_event AFTER INSERT ON public.events FOR EACH ROW EXECUTE FUNCTION public.notify_event_new();

CREATE OR REPLACE FUNCTION public.notify_announcement_new()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NEW.is_active AND NEW.title IS NOT NULL THEN PERFORM public.broadcast_notification('📢 '||NEW.title, COALESCE(NEW.description,''), COALESCE(NEW.link,'/')); END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_notify_announcement ON public.announcements;
CREATE TRIGGER trg_notify_announcement AFTER INSERT ON public.announcements FOR EACH ROW EXECUTE FUNCTION public.notify_announcement_new();

CREATE OR REPLACE FUNCTION public.notify_highlight_new()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NEW.is_active THEN PERFORM public.broadcast_notification('✨ New highlight posted', COALESCE(NEW.custom_title,'Check it out'), '/'); END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_notify_highlight ON public.live_highlights;
CREATE TRIGGER trg_notify_highlight AFTER INSERT ON public.live_highlights FOR EACH ROW EXECUTE FUNCTION public.notify_highlight_new();

CREATE OR REPLACE FUNCTION public.admin_broadcast(_title text, _body text, _link text DEFAULT '/')
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE n int;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'Admin only'; END IF;
  PERFORM public.broadcast_notification(_title, _body, _link);
  GET DIAGNOSTICS n = ROW_COUNT;
  INSERT INTO public.audit_logs (admin_id, action, target_type, metadata)
    VALUES (auth.uid(), 'broadcast.send', 'notifications', jsonb_build_object('title',_title,'body',_body));
  RETURN n;
END $$;

CREATE OR REPLACE FUNCTION public.admin_notify_user(_user_id uuid, _title text, _body text, _link text DEFAULT '/')
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'Admin only'; END IF;
  INSERT INTO public.notifications (user_id,title,body,link) VALUES (_user_id,_title,_body,_link);
  INSERT INTO public.audit_logs (admin_id, action, target_type, target_id, metadata)
    VALUES (auth.uid(), 'notify.user', 'profile', _user_id, jsonb_build_object('title',_title));
END $$;

CREATE OR REPLACE FUNCTION public.clear_my_notifications()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN DELETE FROM public.notifications WHERE user_id = auth.uid(); END $$;

CREATE OR REPLACE FUNCTION public.mark_all_notifications_read()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN UPDATE public.notifications SET read_at = now() WHERE user_id = auth.uid() AND read_at IS NULL; END $$;

CREATE OR REPLACE FUNCTION public.end_match_by_score(_match_id uuid, _home_score int, _away_score int)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE w text;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'Admin only'; END IF;
  UPDATE public.matches SET home_score=_home_score, away_score=_away_score WHERE id=_match_id;
  IF _home_score>_away_score THEN w:='home';
  ELSIF _home_score<_away_score THEN w:='away';
  ELSE w:='draw';
  END IF;
  PERFORM public.settle_match(_match_id, w);
END $$;
