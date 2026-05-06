import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Eye, EyeOff, ShieldAlert, LogIn } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Login — LOMITA SHOOTERS LEAGUE" }] }),
  validateSearch: (s: Record<string, unknown>) => ({
    banned: s.banned === "1" || s.banned === 1,
    reason: typeof s.reason === "string" ? s.reason : "",
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const search = useSearch({ from: "/login" });
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [forgot, setForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [bannedOpen, setBannedOpen] = useState(false);
  const [appeal, setAppeal] = useState("");
  const [appealEmail, setAppealEmail] = useState("");

  useEffect(() => { if (search.banned) setBannedOpen(true); }, [search.banned]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const isEmail = identifier.includes("@");
    const { data, error } = isEmail
      ? await supabase.auth.signInWithPassword({ email: identifier.trim(), password })
      : await supabase.auth.signInWithPassword({ phone: identifier.trim(), password });
    if (error) { setLoading(false); toast.error(error.message); return; }
    // Check ban status
    const { data: prof } = await supabase.from("profiles").select("is_banned, ban_reason").eq("id", data.user!.id).maybeSingle();
    if (prof?.is_banned) {
      await supabase.auth.signOut();
      setLoading(false);
      navigate({ to: "/login", search: { banned: true, reason: prof.ban_reason ?? "" } });
      return;
    }
    setLoading(false);
    toast.success("Welcome back, shooter!");
    navigate({ to: "/dashboard" });
  };

  const sendReset = async () => {
    if (!forgotEmail.trim()) { toast.error("Enter your email"); return; }
    const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Reset link sent — check your email");
    setForgot(false);
  };

  const submitAppeal = async () => {
    if (!appealEmail.trim() || !appeal.trim()) { toast.error("Email and message required"); return; }
    // Find user by email and post an appeal
    const { data: user } = await supabase.from("profiles").select("id").eq("email", appealEmail.trim()).maybeSingle();
    if (!user) { toast.error("No account found for that email"); return; }
    const { error } = await supabase.from("appeals").insert({ user_id: user.id, kind: "ban", message: appeal.trim() });
    if (error) { toast.error(error.message); return; }
    toast.success("Appeal submitted. Admin will review.");
    setBannedOpen(false);
  };

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <div className="mb-6 text-center">
        <div className="mx-auto mb-3 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gold-gradient shadow-[var(--shadow-gold)]">
          <LogIn className="h-7 w-7 text-accent-foreground" />
        </div>
        <h1 className="text-3xl font-black brand">Welcome back</h1>
        <p className="mt-1 text-sm text-muted-foreground">Email or phone + password</p>
      </div>
      <div className="glass-strong rounded-2xl p-6">
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="identifier" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Email or phone</Label>
            <Input id="identifier" value={identifier} onChange={(e) => setIdentifier(e.target.value)} required autoComplete="username" />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="password" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Password</Label>
              <button type="button" onClick={() => setForgot(true)} className="text-xs text-gold hover:underline">Forgot?</button>
            </div>
            <div className="relative">
              <Input id="password" type={show ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
              <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <Button type="submit" className="w-full bg-gold-gradient text-accent-foreground hover:opacity-90 font-bold" disabled={loading}>
            {loading ? "Signing in..." : "Sign in"}
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          New shooter? <Link to="/register" className="font-bold text-gold hover:underline">Create an account</Link>
        </p>
      </div>

      <Dialog open={forgot} onOpenChange={setForgot}>
        <DialogContent className="glass-strong">
          <DialogHeader><DialogTitle>Reset password</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Enter your email — we'll send you a reset link.</p>
            <Input type="email" placeholder="you@example.com" value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setForgot(false)}>Cancel</Button>
            <Button onClick={sendReset} className="bg-gold-gradient text-accent-foreground">Send link</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={bannedOpen} onOpenChange={setBannedOpen}>
        <DialogContent className="glass-strong border-destructive/30">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive"><ShieldAlert className="h-5 w-5" /> Account banned</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="rounded-lg bg-destructive/10 p-3 text-sm">
              <div className="font-bold text-destructive">Reason</div>
              <p className="mt-1 text-muted-foreground">{search.reason || "No reason provided. Contact admin."}</p>
            </div>
            <div>
              <div className="mb-2 text-sm font-bold">Submit an appeal</div>
              <Input placeholder="Your account email" value={appealEmail} onChange={(e) => setAppealEmail(e.target.value)} className="mb-2" />
              <Textarea placeholder="Explain why your ban should be reviewed…" value={appeal} onChange={(e) => setAppeal(e.target.value)} rows={4} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setBannedOpen(false)}>Close</Button>
            <Button onClick={submitAppeal} className="bg-gold-gradient text-accent-foreground">Submit appeal</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
