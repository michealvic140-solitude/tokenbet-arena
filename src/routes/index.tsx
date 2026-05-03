import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Flame, Trophy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Countdown } from "@/components/Countdown";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "LomitaBet — Sports Betting with Virtual Tokens" },
      { name: "description", content: "Browse upcoming and live matches. Bet using virtual tokens. Cashout anytime." },
    ],
  }),
  component: HomePage,
});

interface Category { id: string; name: string; slug: string }
interface Match {
  id: string;
  league: string | null;
  kickoff_time: string;
  status: "upcoming" | "live" | "ended" | "cancelled";
  home_score: number;
  away_score: number;
  match_minute: number | null;
  home_team: { name: string; short_name: string | null };
  away_team: { name: string; short_name: string | null };
}
interface Odd { match_id: string; market: string; selection: string; value: number }

function HomePage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeCat, setActiveCat] = useState<string>("popular");
  const [matches, setMatches] = useState<Match[]>([]);
  const [odds, setOdds] = useState<Odd[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from("categories").select("*").order("sort_order").then(({ data }) => {
      setCategories((data ?? []) as Category[]);
    });
  }, []);

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
      } else {
        setOdds([]);
      }
      setLoading(false);
    })();
  }, [activeCat, categories]);

  // realtime odds
  useEffect(() => {
    const ch = supabase.channel("odds-feed").on("postgres_changes", { event: "*", schema: "public", table: "odds" }, () => {
      // refresh odds for current matches
      const ids = matches.map((m) => m.id);
      if (!ids.length) return;
      supabase.from("odds").select("match_id, market, selection, value").in("match_id", ids).eq("is_active", true).then(({ data }) => setOdds((data ?? []) as Odd[]));
    }).subscribe();
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
      <section className="mb-6 overflow-hidden rounded-xl border border-border" style={{ background: "var(--gradient-primary)" }}>
        <div className="flex items-center gap-4 px-6 py-5">
          <Trophy className="h-10 w-10 text-primary-foreground" />
          <div className="flex-1">
            <h1 className="text-2xl font-extrabold text-primary-foreground">Bet smart. Win tokens.</h1>
            <p className="text-sm text-primary-foreground/80">Live odds, instant cashout, no real money — powered by virtual tokens.</p>
          </div>
          <Link to="/tokens" className="hidden rounded-md bg-background/20 px-4 py-2 text-sm font-semibold text-primary-foreground backdrop-blur hover:bg-background/30 sm:block">Get tokens</Link>
        </div>
      </section>

      {/* Category tabs */}
      <div className="mb-4 flex gap-2 overflow-x-auto pb-2">
        {categories.map((c) => (
          <button key={c.id} onClick={() => setActiveCat(c.slug)}
            className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition ${
              activeCat === c.slug ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"
            }`}>
            {c.slug === "popular" && <Flame className="mr-1 inline h-3.5 w-3.5" />}
            {c.name}
          </button>
        ))}
      </div>

      {/* Matches */}
      {loading ? (
        <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => (<div key={i} className="h-20 animate-pulse rounded-lg bg-card" />))}</div>
      ) : matches.length === 0 ? (
        <Card className="p-10 text-center text-muted-foreground">No matches in this category yet.</Card>
      ) : (
        <div className="space-y-2">
          {matches.map((m) => <MatchRow key={m.id} m={m} odds={oddsByMatch[m.id] ?? {}} />)}
        </div>
      )}
    </div>
  );
}

function MatchRow({ m, odds }: { m: Match; odds: Record<string, number> }) {
  const isLive = m.status === "live";
  return (
    <Link to="/match/$id" params={{ id: m.id }} className="block">
      <Card className="p-3 transition hover:border-primary/60 hover:shadow-[var(--shadow-elegant)]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className="w-20 shrink-0 text-xs text-muted-foreground">
              {m.league && <div className="truncate font-medium text-foreground/80">{m.league}</div>}
              {isLive ? (
                <div className="mt-0.5 flex items-center gap-1">
                  <span className="live-dot inline-block h-1.5 w-1.5 rounded-full bg-live" />
                  <span className="font-semibold text-live">{m.match_minute ?? 0}'</span>
                </div>
              ) : (
                <Countdown to={m.kickoff_time} compact />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <Row label={m.home_team?.name ?? "Home"} score={isLive ? m.home_score : undefined} />
              <Row label={m.away_team?.name ?? "Away"} score={isLive ? m.away_score : undefined} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-1.5 sm:w-72">
            <OddBox label="1" value={odds["1"]} />
            <OddBox label="X" value={odds["X"]} />
            <OddBox label="2" value={odds["2"]} />
          </div>
        </div>
      </Card>
    </Link>
  );
}

function Row({ label, score }: { label: string; score?: number }) {
  return (
    <div className="flex items-center justify-between gap-2 py-0.5 text-sm">
      <span className="truncate font-medium">{label}</span>
      {typeof score === "number" && <span className="font-mono font-bold tabular-nums text-live">{score}</span>}
    </div>
  );
}

function OddBox({ label, value }: { label: string; value?: number }) {
  return (
    <div className="flex items-center justify-between rounded-md bg-secondary px-2.5 py-2 text-sm hover:bg-primary/20">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono font-semibold tabular-nums">{value?.toFixed(2) ?? "—"}</span>
    </div>
  );
}
