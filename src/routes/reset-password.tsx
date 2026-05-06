import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { KeyRound, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: [{ title: "Reset password — LSL" }] }),
  component: ResetPage,
});

function ResetPage() {
  const navigate = useNavigate();
  const [pwd, setPwd] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // Supabase places the recovery token in the URL hash; SDK handles it.
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });
    supabase.auth.getSession().then(({ data: { session } }) => { if (session) setReady(true); });
    return () => sub.subscription.unsubscribe();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pwd.length < 8) { toast.error("Min 8 characters"); return; }
    if (pwd !== confirm) { toast.error("Passwords don't match"); return; }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pwd });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Password updated — please sign in");
    await supabase.auth.signOut();
    navigate({ to: "/login" });
  };

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <div className="mb-6 text-center">
        <div className="mx-auto mb-3 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gold-gradient shadow-[var(--shadow-gold)]">
          <KeyRound className="h-7 w-7 text-accent-foreground" />
        </div>
        <h1 className="text-3xl font-black brand">New password</h1>
      </div>
      <div className="glass-strong rounded-2xl p-6">
        {!ready ? (
          <p className="text-center text-sm text-muted-foreground">Validating reset link…</p>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <div>
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">New password</Label>
              <div className="relative mt-1.5">
                <Input type={show ? "text" : "password"} value={pwd} onChange={(e) => setPwd(e.target.value)} required minLength={8} />
                <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground">
                  {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div>
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Confirm</Label>
              <Input type={show ? "text" : "password"} value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={8} className="mt-1.5" />
            </div>
            <Button type="submit" disabled={busy} className="w-full bg-gold-gradient text-accent-foreground font-bold">
              {busy ? "Updating…" : "Update password"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
