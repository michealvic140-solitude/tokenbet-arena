import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Shield, Coins, Users, Layers, Trophy, Calculator, ScrollText, Check, X,
  Megaphone, CalendarClock, Gift, Settings as SettingsIcon, FileText, Sparkles,
  Bot, BarChart3, Image as ImageIcon, MessageSquareWarning, Crown, ArrowDownToLine, LifeBuoy,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { formatTokens } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip as RTooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Admin — LOMITA SHOOTERS LEAGUE" }] }),
  beforeLoad: async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw redirect({ to: "/login" });
  },
  component: AdminPage,
});

function AdminPage() {
  const { isAdmin, loading } = useAuth();
  if (loading) return <div className="p-10 text-center">Loading…</div>;
  if (!isAdmin) return <div className="p-10 text-center text-muted-foreground">Admin access only.</div>;

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gold-gradient shadow-[var(--shadow-gold)]">
          <Shield className="h-6 w-6 text-accent-foreground" />
        </div>
        <div>
          <h1 className="text-3xl font-black brand">Admin Command Center</h1>
          <p className="text-sm text-muted-foreground">Full manual control over LOMITA SHOOTERS LEAGUE.</p>
        </div>
      </div>

      <Tabs defaultValue="users">
        <TabsList className="glass mb-4 flex w-full flex-wrap gap-1 bg-transparent">
          <Tab v="users" i={<Users className="h-4 w-4" />}>Users</Tab>
          <Tab v="matches" i={<Trophy className="h-4 w-4" />}>Matches</Tab>
          <Tab v="tokens" i={<Coins className="h-4 w-4" />}>Tokens</Tab>
          <Tab v="promos" i={<Gift className="h-4 w-4" />}>Promos</Tab>
          <Tab v="content" i={<Megaphone className="h-4 w-4" />}>Content</Tab>
          <Tab v="events" i={<CalendarClock className="h-4 w-4" />}>Events</Tab>
          <Tab v="leaderboards" i={<Crown className="h-4 w-4" />}>Leaderboards</Tab>
          <Tab v="terms" i={<FileText className="h-4 w-4" />}>Terms</Tab>
          <Tab v="appeals" i={<MessageSquareWarning className="h-4 w-4" />}>Appeals</Tab>
          <Tab v="tickets" i={<LifeBuoy className="h-4 w-4" />}>Tickets</Tab>
          <Tab v="withdrawals" i={<ArrowDownToLine className="h-4 w-4" />}>Withdrawals</Tab>
          <Tab v="ai" i={<Bot className="h-4 w-4" />}>AI Logs</Tab>
          <Tab v="settings" i={<SettingsIcon className="h-4 w-4" />}>Settings</Tab>
          <Tab v="calc" i={<Calculator className="h-4 w-4" />}>Calc</Tab>
          <Tab v="audit" i={<ScrollText className="h-4 w-4" />}>Audit</Tab>
          <Tab v="analytics" i={<BarChart3 className="h-4 w-4" />}>Analytics</Tab>
        </TabsList>
        <TabsContent value="users"><UsersAdmin /></TabsContent>
        <TabsContent value="matches"><MatchesAdmin /></TabsContent>
        <TabsContent value="tokens"><TokensAdmin /></TabsContent>
        <TabsContent value="promos"><PromosAdmin /></TabsContent>
        <TabsContent value="content"><ContentAdmin /></TabsContent>
        <TabsContent value="events"><EventsAdmin /></TabsContent>
        <TabsContent value="leaderboards"><LeaderboardsAdmin /></TabsContent>
        <TabsContent value="terms"><TermsAdmin /></TabsContent>
        <TabsContent value="appeals"><AppealsAdmin /></TabsContent>
        <TabsContent value="tickets"><TicketsAdmin /></TabsContent>
        <TabsContent value="withdrawals"><WithdrawalsAdmin /></TabsContent>
        <TabsContent value="ai"><AILogsAdmin /></TabsContent>
        <TabsContent value="settings"><SettingsAdmin /></TabsContent>
        <TabsContent value="calc"><OddsCalculator /></TabsContent>
        <TabsContent value="audit"><AuditAdmin /></TabsContent>
        <TabsContent value="analytics"><AnalyticsAdmin /></TabsContent>
      </Tabs>
    </div>
  );
}

function Tab({ v, i, children }: { v: string; i: React.ReactNode; children: React.ReactNode }) {
  return (
    <TabsTrigger value={v} className="gap-1.5 data-[state=active]:bg-gold-gradient data-[state=active]:text-accent-foreground data-[state=active]:font-bold">
      {i}{children}
    </TabsTrigger>
  );
}

function Section({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="glass rounded-xl p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="font-bold tracking-wide">{title}</h3>
        {action}
      </div>
      {children}
    </div>
  );
}

// ============== USERS ==============
interface UserRow {
  id: string; full_name: string; email: string | null; phone: string | null;
  token_balance: number; is_banned: boolean; is_muted: boolean; is_restricted: boolean;
  ban_reason: string | null; gang_faction: string | null; gang_type: string | null;
  country: string | null; server: string; discord_username: string | null;
  created_at: string;
}
const ROLES = ["admin", "moderator", "gang_leader", "shooter", "registered", "viewer"] as const;

function UsersAdmin() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "banned" | "muted" | "restricted">("all");
  const [selected, setSelected] = useState<UserRow | null>(null);

  const load = async () => {
    const { data } = await supabase.from("profiles").select("*").order("created_at", { ascending: false }).limit(500);
    setUsers((data ?? []) as UserRow[]);
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => users.filter((u) => {
    if (filter === "banned" && !u.is_banned) return false;
    if (filter === "muted" && !u.is_muted) return false;
    if (filter === "restricted" && !u.is_restricted) return false;
    if (!search) return true;
    const s = search.toLowerCase();
    return u.full_name?.toLowerCase().includes(s) || u.email?.toLowerCase().includes(s) || u.gang_faction?.toLowerCase().includes(s);
  }), [users, search, filter]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input placeholder="Search name / email / gang…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />
        {(["all", "banned", "muted", "restricted"] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={`rounded-full px-3 py-1 text-xs font-bold uppercase ${filter === f ? "bg-gold-gradient text-accent-foreground" : "glass"}`}>{f}</button>
        ))}
        <span className="ml-auto text-xs text-muted-foreground">{filtered.length} users</span>
      </div>
      <div className="glass rounded-xl divide-y divide-white/5">
        {filtered.map((u) => (
          <button key={u.id} onClick={() => setSelected(u)} className="flex w-full items-center gap-3 p-3 text-left transition hover:bg-white/5">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gold-gradient text-sm font-black text-accent-foreground">
              {u.full_name?.[0]?.toUpperCase() ?? "?"}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-semibold">{u.full_name}</span>
                {u.gang_faction && <span className="rounded bg-accent/20 px-1.5 py-0.5 text-[10px] font-bold text-accent">{u.gang_type ?? "G/F"} · {u.gang_faction}</span>}
                {u.is_banned && <span className="rounded bg-destructive/20 px-1.5 py-0.5 text-[10px] font-bold text-destructive">BANNED</span>}
                {u.is_muted && <span className="rounded bg-warning/20 px-1.5 py-0.5 text-[10px] font-bold text-warning">MUTED</span>}
                {u.is_restricted && <span className="rounded bg-warning/20 px-1.5 py-0.5 text-[10px] font-bold text-warning">RESTRICTED</span>}
              </div>
              <div className="truncate text-xs text-muted-foreground">{u.email ?? u.phone} · {u.country ?? "—"} · {u.server}</div>
            </div>
            <div className="font-mono text-sm font-bold text-gold">{formatTokens(u.token_balance)}</div>
          </button>
        ))}
      </div>
      <UserDetailDialog user={selected} onClose={() => setSelected(null)} onChanged={load} />
    </div>
  );
}

