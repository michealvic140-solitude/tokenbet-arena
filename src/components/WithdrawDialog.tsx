import { useState } from "react";
import { toast } from "sonner";
import { ArrowDownToLine } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { formatTokens } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";

export function WithdrawButton() {
  const { profile, refreshProfile } = useAuth();
  const [open, setOpen] = useState(false);
  const [success, setSuccess] = useState(false);
  const [name, setName] = useState("");
  const [gang, setGang] = useState(profile?.gang_faction ?? "");
  const [amount, setAmount] = useState("");
  const [ref, setRef] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const amt = parseFloat(amount);
    if (!name.trim() || !gang.trim()) { toast.error("In-game name and gang required"); return; }
    if (!amt || amt <= 0) { toast.error("Enter a valid amount"); return; }
    if (amt > (profile?.token_balance ?? 0)) { toast.error("Amount exceeds your balance"); return; }
    setBusy(true);
    const { error } = await supabase.rpc("request_withdrawal", {
      _ingame_name: name, _ingame_gang: gang, _amount: amt, _ticket_ref: ref || null,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    refreshProfile();
    setSuccess(true);
  };

  const reset = () => { setOpen(false); setSuccess(false); setName(""); setAmount(""); setRef(""); };

  return (
    <>
      <Button onClick={() => setOpen(true)} variant="outline" className="gap-2 border-primary/30">
        <ArrowDownToLine className="h-4 w-4" /> Withdraw tokens
      </Button>
      <Dialog open={open} onOpenChange={(v) => !v && reset()}>
        <DialogContent className="glass-strong border-primary/20 backdrop-blur-2xl">
          {!success ? (
            <>
              <DialogHeader>
                <DialogTitle className="text-2xl brand">Request withdrawal</DialogTitle>
                <DialogDescription>Tokens are deducted immediately and refunded if declined.</DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div><Label>In-game name *</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
                <div><Label>In-game gang *</Label><Input value={gang} onChange={(e) => setGang(e.target.value)} /></div>
                <div>
                  <Label>Amount * <span className="text-xs text-muted-foreground">(balance: {formatTokens(profile?.token_balance ?? 0)})</span></Label>
                  <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
                </div>
                <div><Label>Bet ticket / tracking ID (optional)</Label><Input value={ref} onChange={(e) => setRef(e.target.value)} /></div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={reset}>Cancel</Button>
                <Button onClick={submit} disabled={busy} className="bg-gold-gradient text-accent-foreground">
                  {busy ? "Submitting…" : "Submit request"}
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle className="text-2xl brand">Request received ✓</DialogTitle>
              </DialogHeader>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Your withdrawal request has been sent and you'll receive it on or before 24hrs after the admin approves it.
                Approval withdrawal request carefully tracked by our support team to avoid inconvenience. Stay tuned for
                notifications from the admin on how to cash out your withdrawal after it's been approved.
              </p>
              <DialogFooter>
                <Button onClick={reset} className="bg-gold-gradient text-accent-foreground">Close</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
