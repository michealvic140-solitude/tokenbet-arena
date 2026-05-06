import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { MessagesSquare, Send, Lock } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { RoleBadge } from "@/components/RoleBadge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/chat")({
  head: () => ({ meta: [{ title: "Chat — LSL" }] }),
  beforeLoad: async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw redirect({ to: "/login" });
  },
  component: ChatPage,
});

interface Channel { id: string; name: string; type: "general" | "gang" | "moderator" }
interface Msg { id: string; channel_id: string; user_id: string; content: string | null; image_url: string | null; created_at: string; deleted_at: string | null }
interface UserMini { id: string; full_name: string; gang_faction: string | null; gang_type: string | null; roles: string[] }

function ChatPage() {
  const { user, profile, isMod, hasRole } = useAuth();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [active, setActive] = useState<Channel | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [users, setUsers] = useState<Record<string, UserMini>>({});
  const [text, setText] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.from("chat_channels").select("*").order("type").then(({ data }) => {
      const list = (data ?? []) as Channel[];
      setChannels(list);
      if (list.length && !active) setActive(list.find((c) => c.type === "general") ?? list[0]);
    });
  }, []);

  useEffect(() => {
    if (!active) return;
    supabase.from("chat_messages").select("*").eq("channel_id", active.id).is("deleted_at", null)
      .order("created_at", { ascending: true }).limit(200).then(({ data }) => {
        const list = (data ?? []) as Msg[];
        setMsgs(list);
        loadUsers(list.map((m) => m.user_id));
      });
    const ch = supabase.channel(`chat:${active.id}`).on("postgres_changes",
      { event: "INSERT", schema: "public", table: "chat_messages", filter: `channel_id=eq.${active.id}` },
      (payload) => {
        const m = payload.new as Msg;
        setMsgs((prev) => [...prev, m]);
        loadUsers([m.user_id]);
      }).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [active?.id]);

  const loadUsers = async (ids: string[]) => {
    const need = [...new Set(ids)].filter((id) => !users[id]);
    if (!need.length) return;
    const [{ data: ps }, { data: rs }] = await Promise.all([
      supabase.from("profiles").select("id, full_name, gang_faction, gang_type").in("id", need),
      supabase.from("user_roles").select("user_id, role").in("user_id", need),
    ]);
    const next: Record<string, UserMini> = { ...users };
    for (const p of (ps ?? []) as { id: string; full_name: string; gang_faction: string | null; gang_type: string | null }[]) {
      next[p.id] = { id: p.id, full_name: p.full_name, gang_faction: p.gang_faction, gang_type: p.gang_type, roles: [] };
    }
    for (const r of (rs ?? []) as { user_id: string; role: string }[]) {
      if (next[r.user_id]) next[r.user_id].roles.push(r.role);
    }
    setUsers(next);
  };

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs.length]);

  const send = async () => {
    if (!text.trim() || !active || !user) return;
    if (profile?.is_muted) { toast.error("You are muted"); return; }
    const { error } = await supabase.from("chat_messages").insert({ channel_id: active.id, user_id: user.id, content: text.trim() });
    if (error) { toast.error(error.message); return; }
    setText("");
  };

  const deleteMsg = async (id: string) => {
    if (!isMod) return;
    await supabase.from("chat_messages").update({ deleted_at: new Date().toISOString() }).eq("id", id);
    setMsgs((prev) => prev.filter((m) => m.id !== id));
  };

  const canAccess = (c: Channel) => c.type === "general" || (c.type === "gang" && (hasRole("gang_leader") || isMod)) || (c.type === "moderator" && isMod);

  return (
    <div className="mx-auto grid max-w-7xl gap-3 px-4 py-6 lg:grid-cols-[240px_1fr]">
      <aside className="glass-strong rounded-xl p-3">
        <div className="mb-2 flex items-center gap-2 text-sm font-bold">
          <MessagesSquare className="h-4 w-4 text-primary" /> Channels
        </div>
        <div className="space-y-1">
          {channels.map((c) => {
            const allowed = canAccess(c);
            return (
              <button key={c.id} onClick={() => allowed && setActive(c)} disabled={!allowed}
                className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition ${active?.id === c.id ? "bg-gold-gradient text-accent-foreground font-bold" : allowed ? "glass hover:bg-white/10" : "opacity-40"}`}>
                <span># {c.name}</span>
                {!allowed && <Lock className="h-3 w-3" />}
              </button>
            );
          })}
        </div>
      </aside>

      <section className="glass-strong flex h-[70vh] flex-col rounded-xl">
        <header className="border-b border-white/5 px-4 py-3">
          <h2 className="font-bold"># {active?.name ?? "—"}</h2>
          <p className="text-xs text-muted-foreground capitalize">{active?.type} channel</p>
        </header>
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {msgs.map((m) => {
            const u = users[m.user_id];
            return (
              <div key={m.id} className="group flex gap-2">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gold-gradient text-xs font-black text-accent-foreground">
                  {u?.full_name?.[0]?.toUpperCase() ?? "?"}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-sm font-bold">{u?.full_name ?? "User"}</span>
                    {u?.gang_faction && <span className="text-[10px] text-muted-foreground">{u.gang_faction} ({u.gang_type ?? "G"}/F)</span>}
                    {u?.roles.map((r) => <RoleBadge key={r} role={r as never} />)}
                    <span className="ml-auto text-[10px] text-muted-foreground">{new Date(m.created_at).toLocaleTimeString()}</span>
                    {isMod && <button onClick={() => deleteMsg(m.id)} className="opacity-0 group-hover:opacity-100 text-[10px] text-destructive hover:underline">delete</button>}
                  </div>
                  <p className="text-sm text-foreground/90 break-words">{m.content}</p>
                </div>
              </div>
            );
          })}
          <div ref={endRef} />
        </div>
        <form onSubmit={(e) => { e.preventDefault(); send(); }} className="flex gap-2 border-t border-white/5 p-3">
          <Input placeholder={profile?.is_muted ? "You are muted" : `Message #${active?.name ?? ""}`}
            disabled={!active || profile?.is_muted}
            value={text} onChange={(e) => setText(e.target.value)} />
          <Button type="submit" disabled={!text.trim()} className="bg-gold-gradient text-accent-foreground"><Send className="h-4 w-4" /></Button>
        </form>
      </section>
    </div>
  );
}
