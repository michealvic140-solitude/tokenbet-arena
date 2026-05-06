import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { LifeBuoy, Send, Sparkles, Plus, MessageCircle, ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export const Route = createFileRoute("/support")({
  head: () => ({ meta: [{ title: "Support — LSL" }] }),
  beforeLoad: async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw redirect({ to: "/login" });
  },
  component: SupportPage,
});

function SupportPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gold-gradient shadow-[var(--shadow-gold)]">
          <LifeBuoy className="h-6 w-6 text-accent-foreground" />
        </div>
        <div>
          <h1 className="text-3xl font-black brand">Support Center</h1>
          <p className="text-sm text-muted-foreground">AI assistant + human admin support</p>
        </div>
      </div>
      <Tabs defaultValue="ai">
        <TabsList className="glass mb-4 bg-transparent">
          <TabsTrigger value="ai" className="data-[state=active]:bg-gold-gradient data-[state=active]:text-accent-foreground gap-1.5"><Sparkles className="h-4 w-4" /> AI Assistant</TabsTrigger>
          <TabsTrigger value="tickets" className="data-[state=active]:bg-gold-gradient data-[state=active]:text-accent-foreground gap-1.5"><MessageCircle className="h-4 w-4" /> Tickets</TabsTrigger>
        </TabsList>
        <TabsContent value="ai"><AIChat /></TabsContent>
        <TabsContent value="tickets"><Tickets /></TabsContent>
      </Tabs>
    </div>
  );
}

interface ChatMsg { role: "user" | "assistant"; content: string }

