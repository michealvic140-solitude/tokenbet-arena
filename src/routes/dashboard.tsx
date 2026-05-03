import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Coins, ListChecks, Receipt, TicketCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { formatTokens } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { RoleBadge } from "@/components/RoleBadge";

export const Route = createFileRoute("/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — LomitaBet" }] }),
  beforeLoad: async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw redirect({ to: "/login" });
  },
  component: DashboardPage,
});

interface Bet { id: string; stake: number; total_odds: number; potential_payout: number; status: string; payout: number | null; created_at: string }
interface Tx { id: string; type: string; amount: number; balance_after: number; created_at: string; note: string | null }

function DashboardPage() {
  const { profile, roles } = useAuth();
  const [openBets, setOpenBets] = useState<Bet[]>([]);
  const [recentBets, setRecentBets] = useState<Bet[]>([]);
  const [txs, setTxs] = useState<Tx[]>([]);

  useEffect(() => {
    if (!profile?.id) return;
    (async () => {
      const [{ data: ob }, { data: rb }, { data: tx }] = await Promise.all([
        supabase.from("bets").select("*").eq("user_id", profile.id).eq("status", "open").order("created_at", { ascending: false }),
        supabase.from("bets").select("*").eq("user_id", profile.id).neq("status", "open").order("created_at", { ascending: false }).limit(10),
        supabase.from("transactions").select("*").eq("user_id", profile.id).order("created_at", { ascending: false }).limit(10),
      ]);
      setOpenBets((ob ?? []) as Bet[]);
      setRecentBets((rb ?? []) as Bet[]);
      setTxs((tx ?? []) as Tx[]);
    })();
  }, [profile?.id]);

  if (!profile) return <div className="p-10 text-center text-muted-foreground">Loading…</div>;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <div className="mb-6 flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-extrabold">Hi, {profile.full_name}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
            <span>{profile.email}</span>
            {roles.map((r) => <RoleBadge key={r} role={r} />)}
          </div>
        </div>
        <Link to="/tokens" className="inline-flex items-center gap-2 rounded-lg border border-primary/40 bg-card px-4 py-3 hover:border-primary">
          <Coins className="h-5 w-5 text-accent" />
          <div className="text-right">
            <div className="text-xs text-muted-foreground">Balance</div>
            <div className="text-lg font-bold tabular-nums">{formatTokens(profile.token_balance)}</div>
          </div>
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Stat icon={<ListChecks className="h-5 w-5" />} label="Open bets" value={openBets.length} />
        <Stat icon={<Receipt className="h-5 w-5" />} label="Recent settled" value={recentBets.length} />
        <Stat icon={<TicketCheck className="h-5 w-5" />} label="Transactions" value={txs.length} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <h2 className="mb-3 font-semibold">Open bets</h2>
          {openBets.length === 0 ? <Empty msg="No open bets — pick a match to bet on." />
            : <div className="space-y-2">{openBets.map((b) => <BetRow key={b.id} b={b} />)}</div>}
        </Card>
        <Card className="p-4">
          <h2 className="mb-3 font-semibold">Bet history</h2>
          {recentBets.length === 0 ? <Empty msg="No settled bets yet." />
            : <div className="space-y-2">{recentBets.map((b) => <BetRow key={b.id} b={b} />)}</div>}
        </Card>
      </div>

      <Card className="mt-4 p-4">
        <h2 className="mb-3 font-semibold">Recent transactions</h2>
        {txs.length === 0 ? <Empty msg="No transactions yet." />
          : <div className="divide-y divide-border">{txs.map((t) => (
              <div key={t.id} className="flex items-center justify-between py-2 text-sm">
                <div>
                  <div className="font-medium capitalize">{t.type.replace("_", " ")}</div>
                  <div className="text-xs text-muted-foreground">{new Date(t.created_at).toLocaleString()}</div>
                </div>
                <div className={`font-mono font-bold tabular-nums ${Number(t.amount) >= 0 ? "text-success" : "text-primary"}`}>
                  {Number(t.amount) >= 0 ? "+" : ""}{formatTokens(t.amount)}
                </div>
              </div>
            ))}</div>}
      </Card>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <Card className="flex items-center gap-3 p-4">
      <div className="rounded-md bg-secondary p-2 text-primary">{icon}</div>
      <div>
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-2xl font-bold tabular-nums">{value}</div>
      </div>
    </Card>
  );
}

function BetRow({ b }: { b: Bet }) {
  const color = b.status === "won" ? "text-success" : b.status === "lost" ? "text-primary" : b.status === "cashed_out" ? "text-accent" : "text-foreground";
  return (
    <div className="flex items-center justify-between rounded-md bg-secondary/40 p-2.5 text-sm">
      <div>
        <div className="font-medium">Stake {formatTokens(b.stake)} · @ {Number(b.total_odds).toFixed(2)}</div>
        <div className="text-xs text-muted-foreground">{new Date(b.created_at).toLocaleString()}</div>
      </div>
      <div className="text-right">
        <div className={`text-xs uppercase font-semibold ${color}`}>{b.status.replace("_"," ")}</div>
        <div className="font-mono font-bold tabular-nums">{formatTokens(b.payout ?? b.potential_payout)}</div>
      </div>
    </div>
  );
}

function Empty({ msg }: { msg: string }) {
  return <div className="py-6 text-center text-sm text-muted-foreground">{msg}</div>;
}
