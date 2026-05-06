import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Flame, Trophy, Sparkles, TrendingUp, Megaphone, Users, Crown, Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Countdown } from "@/components/Countdown";
import { useBetSlip } from "@/lib/betslip";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "LOMITA SHOOTERS LEAGUE — Luxury Virtual Token Betting" },
      { name: "description", content: "Bet on gang vs faction matches with virtual tokens. Live odds, leaderboards, instant cashout." },
    ],
  }),
  component: HomePage,
});

interface Category { id: string; name: string; slug: string }
interface Match {
  id: string; league: string | null; kickoff_time: string;
  status: "upcoming" | "live" | "ended" | "cancelled";
  home_score: number; away_score: number; match_minute: number | null;
  home_team: { name: string; short_name: string | null };
  away_team: { name: string; short_name: string | null };
}
interface Odd { match_id: string; market: string; selection: string; value: number }
interface Evt { id: string; title: string; description: string | null; image_url: string | null; countdown_to: string | null }
interface Ann { id: string; title: string | null; description: string | null; image_url: string | null; link: string | null }
interface LBF { id: string; rank: number; name: string; type: string; score: number }
interface LBP { id: string; rank: number; player_name: string; gang_or_faction: string | null; gf_type: string | null; player_role: string | null; score: number }

function HomePage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeCat, setActiveCat] = useState<string>("popular");
  const [matches, setMatches] = useState<Match[]>([]);
  const [odds, setOdds] = useState<Odd[]>([]);
  const [events, setEvents] = useState<Evt[]>([]);
  const [anns, setAnns] = useState<Ann[]>([]);
  const [lbf, setLbf] = useState<LBF[]>([]);
  const [lbp, setLbp] = useState<LBP[]>([]);
  const [annIdx, setAnnIdx] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      supabase.from("categories").select("*").order("sort_order"),
      supabase.from("events").select("*").eq("is_active", true).order("sort_order"),
      supabase.from("announcements").select("*").eq("is_active", true).order("sort_order"),
      supabase.from("leaderboard_factions").select("*").order("rank").limit(5),
      supabase.from("leaderboard_players").select("*").order("rank").limit(10),
    ]).then(([c, e, a, f, p]) => {
      setCategories((c.data ?? []) as Category[]);
      setEvents((e.data ?? []) as Evt[]);
      setAnns((a.data ?? []) as Ann[]);
      setLbf((f.data ?? []) as LBF[]);
      setLbp((p.data ?? []) as LBP[]);
    });
  }, []);

  // Auto-rotate announcements
  useEffect(() => {
    if (anns.length < 2) return;
    const t = setInterval(() => setAnnIdx((i) => (i + 1) % anns.length), 5000);
    return () => clearInterval(t);
  }, [anns.length]);

  useEffect(() => {
    setLoading(true);
    (async () => {
      const cat = categories.find((c) => c.slug === activeCat);
      let q = supabase
        .from("matches")
        .select("id, league, kickoff_time, status, home_score, away_score, match_minute, home_team:teams!matches_home_team_id_fkey(name,short_name), away_team:teams!matches_away_team_id_fkey(name,short_name), match_categories!inner(category_id)")
        .order("kickoff_time", { ascending: true })
        .in("status", ["upcoming", "live"]);
      if (cat) q = q.eq("match_categories.category_id", cat.id);
      const { data: ms } = await q;
      const list = (ms ?? []) as unknown as Match[];
      setMatches(list);
      if (list.length) {
        const ids = list.map((m) => m.id);
        const { data: os } = await supabase.from("odds").select("match_id, market, selection, value").in("match_id", ids).eq("is_active", true);
        setOdds((os ?? []) as Odd[]);
      } else setOdds([]);
      setLoading(false);
    })();
  }, [activeCat, categories]);

  useEffect(() => {
    const ch = supabase.channel("home-feed")
      .on("postgres_changes", { event: "*", schema: "public", table: "odds" }, () => {
        const ids = matches.map((m) => m.id);
        if (!ids.length) return;
        supabase.from("odds").select("match_id, market, selection, value").in("match_id", ids).eq("is_active", true).then(({ data }) => setOdds((data ?? []) as Odd[]));
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "matches" }, () => { /* could refresh */ })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [matches]);

  const oddsByMatch = useMemo(() => {
    const map: Record<string, Record<string, number>> = {};
    for (const o of odds) {
      if (o.market !== "1X2") continue;
      map[o.match_id] = map[o.match_id] || {};
      map[o.match_id][o.selection] = Number(o.value);
    }
    return map;
  }, [odds]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      {/* Hero */}
      <section className="mb-6 overflow-hidden rounded-2xl glass-strong relative">
        <div className="absolute -top-16 -right-16 h-64 w-64 rounded-full bg-primary/20 blur-3xl float-y" />
        <div className="absolute -bottom-20 -left-10 h-72 w-72 rounded-full bg-accent/15 blur-3xl float-y" style={{ animationDelay: "1.5s" }} />
        <div className="relative grid gap-4 px-6 py-8 sm:grid-cols-[1fr_auto] sm:items-center sm:px-10 sm:py-12">
          <div>
            <div className="mb-3 inline-flex items-center gap-1.5 rounded-full glass-gold px-3 py-1 text-xs font-bold uppercase tracking-wider text-gold">
              <Sparkles className="h-3 w-3" /> Luxury edition
            </div>
            <h1 className="text-3xl font-black leading-tight sm:text-5xl">
              <span className="brand">LOMITA</span> <span className="text-primary">SHOOTERS</span> <span className="brand">LEAGUE</span>
            </h1>
            <p className="mt-3 max-w-lg text-sm text-muted-foreground sm:text-base">
              Gang vs Faction. Virtual tokens. Real glory. Place bets, climb leaderboards, and become a legend in the league.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Link to="/tokens" className="rounded-lg bg-gold-gradient px-5 py-2.5 text-sm font-bold text-accent-foreground shadow-[var(--shadow-gold)] transition hover:scale-[1.03]">Get tokens</Link>
              <Link to="/live" className="rounded-lg glass px-5 py-2.5 text-sm font-bold transition hover:bg-white/10">
                <span className="live-dot mr-2 inline-block h-2 w-2 rounded-full bg-live align-middle" /> Live now
              </Link>
            </div>
          </div>
          <Trophy className="hidden h-32 w-32 text-accent/40 sm:block float-y" />
        </div>
      </section>

      {/* Announcements */}
      {anns.length > 0 && (
        <section className="mb-6 overflow-hidden rounded-2xl glass-gold relative h-32 sm:h-36">
          {anns.map((a, i) => (
            <div key={a.id} className={`absolute inset-0 flex items-center gap-4 px-5 py-4 transition-all duration-700 ${i === annIdx ? "opacity-100 translate-x-0" : "opacity-0 translate-x-8 pointer-events-none"}`}>
              {a.image_url && <img src={a.image_url} alt="" className="h-20 w-20 rounded-xl object-cover ring-2 ring-accent/40" />}
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-gold"><Megaphone className="h-3 w-3" /> Announcement</div>
                <h3 className="font-black text-foreground truncate">{a.title}</h3>
                {a.description && <p className="text-xs text-muted-foreground line-clamp-2">{a.description}</p>}
              </div>
            </div>
          ))}
          <div className="absolute bottom-2 right-3 flex gap-1">
            {anns.map((_, i) => <span key={i} className={`h-1.5 rounded-full transition-all ${i === annIdx ? "w-6 bg-accent" : "w-1.5 bg-white/30"}`} />)}
          </div>
        </section>
      )}

      {/* Events */}
      {events.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">
            <Calendar className="h-4 w-4 text-accent" /> Upcoming Events
          </h2>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {events.map((e) => (
              <div key={e.id} className="shrink-0 w-72 glass-strong rounded-2xl overflow-hidden hover:scale-[1.02] transition">
                {e.image_url ? (
                  <img src={e.image_url} alt={e.title} className="h-32 w-full object-cover" />
                ) : (
                  <div className="h-32 bg-gold-gradient flex items-center justify-center"><Trophy className="h-12 w-12 text-accent-foreground/60" /></div>
                )}
                <div className="p-4">
                  <h3 className="font-black truncate">{e.title}</h3>
                  {e.description && <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{e.description}</p>}
                  {e.countdown_to && <div className="mt-2"><Countdown to={e.countdown_to} /></div>}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Category tabs */}
      <div className="mb-4 flex gap-2 overflow-x-auto pb-2">
        {categories.map((c) => (
          <button key={c.id} onClick={() => setActiveCat(c.slug)}
            className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-semibold transition ${activeCat === c.slug ? "bg-gold-gradient text-accent-foreground shadow-[var(--shadow-gold)]" : "glass text-muted-foreground hover:text-foreground"}`}>
            {c.slug === "popular" && <Flame className="mr-1 inline h-3.5 w-3.5" />}
            {c.name}
          </button>
        ))}
      </div>

      <h2 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">
        <TrendingUp className="h-4 w-4 text-primary" /> Today's matches
      </h2>

      {loading ? (
        <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => (<div key={i} className="h-24 animate-pulse rounded-xl glass" />))}</div>
      ) : matches.length === 0 ? (
        <div className="glass rounded-2xl p-10 text-center text-muted-foreground">No matches yet — check back soon.</div>
      ) : (
        <div className="space-y-2">
          {matches.map((m, i) => <MatchRow key={m.id} m={m} odds={oddsByMatch[m.id] ?? {}} delay={i * 30} />)}
        </div>
      )}

      {/* Leaderboards */}
      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        <Leaderboard title="Top Factions / Gangs" icon={<Users className="h-4 w-4 text-accent" />} rows={lbf.map((r) => ({ rank: r.rank, name: r.name, sub: r.type, score: r.score }))} />
        <Leaderboard title="Best Shooters" icon={<Crown className="h-4 w-4 text-accent" />} rows={lbp.map((r) => ({ rank: r.rank, name: r.player_name, sub: `${r.gang_or_faction ?? "—"} (${r.gf_type ?? "?"})`, role: r.player_role, score: r.score }))} />
      </div>

      {/* Footer */}
      <Footer />
    </div>
  );
}

function Leaderboard({ title, icon, rows }: { title: string; icon: React.ReactNode; rows: { rank: number; name: string; sub: string; role?: string | null; score: number }[] }) {
  return (
    <div className="glass-strong rounded-2xl p-4">
      <h3 className="mb-3 flex items-center gap-2 font-bold">{icon} {title}</h3>
      {rows.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">Leaderboard updates weekly</p> :
        <div className="divide-y divide-white/5">
          {rows.map((r) => (
            <div key={r.rank} className="flex items-center gap-3 py-2">
              <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-black ${r.rank === 1 ? "bg-gold-gradient text-accent-foreground" : r.rank === 2 ? "bg-white/20 text-white" : r.rank === 3 ? "bg-amber-700/40 text-amber-200" : "bg-white/5 text-muted-foreground"}`}>
                {r.rank}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold truncate">{r.name}</div>
                <div className="text-xs text-muted-foreground truncate">{r.sub}{r.role && ` · ${r.role}`}</div>
              </div>
              <div className="font-mono font-black tabular-nums text-gold">{r.score.toLocaleString()}</div>
            </div>
          ))}
        </div>}
    </div>
  );
}

function Footer() {
  const [info, setInfo] = useState<{ about_us?: string; why_trust_us?: string; contact_email?: string; contact_phone?: string; contact_whatsapp?: string } | null>(null);
  useEffect(() => {
    supabase.from("platform_settings").select("about_us, why_trust_us, contact_email, contact_phone, contact_whatsapp").eq("id", 1).maybeSingle().then(({ data }) => setInfo(data));
  }, []);
  return (
    <footer className="mt-10 grid gap-4 rounded-2xl glass-strong p-6 md:grid-cols-3">
      <div>
        <h4 className="mb-2 font-black brand">About Us</h4>
        <p className="text-xs text-muted-foreground leading-relaxed">{info?.about_us ?? "LOMITA SHOOTERS LEAGUE — virtual-token gang vs faction betting league."}</p>
      </div>
      <div>
        <h4 className="mb-2 font-black brand">Why Trust Us</h4>
        <p className="text-xs text-muted-foreground leading-relaxed">{info?.why_trust_us ?? "Manual admin oversight, transparent audit logs, instant cashouts."}</p>
      </div>
      <div>
        <h4 className="mb-2 font-black brand">Contact</h4>
        <ul className="space-y-1 text-xs text-muted-foreground">
          {info?.contact_email && <li>📧 <a href={`mailto:${info.contact_email}`} className="hover:text-gold">{info.contact_email}</a></li>}
          {info?.contact_phone && <li>📞 {info.contact_phone}</li>}
          {info?.contact_whatsapp && <li>💬 WhatsApp: {info.contact_whatsapp}</li>}
          <li><Link to="/terms" className="hover:text-gold">Terms & Conditions</Link></li>
        </ul>
      </div>
    </footer>
  );
}

function MatchRow({ m, odds, delay }: { m: Match; odds: Record<string, number>; delay: number }) {
  const isLive = m.status === "live";
  const matchLabel = `${m.home_team?.name ?? "Home"} vs ${m.away_team?.name ?? "Away"}`;
  return (
    <div className="rise-in glass rounded-xl p-3 transition hover:border-primary/40 hover:shadow-[var(--shadow-elegant)]" style={{ animationDelay: `${delay}ms` }}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Link to="/match/$id" params={{ id: m.id }} className="flex min-w-0 flex-1 items-center gap-3">
          <div className="w-20 shrink-0 text-xs text-muted-foreground">
            {m.league && <div className="truncate font-semibold text-foreground/80">{m.league}</div>}
            {isLive ? (
              <div className="mt-0.5 flex items-center gap-1">
                <span className="live-dot inline-block h-1.5 w-1.5 rounded-full bg-live" />
                <span className="font-bold text-live">{m.match_minute ?? 0}'</span>
              </div>
            ) : (
              <Countdown to={m.kickoff_time} compact />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <Row label={m.home_team?.name ?? "Home"} score={isLive ? m.home_score : undefined} />
            <Row label={m.away_team?.name ?? "Away"} score={isLive ? m.away_score : undefined} />
          </div>
        </Link>
        <div className="grid grid-cols-3 gap-1.5 sm:w-72">
          <OddBox match_id={m.id} match_label={matchLabel} market="1X2" selection="1" value={odds["1"]} />
          <OddBox match_id={m.id} match_label={matchLabel} market="1X2" selection="X" value={odds["X"]} />
          <OddBox match_id={m.id} match_label={matchLabel} market="1X2" selection="2" value={odds["2"]} />
        </div>
      </div>
    </div>
  );
}

function Row({ label, score }: { label: string; score?: number }) {
  return (
    <div className="flex items-center justify-between gap-2 py-0.5 text-sm">
      <span className="truncate font-semibold">{label}</span>
      {typeof score === "number" && <span className="font-mono font-extrabold tabular-nums text-live">{score}</span>}
    </div>
  );
}

function OddBox({ match_id, match_label, market, selection, value }: { match_id: string; match_label: string; market: string; selection: string; value?: number }) {
  const { add, has, remove } = useBetSlip();
  const active = value != null && has(match_id, market, selection);
  const onClick = () => {
    if (value == null) return;
    if (active) remove(match_id, market);
    else add({ match_id, match_label, market, selection, odds_value: value });
  };
  return (
    <button onClick={onClick} disabled={value == null}
      className={`flex items-center justify-between rounded-lg px-2.5 py-2 text-sm transition disabled:opacity-50 ${active ? "bg-gold-gradient text-accent-foreground shadow-[var(--shadow-gold)]" : "glass hover:bg-primary/10 hover:border-primary/40"}`}>
      <span className={active ? "font-bold" : "text-muted-foreground"}>{selection}</span>
      <span className="font-mono font-bold tabular-nums">{value?.toFixed(2) ?? "—"}</span>
    </button>
  );
}