function AIChat() {
  const { user } = useAuth();
  const [msgs, setMsgs] = useState<ChatMsg[]>([
    { role: "assistant", content: "Welcome to LSL support! I can help with bookings, today's matches, suggesting odds, and how to request tokens. What can I help with?" },
  ]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs.length]);

  const send = async () => {
    if (!text.trim() || busy || !user) return;
    const newMsgs: ChatMsg[] = [...msgs, { role: "user", content: text.trim() }];
    setMsgs(newMsgs);
    setText("");
    setBusy(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const r = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-support`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessionData.session?.access_token}` },
        body: JSON.stringify({ messages: newMsgs }),
      });
      if (r.status === 429) { toast.error("Slow down — too many requests"); setBusy(false); return; }
      if (r.status === 402) { toast.error("AI temporarily unavailable"); setBusy(false); return; }
      const j = await r.json();
      if (!r.ok) { toast.error(j.error ?? "AI error"); setBusy(false); return; }
      setMsgs((p) => [...p, { role: "assistant", content: j.reply ?? j.choices?.[0]?.message?.content ?? "—" }]);
    } catch (e) {
      toast.error("Network error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="glass-strong flex h-[65vh] flex-col rounded-2xl">
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {msgs.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${m.role === "user" ? "bg-gold-gradient text-accent-foreground font-semibold" : "glass"}`}>
              <p className="whitespace-pre-wrap">{m.content}</p>
            </div>
          </div>
        ))}
        {busy && <div className="text-xs text-muted-foreground italic">AI is thinking…</div>}
        <div ref={endRef} />
      </div>
      <form onSubmit={(e) => { e.preventDefault(); send(); }} className="flex gap-2 border-t border-white/5 p-3">
        <Input placeholder="Ask about matches, odds, tokens, bookings…" value={text} onChange={(e) => setText(e.target.value)} disabled={busy} />
        <Button type="submit" disabled={!text.trim() || busy} className="bg-gold-gradient text-accent-foreground"><Send className="h-4 w-4" /></Button>
      </form>
    </div>
  );
}

interface Ticket { id: string; subject: string; status: string; created_at: string }
interface TMsg { id: string; ticket_id: string; user_id: string; content: string | null; image_url: string | null; created_at: string }

function Tickets() {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [active, setActive] = useState<Ticket | null>(null);
  const [msgs, setMsgs] = useState<TMsg[]>([]);
  const [text, setText] = useState("");
  const [newSubject, setNewSubject] = useState("");
  const [creating, setCreating] = useState(false);

  const load = async () => {
    if (!user) return;
    const { data } = await supabase.from("support_tickets").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
    setTickets((data ?? []) as Ticket[]);
  };
  useEffect(() => { load(); }, [user?.id]);

  useEffect(() => {
    if (!active) return;
    supabase.from("ticket_messages").select("*").eq("ticket_id", active.id).order("created_at").then(({ data }) => setMsgs((data ?? []) as TMsg[]));
    const ch = supabase.channel(`tk:${active.id}`).on("postgres_changes",
      { event: "INSERT", schema: "public", table: "ticket_messages", filter: `ticket_id=eq.${active.id}` },
      (p) => setMsgs((prev) => [...prev, p.new as TMsg])).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [active?.id]);

  const createTicket = async () => {
    if (!newSubject.trim() || !user) return;
    const { data, error } = await supabase.from("support_tickets").insert({ user_id: user.id, subject: newSubject.trim() }).select().single();
    if (error) { toast.error(error.message); return; }
    toast.success("Ticket created");
    setNewSubject(""); setCreating(false);
    setActive(data as Ticket); load();
  };

  const uploadImage = async (file: File): Promise<string | null> => {
    const path = `tickets/${user!.id}/${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("uploads").upload(path, file);
    if (error) { toast.error(error.message); return null; }
    return supabase.storage.from("uploads").getPublicUrl(path).data.publicUrl;
  };

  const send = async (file?: File) => {
    if (!active || !user) return;
    if (!text.trim() && !file) return;
    let image_url: string | null = null;
    if (file) image_url = await uploadImage(file);
    const { error } = await supabase.from("ticket_messages").insert({ ticket_id: active.id, user_id: user.id, content: text.trim() || null, image_url });
    if (error) { toast.error(error.message); return; }
    setText("");
  };

  return (
    <div className="grid gap-3 lg:grid-cols-[280px_1fr]">
      <aside className="glass-strong rounded-2xl p-3">
        <Button onClick={() => setCreating(true)} className="w-full gap-1 bg-gold-gradient text-accent-foreground font-bold mb-3"><Plus className="h-4 w-4" /> New ticket</Button>
        <div className="space-y-1">
          {tickets.map((t) => (
            <button key={t.id} onClick={() => setActive(t)} className={`w-full rounded-lg px-3 py-2 text-left text-sm transition ${active?.id === t.id ? "bg-gold-gradient text-accent-foreground font-bold" : "glass hover:bg-white/10"}`}>
              <div className="truncate">{t.subject}</div>
              <div className="text-[10px] uppercase opacity-70">{t.status}</div>
            </button>
          ))}
          {tickets.length === 0 && <p className="p-3 text-center text-xs text-muted-foreground">No tickets yet</p>}
        </div>
      </aside>
      <section className="glass-strong flex h-[65vh] flex-col rounded-2xl">
        {creating ? (
          <div className="p-4 space-y-3">
            <h3 className="font-bold">New ticket</h3>
            <Input placeholder="Subject (e.g. Token grant question)" value={newSubject} onChange={(e) => setNewSubject(e.target.value)} />
            <div className="flex gap-2">
              <Button onClick={createTicket} className="bg-gold-gradient text-accent-foreground">Create</Button>
              <Button variant="ghost" onClick={() => setCreating(false)}>Cancel</Button>
            </div>
          </div>
        ) : !active ? (
          <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">Select or create a ticket</div>
        ) : (
          <>
            <header className="border-b border-white/5 px-4 py-3">
              <h3 className="font-bold">{active.subject}</h3>
              <p className="text-xs text-muted-foreground">Status: {active.status}</p>
            </header>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {msgs.map((m) => (
                <div key={m.id} className={`flex ${m.user_id === user?.id ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${m.user_id === user?.id ? "bg-gold-gradient text-accent-foreground font-semibold" : "glass"}`}>
                    {m.image_url && <img src={m.image_url} alt="" className="mb-1.5 max-h-48 rounded-lg" />}
                    {m.content && <p className="whitespace-pre-wrap">{m.content}</p>}
                    <div className="mt-1 text-[10px] opacity-70">{new Date(m.created_at).toLocaleTimeString()}</div>
                  </div>
                </div>
              ))}
              {msgs.length === 0 && <p className="text-center text-xs text-muted-foreground">No messages yet — say hi!</p>}
            </div>
            <form onSubmit={(e) => { e.preventDefault(); send(); }} className="flex gap-2 border-t border-white/5 p-3">
              <label className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-md glass hover:bg-white/10">
                <ImageIcon className="h-4 w-4" />
                <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && send(e.target.files[0])} />
              </label>
              <Input placeholder="Reply…" value={text} onChange={(e) => setText(e.target.value)} />
              <Button type="submit" className="bg-gold-gradient text-accent-foreground"><Send className="h-4 w-4" /></Button>
            </form>
          </>
        )}
      </section>
    </div>
  );
}