function UserDetailDialog({ user, onClose, onChanged }: { user: UserRow | null; onClose: () => void; onChanged: () => void }) {
  const [roles, setRoles] = useState<string[]>([]);
  const [bets, setBets] = useState<Array<{ id: string; status: string; stake: number; payout: number | null; ticket_code: string | null; created_at: string }>>([]);
  const [tx, setTx] = useState<Array<{ id: string; type: string; amount: number; balance_after: number; note: string | null; created_at: string }>>([]);
  const [edit, setEdit] = useState<Partial<UserRow>>({});

  useEffect(() => {
    if (!user) return;
    setEdit({ full_name: user.full_name, country: user.country, server: user.server, gang_faction: user.gang_faction, gang_type: user.gang_type, discord_username: user.discord_username });
    (async () => {
      const [{ data: rs }, { data: bs }, { data: ts }] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", user.id),
        supabase.from("bets").select("id,status,stake,payout,ticket_code,created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(20),
        supabase.from("transactions").select("id,type,amount,balance_after,note,created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(20),
      ]);
      setRoles((rs ?? []).map((r: { role: string }) => r.role));
      setBets((bs ?? []) as typeof bets);
      setTx((ts ?? []) as typeof tx);
    })();
  }, [user]);

  if (!user) return null;
  const won = bets.filter((b) => b.status === "won").length;
  const lost = bets.filter((b) => b.status === "lost").length;

  const ban = async (mode: boolean) => {
    const reason = mode ? window.prompt("Ban reason:") ?? "" : "";
    const { error } = await supabase.rpc("admin_ban_user", { _user_id: user.id, _ban: mode, _reason: reason || undefined });
    if (error) toast.error(error.message); else { toast.success(mode ? "User banned" : "Ban lifted"); onChanged(); onClose(); }
  };
  const mute = async (mode: boolean) => {
    const reason = mode ? window.prompt("Mute reason:") ?? "" : "";
    const { error } = await supabase.rpc("admin_mute_user", { _user_id: user.id, _mute: mode, _reason: reason || undefined });
    if (error) toast.error(error.message); else { toast.success(mode ? "Muted" : "Unmuted"); onChanged(); }
  };
  const restrict = async (mode: boolean) => {
    const reason = mode ? window.prompt("Restriction reason:") ?? "" : "";
    const { error } = await supabase.rpc("admin_restrict_user", { _user_id: user.id, _restrict: mode, _reason: reason || undefined });
    if (error) toast.error(error.message); else { toast.success(mode ? "Restricted" : "Unrestricted"); onChanged(); }
  };
  const grant = async () => {
    const v = window.prompt("Amount (negative to remove):"); if (!v) return;
    const note = window.prompt("Note:") ?? "";
    const { error } = await supabase.rpc("admin_grant_tokens", { _user_id: user.id, _amount: Number(v), _note: note });
    if (error) toast.error(error.message); else { toast.success("Updated"); onChanged(); }
  };
  const notify = async () => {
    const title = window.prompt("Notification title:"); if (!title) return;
    const body = window.prompt("Body:") ?? "";
    const { error } = await supabase.rpc("admin_notify_user", { _user_id: user.id, _title: title, _body: body, _link: "/dashboard" });
    if (error) toast.error(error.message); else toast.success("Sent");
  };
  const saveEdit = async () => {
    const { error } = await supabase.from("profiles").update(edit as never).eq("id", user.id);
    if (error) toast.error(error.message); else { toast.success("Profile saved"); onChanged(); }
  };
  const toggleRole = async (role: string) => {
    const has = roles.includes(role);
    if (has) {
      await supabase.from("user_roles").delete().eq("user_id", user.id).eq("role", role as "admin");
      setRoles((r) => r.filter((x) => x !== role));
    } else {
      await supabase.from("user_roles").insert({ user_id: user.id, role: role as "admin" });
      setRoles((r) => [...r, role]);
    }
    toast.success("Role updated");
  };

  return (
    <Dialog open={!!user} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto glass">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span>{user.full_name}</span>
            <span className="font-mono text-base text-gold">{formatTokens(user.token_balance)}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-3 md:grid-cols-3">
          <Section title="Moderation">
            <div className="flex flex-col gap-2">
              <Button size="sm" variant={user.is_banned ? "outline" : "destructive"} onClick={() => ban(!user.is_banned)}>{user.is_banned ? "Unban" : "Ban"} user</Button>
              <Button size="sm" variant="outline" onClick={() => mute(!user.is_muted)}>{user.is_muted ? "Unmute" : "Mute"}</Button>
              <Button size="sm" variant="outline" onClick={() => restrict(!user.is_restricted)}>{user.is_restricted ? "Lift restriction" : "Restrict betting"}</Button>
              <Button size="sm" onClick={grant} className="bg-gold-gradient text-accent-foreground">Grant / remove tokens</Button>
              <Button size="sm" variant="outline" onClick={notify}>Send notification</Button>
            </div>
          </Section>

          <Section title="Edit profile">
            <div className="space-y-2">
              {(["full_name", "country", "server", "discord_username", "gang_faction", "gang_type"] as const).map((k) => (
                <div key={k}>
                  <Label className="text-xs capitalize">{k.replace("_", " ")}</Label>
                  <Input value={(edit[k] as string) ?? ""} onChange={(e) => setEdit((p) => ({ ...p, [k]: e.target.value }))} />
                </div>
              ))}
              <Button size="sm" onClick={saveEdit} className="w-full">Save profile</Button>
            </div>
          </Section>

          <Section title="Roles">
            <div className="flex flex-wrap gap-1">
              {ROLES.map((r) => {
                const has = roles.includes(r);
                return (
                  <button key={r} onClick={() => toggleRole(r)} className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase ${has ? "bg-gold-gradient text-accent-foreground" : "glass"}`}>{r}</button>
                );
              })}
            </div>
            <div className="mt-3 text-xs text-muted-foreground">
              <div>Won: <span className="font-bold text-success">{won}</span> · Lost: <span className="font-bold text-destructive">{lost}</span></div>
              <div>Joined: {new Date(user.created_at).toLocaleString()}</div>
            </div>
          </Section>
        </div>

        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <Section title="Recent bets">
            <div className="max-h-72 space-y-1 overflow-y-auto">
              {bets.length === 0 ? <div className="text-xs text-muted-foreground">No bets.</div> :
                bets.map((b) => (
                  <div key={b.id} className="flex items-center justify-between rounded bg-white/5 px-2 py-1 text-xs">
                    <span className="font-mono">{b.ticket_code ?? b.id.slice(0, 8)}</span>
                    <span className="font-mono">{formatTokens(b.stake)}</span>
                    <span className={`rounded px-1.5 ${b.status === "won" ? "bg-success/20 text-success" : b.status === "lost" ? "bg-destructive/20 text-destructive" : "bg-warning/20 text-warning"}`}>{b.status}</span>
                  </div>
                ))}
            </div>
          </Section>
          <Section title="Recent transactions">
            <div className="max-h-72 space-y-1 overflow-y-auto">
              {tx.length === 0 ? <div className="text-xs text-muted-foreground">No transactions.</div> :
                tx.map((t) => (
                  <div key={t.id} className="flex items-center justify-between rounded bg-white/5 px-2 py-1 text-xs">
                    <span>{t.type}</span>
                    <span className={`font-mono ${t.amount > 0 ? "text-success" : "text-destructive"}`}>{t.amount > 0 ? "+" : ""}{formatTokens(t.amount)}</span>
                    <span className="text-muted-foreground">{new Date(t.created_at).toLocaleDateString()}</span>
                  </div>
                ))}
            </div>
          </Section>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ============== MATCHES (manual builder) ==============
interface Tm { id: string; name: string }
interface Mtch {
  id: string; league: string | null; location: string | null; kickoff_time: string;
  status: string; home_score: number; away_score: number; match_minute: number | null;
  winner: string | null; home_team_id: string; away_team_id: string; bookings_locked: boolean;
  home_team: { name: string }; away_team: { name: string };
}

function MatchesAdmin() {
  const [matches, setMatches] = useState<Mtch[]>([]);
  const [showBuilder, setShowBuilder] = useState(false);
  const [editing, setEditing] = useState<Mtch | null>(null);

  const load = async () => {
    const { data } = await supabase.from("matches")
      .select("*, home_team:teams!matches_home_team_id_fkey(name), away_team:teams!matches_away_team_id_fkey(name)")
      .order("kickoff_time", { ascending: false }).limit(80);
    setMatches((data ?? []) as unknown as Mtch[]);
  };
  useEffect(() => { load(); }, []);

  const update = async (m: Mtch, patch: Record<string, unknown>) => {
    const { error } = await supabase.from("matches").update(patch as never).eq("id", m.id);
    if (error) toast.error(error.message); else load();
  };

  const endMatch = async (m: Mtch) => {
    if (!confirm(`End match with score ${m.home_score}-${m.away_score}?`)) return;
    const { error } = await supabase.rpc("end_match_by_score", { _match_id: m.id, _home_score: m.home_score, _away_score: m.away_score });
    if (error) toast.error(error.message); else { toast.success("Match settled"); load(); }
  };

  const del = async (m: Mtch) => {
    if (!confirm("Delete match? This removes all related bets/odds.")) return;
    await supabase.from("odds").delete().eq("match_id", m.id);
    await supabase.from("players").delete().eq("match_id", m.id);
    await supabase.from("matches").delete().eq("id", m.id);
    toast.success("Deleted"); load();
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{matches.length} matches</span>
        <Button onClick={() => setShowBuilder(true)} className="bg-gold-gradient text-accent-foreground">+ Build new match</Button>
      </div>

      <div className="glass rounded-xl divide-y divide-white/5">
        {matches.map((m) => (
          <div key={m.id} className="space-y-2 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="font-semibold">{m.home_team?.name} <span className="text-muted-foreground">vs</span> {m.away_team?.name}</div>
                <div className="text-xs text-muted-foreground">{m.league ?? "—"} · {m.location ?? "—"} · {new Date(m.kickoff_time).toLocaleString()}</div>
              </div>
              <span className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${m.status === "live" ? "bg-live/20 text-live" : m.status === "ended" ? "bg-muted text-muted-foreground" : "bg-warning/20 text-warning"}`}>{m.status}</span>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Label className="text-xs">Score</Label>
              <Input type="number" min="0" className="h-8 w-16" value={m.home_score} onChange={(e) => update(m, { home_score: parseInt(e.target.value) || 0 })} />
              <span>–</span>
              <Input type="number" min="0" className="h-8 w-16" value={m.away_score} onChange={(e) => update(m, { away_score: parseInt(e.target.value) || 0 })} />
              <Label className="ml-2 text-xs">Min</Label>
              <Input type="number" min="0" className="h-8 w-16" value={m.match_minute ?? 0} onChange={(e) => update(m, { match_minute: parseInt(e.target.value) || 0 })} />
              <select value={m.status} onChange={(e) => update(m, { status: e.target.value })} className="rounded-md bg-input px-2 py-1 text-xs">
                <option value="upcoming">upcoming</option>
                <option value="live">live</option>
                <option value="ended">ended</option>
                <option value="cancelled">cancelled</option>
              </select>
              <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={m.bookings_locked} onChange={(e) => update(m, { bookings_locked: e.target.checked })} />Lock</label>
              <Button size="sm" variant="outline" onClick={() => setEditing(m)}>Edit lineup & odds</Button>
              {m.status !== "ended" && <Button size="sm" onClick={() => endMatch(m)} className="bg-gold-gradient text-accent-foreground">Settle</Button>}
              <Button size="sm" variant="destructive" onClick={() => del(m)}>Delete</Button>
            </div>
          </div>
        ))}
      </div>

      {showBuilder && <MatchBuilderDialog onClose={() => setShowBuilder(false)} onSaved={load} />}
      {editing && <MatchLineupDialog match={editing} onClose={() => setEditing(null)} onSaved={load} />}
    </div>
  );
}

