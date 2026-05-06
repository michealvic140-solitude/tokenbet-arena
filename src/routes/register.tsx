import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Eye, EyeOff, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/register")({
  head: () => ({ meta: [{ title: "Create account — LOMITA SHOOTERS LEAGUE" }] }),
  component: RegisterPage,
});

const schema = z.object({
  full_name: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(255),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
  discord_username: z.string().trim().max(60).optional().or(z.literal("")),
  country: z.string().trim().min(2).max(60),
  server: z.string().trim().min(2).max(60),
  gang_faction: z.string().trim().min(1).max(60),
  gang_type: z.enum(["G", "F"]),
  password: z.string().min(8).max(72),
  confirm: z.string(),
}).refine((d) => d.password === d.confirm, { message: "Passwords don't match", path: ["confirm"] });

function RegisterPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    full_name: "", email: "", phone: "", discord_username: "",
    country: "", server: "LOMITA AFR", gang_faction: "", gang_type: "G" as "G" | "F",
    password: "", confirm: "",
  });
  const [show1, setShow1] = useState(false);
  const [show2, setShow2] = useState(false);
  const [loading, setLoading] = useState(false);
  const [accepted, setAccepted] = useState(false);

  const set = <K extends keyof typeof form>(k: K) => (v: typeof form[K]) => setForm({ ...form, [k]: v });

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accepted) { toast.error("You must accept the Terms & Conditions"); return; }
    const parsed = schema.safeParse(form);
    if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email: form.email.trim(),
      password: form.password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: {
          full_name: form.full_name.trim(),
          phone: form.phone.trim() || null,
          discord_username: form.discord_username.trim() || null,
          country: form.country.trim(),
          server: form.server.trim(),
          gang_faction: form.gang_faction.trim(),
          gang_type: form.gang_type,
        },
      },
    });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Account created! Welcome to LOMITA SHOOTERS LEAGUE");
    navigate({ to: "/dashboard" });
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <div className="mb-6 text-center">
        <div className="mx-auto mb-3 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gold-gradient shadow-[var(--shadow-gold)]">
          <UserPlus className="h-7 w-7 text-accent-foreground" />
        </div>
        <h1 className="text-3xl font-black brand">Join the League</h1>
        <p className="mt-1 text-sm text-muted-foreground">You'll start as a Viewer. Roles assigned by admin.</p>
      </div>
      <div className="glass-strong rounded-2xl p-6">
        <form onSubmit={onSubmit} className="grid gap-3.5 sm:grid-cols-2">
          <Field label="In-game full name *" full>
            <Input value={form.full_name} onChange={(e) => set("full_name")(e.target.value)} required maxLength={80} />
          </Field>
          <Field label="Email *">
            <Input type="email" value={form.email} onChange={(e) => set("email")(e.target.value)} required autoComplete="email" />
          </Field>
          <Field label="Phone (optional)">
            <Input type="tel" value={form.phone} onChange={(e) => set("phone")(e.target.value)} />
          </Field>
          <Field label="Discord username">
            <Input value={form.discord_username} onChange={(e) => set("discord_username")(e.target.value)} />
          </Field>
          <Field label="Country *">
            <Input value={form.country} onChange={(e) => set("country")(e.target.value)} placeholder="e.g. Nigeria" />
          </Field>
          <Field label="Server *">
            <Input value={form.server} onChange={(e) => set("server")(e.target.value)} placeholder="LOMITA AFR" list="servers" />
            <datalist id="servers"><option value="LOMITA AFR" /><option value="LOMITA NA" /><option value="LOMITA EU" /></datalist>
          </Field>
          <Field label="Gang / Faction name *">
            <Input value={form.gang_faction} onChange={(e) => set("gang_faction")(e.target.value)} maxLength={40} />
          </Field>
          <Field label="Type *">
            <div className="flex gap-2">
              {(["G", "F"] as const).map((t) => (
                <button key={t} type="button" onClick={() => set("gang_type")(t)}
                  className={`flex-1 rounded-lg border py-2 text-sm font-bold transition ${form.gang_type === t ? "bg-gold-gradient text-accent-foreground border-transparent shadow-[var(--shadow-gold)]" : "glass border-white/10 text-muted-foreground"}`}>
                  {t === "G" ? "Gang (G)" : "Faction (F)"}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Password *">
            <div className="relative">
              <Input type={show1 ? "text" : "password"} value={form.password} onChange={(e) => set("password")(e.target.value)} required autoComplete="new-password" />
              <button type="button" onClick={() => setShow1((s) => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {show1 ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </Field>
          <Field label="Confirm password *">
            <div className="relative">
              <Input type={show2 ? "text" : "password"} value={form.confirm} onChange={(e) => set("confirm")(e.target.value)} required autoComplete="new-password" />
              <button type="button" onClick={() => setShow2((s) => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {show2 ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </Field>
          <label className="col-span-full flex items-start gap-2 text-sm">
            <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} className="mt-1 accent-[var(--color-accent)]" />
            <span className="text-muted-foreground">I accept the <Link to="/terms" className="text-gold underline">Terms & Conditions</Link> and confirm I'm using virtual tokens only — no real money.</span>
          </label>
          <Button type="submit" className="col-span-full bg-gold-gradient text-accent-foreground hover:opacity-90 font-bold" disabled={loading}>
            {loading ? "Creating account..." : "Create account"}
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          Already a member? <Link to="/login" className="font-bold text-gold hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div className={`space-y-1.5 ${full ? "sm:col-span-2" : ""}`}>
      <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