function MatchBuilderDialog({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [homeName, setHomeName] = useState("");
  const [awayName, setAwayName] = useState("");
  const [league, setLeague] = useState("");
  const [location, setLocation] = useState("");
  const [kickoff, setKickoff] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [homeMain, setHomeMain] = useState("");
  const [homeSubs, setHomeSubs] = useState("");
  const [awayMain, setAwayMain] = useState("");
  const [awaySubs, setAwaySubs] = useState("");
  const [oddsHome, setOddsHome] = useState("2.00");
  const [oddsDraw, setOddsDraw] = useState("3.20");
  const [oddsAway, setOddsAway] = useState("2.50");

  const ensureTeam = async (name: string): Promise<string> => {
    const { data: existing } = await supabase.from("teams").select("id").eq("name", name).maybeSingle();
    if (existing?.id) return existing.id;
    const { data, error } = await supabase.from("teams").insert({ name }).select("id").single();
    if (error) throw error;
    return data.id;
  };

  const save = async () => {
    if (!homeName || !awayName) { toast.error("Team names required"); return; }
    try {
      const homeId = await ensureTeam(homeName.trim());
      const awayId = await ensureTeam(awayName.trim());
      const ko = kickoff ? new Date(kickoff).toISOString() : new Date(Date.now() + 3600_000).toISOString();
      const { data: match, error } = await supabase.from("matches").insert({
        home_team_id: homeId, away_team_id: awayId, league: league || null, location: location || null,
        kickoff_time: ko, image_url: imageUrl || null,
      }).select("id").single();
      if (error) throw error;

      const players: Array<{ match_id: string; team_id: string; name: string; squad_type: "main" | "sub" }> = [];
      const parse = (raw: string, team_id: string, squad_type: "main" | "sub") =>
        raw.split(/[\n,]/).map((s) => s.trim()).filter(Boolean).forEach((name) => players.push({ match_id: match.id, team_id, name, squad_type }));
      parse(homeMain, homeId, "main"); parse(homeSubs, homeId, "sub");
      parse(awayMain, awayId, "main"); parse(awaySubs, awayId, "sub");
      if (players.length) await supabase.from("players").insert(players);

      const odds = [
        { match_id: match.id, market: "1X2", selection: "1", value: parseFloat(oddsHome) },
        { match_id: match.id, market: "1X2", selection: "X", value: parseFloat(oddsDraw) },
        { match_id: match.id, market: "1X2", selection: "2", value: parseFloat(oddsAway) },
      ];
      await supabase.from("odds").insert(odds);

      toast.success("Match created");
      onSaved(); onClose();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto glass">
        <DialogHeader><DialogTitle>Build a match</DialogTitle></DialogHeader>
        <div className="grid gap-3 md:grid-cols-2">
          <div><Label>Home team name</Label><Input value={homeName} onChange={(e) => setHomeName(e.target.value)} /></div>
          <div><Label>Away team name</Label><Input value={awayName} onChange={(e) => setAwayName(e.target.value)} /></div>
          <div><Label>League / Tournament</Label><Input value={league} onChange={(e) => setLeague(e.target.value)} /></div>
          <div><Label>Location</Label><Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. LOMITA AFR Server · Dome 3" /></div>
          <div><Label>Kickoff</Label><Input type="datetime-local" value={kickoff} onChange={(e) => setKickoff(e.target.value)} /></div>
          <div><Label>Cover image URL</Label><Input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} /></div>
          <div><Label>Home main squad (one per line)</Label><Textarea rows={4} value={homeMain} onChange={(e) => setHomeMain(e.target.value)} /></div>
          <div><Label>Home subs</Label><Textarea rows={4} value={homeSubs} onChange={(e) => setHomeSubs(e.target.value)} /></div>
          <div><Label>Away main squad</Label><Textarea rows={4} value={awayMain} onChange={(e) => setAwayMain(e.target.value)} /></div>
          <div><Label>Away subs</Label><Textarea rows={4} value={awaySubs} onChange={(e) => setAwaySubs(e.target.value)} /></div>
          <div><Label>Odds — Home (1)</Label><Input type="number" step="0.01" value={oddsHome} onChange={(e) => setOddsHome(e.target.value)} /></div>
          <div><Label>Odds — Draw (X)</Label><Input type="number" step="0.01" value={oddsDraw} onChange={(e) => setOddsDraw(e.target.value)} /></div>
          <div><Label>Odds — Away (2)</Label><Input type="number" step="0.01" value={oddsAway} onChange={(e) => setOddsAway(e.target.value)} /></div>
        </div>
        <Button onClick={save} className="mt-3 w-full bg-gold-gradient text-accent-foreground">Create match</Button>
      </DialogContent>
    </Dialog>
  );
}

function MatchLineupDialog({ match, onClose, onSaved }: { match: Mtch; onClose: () => void; onSaved: () => void }) {
  const [players, setPlayers] = useState<Array<{ id: string; team_id: string; name: string; squad_type: string }>>([]);
  const [odds, setOdds] = useState<Array<{ id: string; market: string; selection: string; value: number; is_active: boolean }>>([]);
  const [newName, setNewName] = useState(""); const [newTeam, setNewTeam] = useState<string>(match.home_team_id);
  const [newSquad, setNewSquad] = useState<"main" | "sub">("main");

  const load = async () => {
    const [{ data: ps }, { data: os }] = await Promise.all([
      supabase.from("players").select("*").eq("match_id", match.id),
      supabase.from("odds").select("*").eq("match_id", match.id),
    ]);
    setPlayers((ps ?? []) as typeof players);
    setOdds((os ?? []) as typeof odds);
  };
  useEffect(() => { load(); }, [match.id]);

  const addPlayer = async () => {
    if (!newName) return;
    await supabase.from("players").insert({ match_id: match.id, team_id: newTeam, name: newName, squad_type: newSquad });
    setNewName(""); load();
  };
  const delPlayer = async (id: string) => { await supabase.from("players").delete().eq("id", id); load(); };
  const updateOdd = async (id: string, value: number) => {
    await supabase.from("odds").update({ value }).eq("id", id);
    setOdds((p) => p.map((o) => o.id === id ? { ...o, value } : o));
  };
  const addOdd = async () => {
    const market = window.prompt("Market (e.g. 1X2, OU2.5):"); if (!market) return;
    const selection = window.prompt("Selection (e.g. 1, X, 2, OVER, UNDER):"); if (!selection) return;
    const value = parseFloat(window.prompt("Odds:") ?? "0"); if (!value) return;
    await supabase.from("odds").insert({ match_id: match.id, market, selection, value });
    load();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto glass">
        <DialogHeader><DialogTitle>{match.home_team?.name} vs {match.away_team?.name}</DialogTitle></DialogHeader>
        <Section title="Players">
          <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto_auto]">
            <Input placeholder="Player name" value={newName} onChange={(e) => setNewName(e.target.value)} />
            <select value={newTeam} onChange={(e) => setNewTeam(e.target.value)} className="rounded-md bg-input px-2 py-1.5 text-sm">
              <option value={match.home_team_id}>{match.home_team?.name}</option>
              <option value={match.away_team_id}>{match.away_team?.name}</option>
            </select>
            <select value={newSquad} onChange={(e) => setNewSquad(e.target.value as "main" | "sub")} className="rounded-md bg-input px-2 py-1.5 text-sm">
              <option value="main">Main</option><option value="sub">Sub</option>
            </select>
            <Button onClick={addPlayer}>Add</Button>
          </div>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {[match.home_team_id, match.away_team_id].map((tid) => (
              <div key={tid} className="rounded-lg bg-white/5 p-2">
                <div className="mb-1 text-xs font-bold uppercase">{tid === match.home_team_id ? match.home_team?.name : match.away_team?.name}</div>
                {players.filter((p) => p.team_id === tid).map((p) => (
                  <div key={p.id} className="flex items-center justify-between text-sm">
                    <span>{p.name} <span className="text-xs text-muted-foreground">({p.squad_type})</span></span>
                    <button onClick={() => delPlayer(p.id)}><X className="h-3 w-3 text-destructive" /></button>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </Section>
        <Section title="Odds" action={<Button size="sm" onClick={addOdd}>+ Market</Button>}>
          <div className="space-y-1">
            {odds.map((o) => (
              <div key={o.id} className="flex items-center gap-2 text-sm">
                <span className="font-mono w-32 text-xs">{o.market} / {o.selection}</span>
                <Input type="number" step="0.01" className="h-8 w-24" value={o.value} onChange={(e) => updateOdd(o.id, parseFloat(e.target.value) || 0)} />
                <button onClick={async () => { await supabase.from("odds").delete().eq("id", o.id); load(); }}><X className="h-3 w-3 text-destructive" /></button>
              </div>
            ))}
          </div>
        </Section>
        <Button onClick={() => { onSaved(); onClose(); }} className="w-full">Done</Button>
      </DialogContent>
    </Dialog>
  );
}

// ============== TOKENS ==============
function TokensAdmin() {
  const [reqs, setReqs] = useState<Array<{ id: string; user_id: string; amount: number; note: string | null; image_url: string | null; status: string; created_at: string; admin_note: string | null; profiles?: { full_name: string; email: string | null } }>>([]);
  const [tab, setTab] = useState<"pending" | "all">("pending");

  const load = async () => {
    let q = supabase.from("token_requests").select("*, profiles(full_name,email)").order("created_at", { ascending: false }).limit(100);
    if (tab === "pending") q = q.eq("status", "pending");
    const { data } = await q;
    setReqs((data ?? []) as unknown as typeof reqs);
  };
  useEffect(() => { load(); }, [tab]);
  useEffect(() => {
    const ch = supabase.channel("admin-tr").on("postgres_changes", { event: "*", schema: "public", table: "token_requests" }, () => load()).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [tab]);

  const action = async (id: string, approve: boolean) => {
    const note = window.prompt(approve ? "Optional note:" : "Reason:") ?? "";
    const { error } = approve
      ? await supabase.rpc("approve_token_request", { _req_id: id, _admin_note: note || undefined })
      : await supabase.rpc("deny_token_request", { _req_id: id, _admin_note: note || undefined });
    if (error) toast.error(error.message); else toast.success(approve ? "Approved" : "Denied");
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        {(["pending", "all"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`rounded-full px-4 py-1 text-sm font-bold uppercase ${tab === t ? "bg-gold-gradient text-accent-foreground" : "glass"}`}>{t}</button>
        ))}
      </div>
      {reqs.length === 0 ? <div className="glass rounded-xl p-8 text-center text-muted-foreground">No requests.</div> :
        <div className="space-y-2">
          {reqs.map((r) => (
            <div key={r.id} className="glass flex flex-col gap-3 rounded-xl p-3 sm:flex-row sm:items-start">
              {r.image_url ? <a href={r.image_url} target="_blank" rel="noreferrer"><img src={r.image_url} alt="proof" className="h-24 w-24 rounded-lg object-cover ring-1 ring-white/10" /></a>
                : <div className="flex h-24 w-24 items-center justify-center rounded-lg bg-secondary text-xs text-muted-foreground">No proof</div>}
              <div className="min-w-0 flex-1">
                <div className="font-mono text-lg font-extrabold text-gold">{formatTokens(r.amount)}</div>
                <div className="text-sm font-semibold">{r.profiles?.full_name} <span className="text-xs text-muted-foreground">{r.profiles?.email}</span></div>
                {r.note && <div className="mt-1 text-xs italic text-muted-foreground">"{r.note}"</div>}
                <div className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString()}</div>
              </div>
              {r.status === "pending" && (
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => action(r.id, true)} className="bg-success text-success-foreground"><Check className="h-3.5 w-3.5" /> Approve</Button>
                  <Button size="sm" variant="destructive" onClick={() => action(r.id, false)}><X className="h-3.5 w-3.5" /> Deny</Button>
                </div>
              )}
            </div>
          ))}
        </div>}
    </div>
  );
}

// ============== PROMOS ==============
function PromosAdmin() {
  const [codes, setCodes] = useState<Array<{ id: string; code: string; amount: number; max_uses: number; uses: number; expires_at: string | null; is_active: boolean; note: string | null }>>([]);
  const [code, setCode] = useState(""); const [amount, setAmount] = useState("100000");
  const [maxUses, setMaxUses] = useState("100"); const [expires, setExpires] = useState(""); const [note, setNote] = useState("");

  const load = async () => {
    const { data } = await supabase.from("promo_codes").select("*").order("created_at", { ascending: false });
    setCodes((data ?? []) as typeof codes);
  };
  useEffect(() => { load(); }, []);

  const gen = () => setCode("LSL-" + Math.random().toString(36).slice(2, 8).toUpperCase());
  const create = async () => {
    if (!code) { toast.error("Code required"); return; }
    const { error } = await supabase.from("promo_codes").insert({
      code: code.toUpperCase(), amount: parseFloat(amount), max_uses: parseInt(maxUses) || 1,
      expires_at: expires ? new Date(expires).toISOString() : null, note: note || null,
    });
    if (error) toast.error(error.message); else { toast.success("Promo created"); setCode(""); setNote(""); load(); }
  };
  const toggle = async (c: typeof codes[number]) => { await supabase.from("promo_codes").update({ is_active: !c.is_active }).eq("id", c.id); load(); };
  const del = async (id: string) => { if (!confirm("Delete?")) return; await supabase.from("promo_codes").delete().eq("id", id); load(); };

  return (
    <div className="space-y-3">
      <Section title="Generate promo code" action={<Button size="sm" variant="outline" onClick={gen}>Random</Button>}>
        <div className="grid gap-2 md:grid-cols-5">
          <Input placeholder="CODE" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} />
          <Input type="number" placeholder="Amount" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <Input type="number" placeholder="Max uses" value={maxUses} onChange={(e) => setMaxUses(e.target.value)} />
          <Input type="datetime-local" value={expires} onChange={(e) => setExpires(e.target.value)} />
          <Button onClick={create} className="bg-gold-gradient text-accent-foreground">Create</Button>
        </div>
        <Input className="mt-2" placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
      </Section>
      <div className="glass rounded-xl divide-y divide-white/5">
        {codes.map((c) => (
          <div key={c.id} className="flex items-center justify-between p-3">
            <div>
              <div className="font-mono font-bold text-gold">{c.code}</div>
              <div className="text-xs text-muted-foreground">{formatTokens(c.amount)} tokens · {c.uses}/{c.max_uses} used {c.expires_at && `· expires ${new Date(c.expires_at).toLocaleDateString()}`}</div>
              {c.note && <div className="text-xs italic">{c.note}</div>}
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={c.is_active} onCheckedChange={() => toggle(c)} />
              <Button size="sm" variant="destructive" onClick={() => del(c.id)}><X className="h-3 w-3" /></Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============== CONTENT (announcements, ads, highlights, categories, broadcast) ==============
function ContentAdmin() {
  return (
    <div className="space-y-3">
      <BroadcastBox />
      <SimpleListAdmin
        table="announcements" title="Announcements"
        fields={[{ k: "title", label: "Title" }, { k: "description", label: "Description", textarea: true }, { k: "image_url", label: "Image URL" }, { k: "link", label: "Link" }]}
      />
      <SimpleListAdmin
        table="advertisements" title="Advertisements (Hot Categories)"
        fields={[{ k: "title", label: "Title" }, { k: "description", label: "Description" }, { k: "image_url", label: "Image URL" }, { k: "link", label: "Link" }]}
      />
      <HighlightsAdmin />
      <CategoriesAdmin />
    </div>
  );
}

function BroadcastBox() {
  const [title, setTitle] = useState(""); const [body, setBody] = useState(""); const [link, setLink] = useState("/");
  const send = async () => {
    if (!title) { toast.error("Title required"); return; }
    const { data, error } = await supabase.rpc("admin_broadcast", { _title: title, _body: body, _link: link });
    if (error) toast.error(error.message); else { toast.success(`Sent to ${data} users`); setTitle(""); setBody(""); }
  };
  return (
    <Section title="Broadcast notification">
      <div className="grid gap-2 md:grid-cols-[1fr_1fr_180px_auto]">
        <Input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <Input placeholder="Body" value={body} onChange={(e) => setBody(e.target.value)} />
        <Input placeholder="Link" value={link} onChange={(e) => setLink(e.target.value)} />
        <Button onClick={send} className="bg-gold-gradient text-accent-foreground"><Sparkles className="mr-1 h-4 w-4" />Send</Button>
      </div>
    </Section>
  );
}

interface FieldDef { k: string; label: string; textarea?: boolean }
function SimpleListAdmin({ table, title, fields }: { table: "announcements" | "advertisements"; title: string; fields: FieldDef[] }) {
  const [items, setItems] = useState<Array<Record<string, unknown> & { id: string; is_active: boolean; sort_order: number }>>([]);
  const [form, setForm] = useState<Record<string, string>>({});
  const load = async () => { const { data } = await supabase.from(table).select("*").order("sort_order"); setItems((data ?? []) as typeof items); };
  useEffect(() => { load(); }, []);
  const create = async () => {
    const { error } = await supabase.from(table).insert({ ...form, sort_order: items.length } as never);
    if (error) toast.error(error.message); else { toast.success("Added"); setForm({}); load(); }
  };
  const upd = async (id: string, patch: Record<string, unknown>) => { await supabase.from(table).update(patch as never).eq("id", id); load(); };
  const del = async (id: string) => { if (!confirm("Delete?")) return; await supabase.from(table).delete().eq("id", id); load(); };

  return (
    <Section title={title}>
      <div className="grid gap-2 md:grid-cols-2">
        {fields.map((f) => f.textarea
          ? <Textarea key={f.k} placeholder={f.label} value={form[f.k] ?? ""} onChange={(e) => setForm((p) => ({ ...p, [f.k]: e.target.value }))} />
          : <Input key={f.k} placeholder={f.label} value={form[f.k] ?? ""} onChange={(e) => setForm((p) => ({ ...p, [f.k]: e.target.value }))} />
        )}
      </div>
      <Button onClick={create} className="mt-2" size="sm">+ Add</Button>
      <div className="mt-3 divide-y divide-white/5">
        {items.map((it) => (
          <div key={it.id} className="flex items-center gap-2 py-2">
            {(it.image_url as string) && <img src={it.image_url as string} alt="" className="h-10 w-16 rounded object-cover" />}
            <div className="flex-1 min-w-0">
              <div className="truncate font-semibold">{(it.title as string) ?? "(no title)"}</div>
              <div className="truncate text-xs text-muted-foreground">{(it.description as string) ?? ""}</div>
            </div>
            <Switch checked={it.is_active} onCheckedChange={(v) => upd(it.id, { is_active: v })} />
            <Button size="sm" variant="destructive" onClick={() => del(it.id)}><X className="h-3 w-3" /></Button>
          </div>
        ))}
      </div>
    </Section>
  );
}

function HighlightsAdmin() {
  const [items, setItems] = useState<Array<{ id: string; custom_title: string | null; custom_subtitle: string | null; is_active: boolean; sort_order: number }>>([]);
  const [title, setTitle] = useState(""); const [sub, setSub] = useState("");
  const load = async () => { const { data } = await supabase.from("live_highlights").select("*").order("sort_order"); setItems((data ?? []) as typeof items); };
  useEffect(() => { load(); }, []);
  const add = async () => {
    if (!title) return;
    await supabase.from("live_highlights").insert({ custom_title: title, custom_subtitle: sub, sort_order: items.length });
    setTitle(""); setSub(""); load();
  };
  return (
    <Section title="Live Highlights">
      <div className="grid gap-2 md:grid-cols-[1fr_1fr_auto]">
        <Input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <Input placeholder="Subtitle" value={sub} onChange={(e) => setSub(e.target.value)} />
        <Button onClick={add}>+ Add</Button>
      </div>
      <div className="mt-2 divide-y divide-white/5">
        {items.map((h) => (
          <div key={h.id} className="flex items-center justify-between py-2">
            <div><div className="font-semibold">{h.custom_title}</div><div className="text-xs text-muted-foreground">{h.custom_subtitle}</div></div>
            <div className="flex items-center gap-2">
              <Switch checked={h.is_active} onCheckedChange={async (v) => { await supabase.from("live_highlights").update({ is_active: v }).eq("id", h.id); load(); }} />
              <Button size="sm" variant="destructive" onClick={async () => { await supabase.from("live_highlights").delete().eq("id", h.id); load(); }}><X className="h-3 w-3" /></Button>
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}

function CategoriesAdmin() {
  const [cats, setCats] = useState<Array<{ id: string; name: string; slug: string; sort_order: number; icon: string | null }>>([]);
  const [name, setName] = useState(""); const [slug, setSlug] = useState(""); const [icon, setIcon] = useState("");
  const load = async () => { const { data } = await supabase.from("categories").select("*").order("sort_order"); setCats((data ?? []) as typeof cats); };
  useEffect(() => { load(); }, []);
  const add = async () => {
    if (!name || !slug) return;
    const { error } = await supabase.from("categories").insert({ name, slug, icon: icon || null, sort_order: cats.length });
    if (error) toast.error(error.message); else { setName(""); setSlug(""); setIcon(""); load(); }
  };
  return (
    <Section title="Categories">
      <div className="grid gap-2 md:grid-cols-[1fr_1fr_120px_auto]">
        <Input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
        <Input placeholder="Slug" value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/\s+/g, "-"))} />
        <Input placeholder="Icon (emoji)" value={icon} onChange={(e) => setIcon(e.target.value)} />
        <Button onClick={add}>Add</Button>
      </div>
      <div className="mt-2 divide-y divide-white/5">
        {cats.map((c) => (
          <div key={c.id} className="flex items-center justify-between py-2">
            <div><span className="mr-2">{c.icon}</span><span className="font-semibold">{c.name}</span> <span className="text-xs text-muted-foreground">/{c.slug}</span></div>
            <Button size="sm" variant="destructive" onClick={async () => { await supabase.from("categories").delete().eq("id", c.id); load(); }}><X className="h-3 w-3" /></Button>
          </div>
        ))}
      </div>
    </Section>
  );
}

// ============== EVENTS ==============
function EventsAdmin() {
  const [events, setEvents] = useState<Array<{ id: string; title: string; description: string | null; image_url: string | null; countdown_to: string | null; is_active: boolean; sort_order: number }>>([]);
  const [form, setForm] = useState<{ title: string; description: string; image_url: string; countdown_to: string }>({ title: "", description: "", image_url: "", countdown_to: "" });
  const load = async () => { const { data } = await supabase.from("events").select("*").order("sort_order"); setEvents((data ?? []) as typeof events); };
  useEffect(() => { load(); }, []);
  const add = async () => {
    if (!form.title) return;
    const { error } = await supabase.from("events").insert({
      title: form.title, description: form.description || null, image_url: form.image_url || null,
      countdown_to: form.countdown_to ? new Date(form.countdown_to).toISOString() : null, sort_order: events.length,
    });
    if (error) toast.error(error.message); else { setForm({ title: "", description: "", image_url: "", countdown_to: "" }); load(); }
  };
  return (
    <div className="space-y-3">
      <Section title="Create event with countdown">
        <div className="grid gap-2 md:grid-cols-2">
          <Input placeholder="Title" value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} />
          <Input type="datetime-local" placeholder="Countdown to" value={form.countdown_to} onChange={(e) => setForm((p) => ({ ...p, countdown_to: e.target.value }))} />
          <Input placeholder="Image URL" value={form.image_url} onChange={(e) => setForm((p) => ({ ...p, image_url: e.target.value }))} />
          <Input placeholder="Description" value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} />
        </div>
        <Button onClick={add} className="mt-2 bg-gold-gradient text-accent-foreground">+ Create event</Button>
      </Section>
      <div className="glass rounded-xl divide-y divide-white/5">
        {events.map((e) => (
          <div key={e.id} className="flex items-center gap-3 p-3">
            {e.image_url && <img src={e.image_url} alt="" className="h-14 w-24 rounded-lg object-cover" />}
            <div className="flex-1 min-w-0">
              <div className="font-bold">{e.title}</div>
              <div className="truncate text-xs text-muted-foreground">{e.description}</div>
              {e.countdown_to && <div className="text-xs text-gold">⏱ {new Date(e.countdown_to).toLocaleString()}</div>}
            </div>
            <Switch checked={e.is_active} onCheckedChange={async (v) => { await supabase.from("events").update({ is_active: v }).eq("id", e.id); load(); }} />
            <Button size="sm" variant="destructive" onClick={async () => { await supabase.from("events").delete().eq("id", e.id); load(); }}><X className="h-3 w-3" /></Button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============== LEADERBOARDS ==============
function LeaderboardsAdmin() {
  const [factions, setFactions] = useState<Array<{ id: string; name: string; type: string; rank: number; score: number; notes: string | null }>>([]);
  const [players, setPlayers] = useState<Array<{ id: string; player_name: string; gang_or_faction: string | null; gf_type: string | null; player_role: string | null; rank: number; score: number }>>([]);
  const load = async () => {
    const [{ data: f }, { data: p }] = await Promise.all([
      supabase.from("leaderboard_factions").select("*").order("rank"),
      supabase.from("leaderboard_players").select("*").order("rank"),
    ]);
    setFactions((f ?? []) as typeof factions); setPlayers((p ?? []) as typeof players);
  };
  useEffect(() => { load(); }, []);

  const addF = async () => {
    const name = window.prompt("Faction/Gang name:"); if (!name) return;
    const type = window.prompt("Type (Faction/Gang):") ?? "Faction";
    const rank = parseInt(window.prompt("Rank:") ?? "0") || factions.length + 1;
    const score = parseFloat(window.prompt("Score:") ?? "0") || 0;
    await supabase.from("leaderboard_factions").insert({ name, type, rank, score });
    load();
  };
  const addP = async () => {
    const player_name = window.prompt("Shooter name:"); if (!player_name) return;
    const gang_or_faction = window.prompt("Gang/Faction:") ?? "";
    const gf_type = window.prompt("Type (Gang/Faction):") ?? "";
    const rank = parseInt(window.prompt("Rank:") ?? "0") || players.length + 1;
    const score = parseFloat(window.prompt("Score (kills):") ?? "0") || 0;
    await supabase.from("leaderboard_players").insert({ player_name, gang_or_faction, gf_type, rank, score });
    load();
  };

  return (
    <div className="grid gap-3 md:grid-cols-2">
      <Section title="Top Factions / Gangs" action={<Button size="sm" onClick={addF}>+ Add</Button>}>
        <div className="divide-y divide-white/5">
          {factions.map((f) => (
            <div key={f.id} className="flex items-center justify-between py-2 text-sm">
              <span><span className="font-mono mr-2">#{f.rank}</span><span className="font-bold">{f.name}</span> <span className="text-xs text-muted-foreground">({f.type})</span></span>
              <span className="flex items-center gap-2">
                <span className="font-mono">{formatTokens(f.score)}</span>
                <Button size="sm" variant="destructive" onClick={async () => { await supabase.from("leaderboard_factions").delete().eq("id", f.id); load(); }}><X className="h-3 w-3" /></Button>
              </span>
            </div>
          ))}
        </div>
      </Section>
      <Section title="Best Shooters" action={<Button size="sm" onClick={addP}>+ Add</Button>}>
        <div className="divide-y divide-white/5">
          {players.map((p) => (
            <div key={p.id} className="flex items-center justify-between py-2 text-sm">
              <span><span className="font-mono mr-2">#{p.rank}</span><span className="font-bold">{p.player_name}</span> <span className="text-xs text-muted-foreground">{p.gang_or_faction}</span></span>
              <span className="flex items-center gap-2">
                <span className="font-mono">{formatTokens(p.score)}</span>
                <Button size="sm" variant="destructive" onClick={async () => { await supabase.from("leaderboard_players").delete().eq("id", p.id); load(); }}><X className="h-3 w-3" /></Button>
              </span>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}

// ============== TERMS ==============
function TermsAdmin() {
  const [secs, setSecs] = useState<Array<{ id: string; category: string; title: string; body: string; sort_order: number; is_active: boolean }>>([]);
  const [form, setForm] = useState({ category: "", title: "", body: "" });
  const load = async () => { const { data } = await supabase.from("terms_sections").select("*").order("category").order("sort_order"); setSecs((data ?? []) as typeof secs); };
  useEffect(() => { load(); }, []);
  const add = async () => {
    if (!form.category || !form.title) return;
    await supabase.from("terms_sections").insert({ ...form, sort_order: secs.length });
    setForm({ category: "", title: "", body: "" }); load();
  };
  const upd = async (id: string, patch: Record<string, unknown>) => { await supabase.from("terms_sections").update(patch as never).eq("id", id); load(); };
  return (
    <div className="space-y-3">
      <Section title="Add Terms section">
        <div className="grid gap-2">
          <Input placeholder="Category" value={form.category} onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))} />
          <Input placeholder="Title" value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} />
          <Textarea rows={4} placeholder="Body" value={form.body} onChange={(e) => setForm((p) => ({ ...p, body: e.target.value }))} />
          <Button onClick={add}>Add section</Button>
        </div>
      </Section>
      <div className="glass rounded-xl divide-y divide-white/5">
        {secs.map((s) => (
          <div key={s.id} className="space-y-1 p-3">
            <div className="flex items-center gap-2">
              <Input className="max-w-[160px]" value={s.category} onChange={(e) => upd(s.id, { category: e.target.value })} />
              <Input value={s.title} onChange={(e) => upd(s.id, { title: e.target.value })} />
              <Switch checked={s.is_active} onCheckedChange={(v) => upd(s.id, { is_active: v })} />
              <Button size="sm" variant="destructive" onClick={async () => { await supabase.from("terms_sections").delete().eq("id", s.id); load(); }}><X className="h-3 w-3" /></Button>
            </div>
            <Textarea rows={3} value={s.body} onChange={(e) => upd(s.id, { body: e.target.value })} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ============== APPEALS ==============
function AppealsAdmin() {
  const [items, setItems] = useState<Array<{ id: string; user_id: string; kind: string; message: string; status: string; admin_reply: string | null; created_at: string }>>([]);
  const load = async () => { const { data } = await supabase.from("appeals").select("*").order("created_at", { ascending: false }); setItems((data ?? []) as typeof items); };
  useEffect(() => { load(); }, []);
  const reply = async (id: string) => {
    const r = window.prompt("Reply:") ?? ""; if (!r) return;
    const status = confirm("Mark resolved?") ? "resolved" : "open";
    await supabase.from("appeals").update({ admin_reply: r, status, resolved_at: status === "resolved" ? new Date().toISOString() : null }).eq("id", id);
    load();
  };
  return (
    <div className="glass rounded-xl divide-y divide-white/5">
      {items.length === 0 ? <div className="p-6 text-center text-sm text-muted-foreground">No appeals yet.</div> :
        items.map((a) => (
          <div key={a.id} className="space-y-1 p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase font-bold">{a.kind} · {a.status}</span>
              <span className="text-xs text-muted-foreground">{new Date(a.created_at).toLocaleString()}</span>
            </div>
            <div className="text-sm">{a.message}</div>
            {a.admin_reply && <div className="rounded bg-accent/10 p-2 text-xs italic">Admin: {a.admin_reply}</div>}
            <Button size="sm" onClick={() => reply(a.id)}>Reply</Button>
          </div>
        ))}
    </div>
  );
}

// ============== AI LOGS ==============
function AILogsAdmin() {
  const [logs, setLogs] = useState<Array<{ id: string; kind: string; model: string | null; prompt_preview: string | null; response_preview: string | null; prompt_tokens: number | null; completion_tokens: number | null; created_at: string }>>([]);
  useEffect(() => { supabase.from("ai_logs").select("*").order("created_at", { ascending: false }).limit(150).then(({ data }) => setLogs((data ?? []) as typeof logs)); }, []);
  return (
    <div className="glass rounded-xl divide-y divide-white/5">
      {logs.length === 0 ? <div className="p-6 text-center text-sm text-muted-foreground">No AI activity yet.</div> :
        logs.map((l) => (
          <div key={l.id} className="space-y-1 p-3 text-sm">
            <div className="flex items-center gap-2 text-xs">
              <span className="rounded bg-accent/20 px-1.5 font-bold text-accent">{l.kind}</span>
              <span className="font-mono text-muted-foreground">{l.model}</span>
              <span className="ml-auto text-muted-foreground">{new Date(l.created_at).toLocaleString()}</span>
            </div>
            {l.prompt_preview && <div className="rounded bg-white/5 p-2 text-xs"><b>Prompt:</b> {l.prompt_preview}</div>}
            {l.response_preview && <div className="rounded bg-accent/5 p-2 text-xs"><b>Reply:</b> {l.response_preview}</div>}
            <div className="text-[10px] text-muted-foreground">in: {l.prompt_tokens ?? 0} · out: {l.completion_tokens ?? 0}</div>
          </div>
        ))}
    </div>
  );
}

// ============== SETTINGS ==============
function SettingsAdmin() {
  const [s, setS] = useState<{ maintenance_mode: boolean; maintenance_message: string | null; max_payout: number; min_stake: number; max_stake: number; about_us: string | null; why_trust_us: string | null; contact_email: string | null; contact_phone: string | null; contact_whatsapp: string | null; contact_sms: string | null } | null>(null);
  useEffect(() => { supabase.from("platform_settings").select("*").eq("id", 1).maybeSingle().then(({ data }) => setS(data as typeof s)); }, []);
  if (!s) return <div className="p-6 text-center text-sm text-muted-foreground">Loading…</div>;
  const save = async () => {
    const { error } = await supabase.from("platform_settings").update(s as never).eq("id", 1);
    if (error) toast.error(error.message); else toast.success("Saved");
  };
  return (
    <div className="space-y-3">
      <Section title="Maintenance">
        <div className="flex items-center gap-3">
          <Switch checked={s.maintenance_mode} onCheckedChange={(v) => setS({ ...s, maintenance_mode: v })} />
          <span className="text-sm">{s.maintenance_mode ? "Maintenance ON — users blocked from betting" : "Live"}</span>
        </div>
        <Textarea className="mt-2" rows={2} value={s.maintenance_message ?? ""} onChange={(e) => setS({ ...s, maintenance_message: e.target.value })} placeholder="Maintenance message" />
      </Section>
      <Section title="Limits">
        <div className="grid gap-2 md:grid-cols-3">
          <div><Label>Max payout</Label><Input type="number" value={s.max_payout} onChange={(e) => setS({ ...s, max_payout: parseFloat(e.target.value) })} /></div>
          <div><Label>Min stake</Label><Input type="number" value={s.min_stake} onChange={(e) => setS({ ...s, min_stake: parseFloat(e.target.value) })} /></div>
          <div><Label>Max stake</Label><Input type="number" value={s.max_stake} onChange={(e) => setS({ ...s, max_stake: parseFloat(e.target.value) })} /></div>
        </div>
      </Section>
      <Section title="Contact info">
        <div className="grid gap-2 md:grid-cols-2">
          <Input placeholder="Email" value={s.contact_email ?? ""} onChange={(e) => setS({ ...s, contact_email: e.target.value })} />
          <Input placeholder="Phone" value={s.contact_phone ?? ""} onChange={(e) => setS({ ...s, contact_phone: e.target.value })} />
          <Input placeholder="WhatsApp" value={s.contact_whatsapp ?? ""} onChange={(e) => setS({ ...s, contact_whatsapp: e.target.value })} />
          <Input placeholder="SMS" value={s.contact_sms ?? ""} onChange={(e) => setS({ ...s, contact_sms: e.target.value })} />
        </div>
      </Section>
      <Section title="About / Why trust us (footer)">
        <Textarea rows={3} className="mb-2" placeholder="About us" value={s.about_us ?? ""} onChange={(e) => setS({ ...s, about_us: e.target.value })} />
        <Textarea rows={3} placeholder="Why trust us" value={s.why_trust_us ?? ""} onChange={(e) => setS({ ...s, why_trust_us: e.target.value })} />
      </Section>
      <Button onClick={save} className="w-full bg-gold-gradient text-accent-foreground">Save settings</Button>
    </div>
  );
}

// ============== ODDS CALCULATOR ==============
function OddsCalculator() {
  const [legs, setLegs] = useState<{ odds: string }[]>([{ odds: "2.00" }, { odds: "1.80" }]);
  const [stake, setStake] = useState("100");
  const total = legs.reduce((a, l) => a * (parseFloat(l.odds) || 1), 1);
  const stakeNum = parseFloat(stake) || 0;
  const payout = stakeNum * total;
  const cashoutFull = stakeNum + (payout - stakeNum) * 0.5;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Section title="Inputs">
        <Label>Stake</Label>
        <Input type="number" value={stake} onChange={(e) => setStake(e.target.value)} className="mb-3" />
        <Label>Selections (odds)</Label>
        <div className="space-y-2">
          {legs.map((l, i) => (
            <div key={i} className="flex gap-2">
              <Input type="number" step="0.01" value={l.odds} onChange={(e) => setLegs((p) => p.map((x, j) => j === i ? { odds: e.target.value } : x))} />
              {legs.length > 1 && <Button variant="ghost" size="sm" onClick={() => setLegs((p) => p.filter((_, j) => j !== i))}><X className="h-4 w-4" /></Button>}
            </div>
          ))}
        </div>
        <Button variant="outline" size="sm" className="mt-2" onClick={() => setLegs((p) => [...p, { odds: "1.50" }])}>+ Add leg</Button>
      </Section>
      <div className="space-y-3">
        <CalcStat label="Total odds" value={total.toFixed(2)} />
        <CalcStat label="Potential payout" value={formatTokens(payout)} highlight />
        <CalcStat label="Profit" value={formatTokens(payout - stakeNum)} />
        <CalcStat label="Cashout (full)" value={formatTokens(cashoutFull)} />
        <CalcStat label="Cashout 50%" value={formatTokens(cashoutFull * 0.5)} />
      </div>
    </div>
  );
}
function CalcStat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-xl p-4 ${highlight ? "bg-gold-gradient text-accent-foreground" : "glass"}`}>
      <div className={`text-xs uppercase tracking-wider ${highlight ? "" : "text-muted-foreground"}`}>{label}</div>
      <div className="font-mono text-2xl font-black tabular-nums">{value}</div>
    </div>
  );
}

// ============== AUDIT ==============
function AuditAdmin() {
  const [logs, setLogs] = useState<Array<{ id: string; admin_id: string; action: string; target_type: string | null; created_at: string; metadata: unknown }>>([]);
  useEffect(() => { supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(150).then(({ data }) => setLogs((data ?? []) as typeof logs)); }, []);
  return (
    <div className="glass rounded-xl divide-y divide-white/5">
      {logs.length === 0 ? <div className="p-8 text-center text-muted-foreground">No logs yet.</div> :
        logs.map((l) => (
          <div key={l.id} className="p-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="font-bold text-accent">{l.action}</span>
              <span className="text-xs text-muted-foreground">{new Date(l.created_at).toLocaleString()}</span>
            </div>
            <div className="text-xs text-muted-foreground">target: {l.target_type ?? "—"}</div>
            {!!l.metadata && <pre className="mt-1 overflow-x-auto rounded bg-black/30 p-2 text-[10px]">{JSON.stringify(l.metadata, null, 2)}</pre>}
          </div>
        ))}
    </div>
  );
}

// ============== ANALYTICS ==============
function AnalyticsAdmin() {
  const [stats, setStats] = useState<{ users: number; bets: number; openBets: number; totalStake: number; totalPayout: number; revenue: number } | null>(null);
  const [byDay, setByDay] = useState<Array<{ day: string; stake: number; payout: number; revenue: number; bets: number }>>([]);
  const [topUsers, setTopUsers] = useState<Array<{ name: string; total: number }>>([]);

  useEffect(() => {
    (async () => {
      const since = new Date(Date.now() - 30 * 86400_000).toISOString();
      const [{ count: users }, { data: bets }] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("bets").select("stake,payout,status,created_at,user_id").gte("created_at", since).limit(2000),
      ]);
      const list = (bets ?? []) as Array<{ stake: number; payout: number | null; status: string; created_at: string; user_id: string }>;
      const totalStake = list.reduce((a, b) => a + Number(b.stake), 0);
      const totalPayout = list.reduce((a, b) => a + Number(b.payout ?? 0), 0);
      const open = list.filter((b) => b.status === "open").length;
      setStats({ users: users ?? 0, bets: list.length, openBets: open, totalStake, totalPayout, revenue: totalStake - totalPayout });

      const dayMap = new Map<string, { stake: number; payout: number; bets: number }>();
      for (const b of list) {
        const d = new Date(b.created_at).toISOString().slice(0, 10);
        const cur = dayMap.get(d) ?? { stake: 0, payout: 0, bets: 0 };
        cur.stake += Number(b.stake); cur.payout += Number(b.payout ?? 0); cur.bets += 1;
        dayMap.set(d, cur);
      }
      const arr = Array.from(dayMap.entries()).sort(([a], [b]) => a.localeCompare(b))
        .map(([day, v]) => ({ day: day.slice(5), ...v, revenue: v.stake - v.payout }));
      setByDay(arr);

      const userMap = new Map<string, number>();
      for (const b of list) userMap.set(b.user_id, (userMap.get(b.user_id) ?? 0) + Number(b.stake));
      const ids = Array.from(userMap.keys()).slice(0, 50);
      if (ids.length) {
        const { data: profs } = await supabase.from("profiles").select("id,full_name").in("id", ids);
        const nameMap = new Map((profs ?? []).map((p: { id: string; full_name: string }) => [p.id, p.full_name]));
        setTopUsers(Array.from(userMap.entries())
          .map(([id, total]) => ({ name: nameMap.get(id) ?? id.slice(0, 6), total }))
          .sort((a, b) => b.total - a.total).slice(0, 10));
      }
    })();
  }, []);

  if (!stats) return <div className="p-6 text-center text-sm text-muted-foreground">Loading analytics…</div>;
  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
        <Stat label="Users" value={stats.users.toString()} />
        <Stat label="Bets (30d)" value={stats.bets.toString()} />
        <Stat label="Open bets" value={stats.openBets.toString()} />
        <Stat label="Stake (30d)" value={formatTokens(stats.totalStake)} />
        <Stat label="Payouts (30d)" value={formatTokens(stats.totalPayout)} />
        <Stat label="Revenue (30d)" value={formatTokens(stats.revenue)} highlight />
      </div>

      <Section title="Daily revenue (30 days)">
        <div className="h-72">
          <ResponsiveContainer>
            <LineChart data={byDay}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="day" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <RTooltip contentStyle={{ background: "rgba(0,0,0,0.8)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8 }} />
              <Line type="monotone" dataKey="stake" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="payout" stroke="hsl(var(--destructive))" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="revenue" stroke="hsl(var(--accent))" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Section>

      <Section title="Bets per day">
        <div className="h-56">
          <ResponsiveContainer>
            <BarChart data={byDay}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="day" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <RTooltip contentStyle={{ background: "rgba(0,0,0,0.8)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8 }} />
              <Bar dataKey="bets" fill="hsl(var(--accent))" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Section>

      <Section title="Top stakers (30 days)">
        <div className="divide-y divide-white/5">
          {topUsers.map((u, i) => (
            <div key={i} className="flex justify-between py-2 text-sm">
              <span><span className="font-mono mr-2">#{i + 1}</span>{u.name}</span>
              <span className="font-mono font-bold text-gold">{formatTokens(u.total)}</span>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-xl p-4 ${highlight ? "bg-gold-gradient text-accent-foreground" : "glass"}`}>
      <div className={`text-[11px] uppercase tracking-wider ${highlight ? "" : "text-muted-foreground"}`}>{label}</div>
      <div className="font-mono text-xl font-black tabular-nums">{value}</div>
    </div>
  );
}

// ============== WITHDRAWALS ADMIN ==============
interface WReq { id: string; user_id: string; ingame_name: string; ingame_gang: string; amount: number; ticket_ref: string | null; status: string; admin_note: string | null; created_at: string; reviewed_at: string | null }
function WithdrawalsAdmin() {
  const [reqs, setReqs] = useState<WReq[]>([]);
  const [filter, setFilter] = useState<"pending" | "approved" | "declined" | "all">("pending");
  const [users, setUsers] = useState<Record<string, { full_name: string; email: string | null }>>({});

  const load = async () => {
    let q = supabase.from("withdrawal_requests").select("*").order("created_at", { ascending: false });
    if (filter !== "all") q = q.eq("status", filter);
    const { data } = await q;
    const list = (data ?? []) as WReq[];
    setReqs(list);
    if (list.length) {
      const ids = [...new Set(list.map((r) => r.user_id))];
      const { data: ps } = await supabase.from("profiles").select("id, full_name, email").in("id", ids);
      const map: Record<string, { full_name: string; email: string | null }> = {};
      (ps ?? []).forEach((p: { id: string; full_name: string; email: string | null }) => { map[p.id] = { full_name: p.full_name, email: p.email }; });
      setUsers(map);
    }
  };
  useEffect(() => { load(); }, [filter]);

  const act = async (id: string, approve: boolean) => {
    const note = window.prompt(approve ? "Approval message (instructions for user):" : "Decline reason:") ?? undefined;
    const fn = approve ? "approve_withdrawal" : "decline_withdrawal";
    const { error } = await supabase.rpc(fn, { _id: id, _note: note });
    if (error) { toast.error(error.message); return; }
    toast.success(approve ? "Approved" : "Declined & refunded");
    load();
  };

  return (
    <Section title="Withdrawal Requests" action={
      <div className="flex gap-1">
        {(["pending", "approved", "declined", "all"] as const).map((f) => (
          <Button key={f} size="sm" variant={filter === f ? "default" : "outline"} onClick={() => setFilter(f)}>{f}</Button>
        ))}
      </div>
    }>
      {reqs.length === 0 ? <div className="py-6 text-center text-sm text-muted-foreground">No requests</div> : (
        <div className="space-y-2">
          {reqs.map((r) => (
            <div key={r.id} className="rounded-lg bg-secondary/40 p-3 text-sm">
              <div className="grid gap-2 sm:grid-cols-2">
                <div>
                  <div className="font-bold">{users[r.user_id]?.full_name ?? "User"} <span className="text-xs text-muted-foreground">({users[r.user_id]?.email ?? "—"})</span></div>
                  <div className="text-xs text-muted-foreground">In-game: <span className="text-foreground font-semibold">{r.ingame_name}</span> · Gang: <span className="text-foreground font-semibold">{r.ingame_gang}</span></div>
                  {r.ticket_ref && <div className="text-xs">Ticket ref: <span className="font-mono">{r.ticket_ref}</span></div>}
                  <div className="text-[11px] text-muted-foreground">{new Date(r.created_at).toLocaleString()}</div>
                </div>
                <div className="text-right">
                  <div className="font-mono text-2xl font-black text-gold">{formatTokens(r.amount)}</div>
                  <span className={`inline-block rounded px-2 py-0.5 text-[10px] uppercase font-bold ${r.status === "pending" ? "bg-amber-500/20 text-amber-300" : r.status === "approved" ? "bg-success/20 text-success" : "bg-destructive/20 text-destructive"}`}>{r.status}</span>
                </div>
              </div>
              {r.admin_note && <div className="mt-2 rounded bg-background/40 p-2 text-xs"><span className="text-muted-foreground">Admin note:</span> {r.admin_note}</div>}
              {r.status === "pending" && (
                <div className="mt-2 flex gap-2">
                  <Button size="sm" onClick={() => act(r.id, true)} className="bg-success/80 hover:bg-success">Approve</Button>
                  <Button size="sm" variant="destructive" onClick={() => act(r.id, false)}>Decline & refund</Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}

// ============== TICKETS ADMIN ==============
interface STicket { id: string; user_id: string; subject: string; status: string; created_at: string; closed_at: string | null }
interface TMsg { id: string; ticket_id: string; user_id: string; content: string | null; image_url: string | null; created_at: string }
function TicketsAdmin() {
  const [tickets, setTickets] = useState<STicket[]>([]);
  const [filter, setFilter] = useState<"open" | "closed" | "all">("open");
  const [active, setActive] = useState<STicket | null>(null);
  const [msgs, setMsgs] = useState<TMsg[]>([]);
  const [reply, setReply] = useState("");
  const [users, setUsers] = useState<Record<string, string>>({});

  const load = async () => {
    let q = supabase.from("support_tickets").select("*").order("created_at", { ascending: false });
    if (filter !== "all") q = q.eq("status", filter);
    const { data } = await q;
    const list = (data ?? []) as STicket[];
    setTickets(list);
    if (list.length) {
      const ids = [...new Set(list.map((t) => t.user_id))];
      const { data: ps } = await supabase.from("profiles").select("id, full_name").in("id", ids);
      const map: Record<string, string> = {};
      (ps ?? []).forEach((p: { id: string; full_name: string }) => { map[p.id] = p.full_name; });
      setUsers(map);
    }
  };
  useEffect(() => { load(); }, [filter]);

  const openTicket = async (t: STicket) => {
    setActive(t);
    const { data } = await supabase.from("ticket_messages").select("*").eq("ticket_id", t.id).order("created_at");
    setMsgs((data ?? []) as TMsg[]);
  };

  const send = async () => {
    if (!active || !reply.trim()) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from("ticket_messages").insert({ ticket_id: active.id, user_id: user.id, content: reply });
    if (error) { toast.error(error.message); return; }
    setReply("");
    openTicket(active);
  };

  const setStatus = async (status: "open" | "closed" | "resolved") => {
    if (!active) return;
    const patch: { status: "open" | "closed" | "reported"; closed_at: string | null } = {
      status: status === "resolved" ? "closed" : status,
      closed_at: status === "open" ? null : new Date().toISOString(),
    };
    const { error } = await supabase.from("support_tickets").update(patch).eq("id", active.id);
    if (error) { toast.error(error.message); return; }
    toast.success(`Ticket ${status}`);
    setActive({ ...active, status });
    load();
  };

  const del = async () => {
    if (!active) return;
    if (!confirm("Delete ticket permanently?")) return;
    await supabase.from("support_tickets").delete().eq("id", active.id);
    toast.success("Deleted");
    setActive(null);
    load();
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
      <Section title="Tickets" action={
        <div className="flex gap-1">
          {(["open", "closed", "all"] as const).map((f) => (
            <Button key={f} size="sm" variant={filter === f ? "default" : "outline"} onClick={() => setFilter(f)}>{f}</Button>
          ))}
        </div>
      }>
        <div className="space-y-1.5 max-h-[600px] overflow-y-auto">
          {tickets.length === 0 ? <div className="py-6 text-center text-sm text-muted-foreground">No tickets</div> : tickets.map((t) => (
            <button key={t.id} onClick={() => openTicket(t)} className={`w-full text-left rounded-lg p-2.5 text-sm transition ${active?.id === t.id ? "bg-primary/20 border border-primary/40" : "bg-secondary/40 hover:bg-secondary"}`}>
              <div className="flex items-center justify-between">
                <span className="font-bold truncate">{t.subject}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded uppercase ${t.status === "open" ? "bg-success/20 text-success" : "bg-muted text-muted-foreground"}`}>{t.status}</span>
              </div>
              <div className="text-xs text-muted-foreground truncate">{users[t.user_id] ?? "User"} · {new Date(t.created_at).toLocaleString()}</div>
            </button>
          ))}
        </div>
      </Section>

      <Section title={active ? active.subject : "Select a ticket"}>
        {!active ? <div className="py-12 text-center text-sm text-muted-foreground">Pick a ticket to view conversation</div> : (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => setStatus("open")}>Reopen</Button>
              <Button size="sm" variant="outline" onClick={() => setStatus("closed")}>Close</Button>
              <Button size="sm" variant="outline" onClick={() => setStatus("resolved")}>Mark resolved</Button>
              <Button size="sm" variant="destructive" onClick={del}>Delete</Button>
            </div>
            <div className="space-y-2 max-h-[400px] overflow-y-auto rounded-lg bg-background/40 p-3">
              {msgs.length === 0 ? <div className="text-sm text-muted-foreground">No messages</div> : msgs.map((m) => (
                <div key={m.id} className={`rounded-lg p-2.5 text-sm ${m.user_id === active.user_id ? "bg-secondary/60" : "bg-primary/15 ml-8"}`}>
                  <div className="text-[10px] text-muted-foreground mb-1">{m.user_id === active.user_id ? users[m.user_id] ?? "User" : "Admin"} · {new Date(m.created_at).toLocaleString()}</div>
                  {m.content && <div className="whitespace-pre-wrap">{m.content}</div>}
                  {m.image_url && <img src={m.image_url} alt="attachment" className="mt-2 max-h-64 rounded" />}
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Textarea value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Reply…" rows={2} />
              <Button onClick={send} className="bg-gold-gradient text-accent-foreground">Send</Button>
            </div>
          </div>
        )}
      </Section>
    </div>
  );
}
