import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Trash2, X, Receipt, Plus, Minus } from "lucide-react";
import { toast } from "sonner";
import { useBetSlip } from "@/lib/betslip";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { formatTokens } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";

export function BetSlipFab() {
  const { picks, open, setOpen } = useBetSlip();
  if (picks.length === 0) return null;
  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-full bg-gold-gradient px-5 py-3 text-sm font-bold text-accent-foreground shadow-[var(--shadow-gold)] glow-pulse"
        >
          <Receipt className="h-4 w-4" /> Bet Slip
          <span className="rounded-full bg-background/30 px-2 py-0.5 text-xs">{picks.length}</span>
        </button>
      )}
      {open && <BetSlipPanel />}
    </>
  );
}

function BetSlipPanel() {
  const { picks, setOpen, remove, clear, totalOdds } = useBetSlip();
  const { user, profile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [stake, setStake] = useState("2000000");
  const [placing, setPlacing] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [minStake, setMinStake] = useState(2000000);
  const [maxStake, setMaxStake] = useState(20000000);

  useEffect(() => {
    supabase.from("platform_settings").select("min_stake, max_stake").eq("id", 1).maybeSingle()
      .then(({ data }) => { if (data) { setMinStake(Number(data.min_stake) || 2000000); setMaxStake(Number(data.max_stake) || 20000000); } });
  }, []);

  const stakeNum = parseFloat(stake) || 0;
  const payout = stakeNum * totalOdds;

  const validate = (): string | null => {
    if (!user) { navigate({ to: "/login" }); return "login"; }
    if (picks.length === 0) return "Add a selection first";
    if (stakeNum < minStake) return `Minimum stake is ${formatTokens(minStake)} tokens`;
    if (stakeNum > maxStake) return `Maximum stake is ${formatTokens(maxStake)} tokens`;
    if ((profile?.token_balance ?? 0) < stakeNum) return "Insufficient balance";
    return null;
  };

  const onCheckout = () => {
    const err = validate();
    if (err === "login") return;
    if (err) { toast.error(err); return; }
    setConfirmOpen(true);
  };

  const place = async () => {
    setPlacing(true);
    const { error } = await supabase.rpc("place_bet", {
      _stake: stakeNum,
      _selections: picks.map((p) => ({ match_id: p.match_id, market: p.market, selection: p.selection, odds_value: p.odds_value })),
    });
    setPlacing(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Bet placed!");
    clear();
    setOpen(false);
    setConfirmOpen(false);
    refreshProfile();
    navigate({ to: "/dashboard" });
  };

  const adjust = (delta: number) => setStake(String(Math.max(0, (parseFloat(stake) || 0) + delta)));

  return (
    <>
      <div className="fixed inset-x-0 bottom-0 z-50 mx-auto w-full max-w-md sm:right-5 sm:left-auto sm:bottom-5 slide-in-right">
        <div className="glass-strong rounded-t-2xl sm:rounded-2xl p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Receipt className="h-4 w-4 text-accent" />
              <h3 className="font-bold">Bet Slip</h3>
              <span className="rounded-full bg-secondary px-2 py-0.5 text-xs tabular-nums">{picks.length}</span>
            </div>
            <div className="flex items-center gap-1">
              {picks.length > 0 && (
                <button onClick={clear} className="rounded p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground" aria-label="Clear all">
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
              <button onClick={() => setOpen(false)} className="rounded p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground" aria-label="Close">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="max-h-72 space-y-1.5 overflow-y-auto">
            {picks.map((p) => (
              <div key={p.match_id + p.market} className="flex items-center justify-between rounded-lg bg-secondary/60 p-2.5 text-sm rise-in">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs text-muted-foreground">{p.match_label}</div>
                  <div className="truncate font-semibold">{p.market} · <span className="text-primary">{p.selection}</span></div>
                </div>
                <div className="ml-2 flex items-center gap-2">
                  <span className="font-mono font-bold tabular-nums">{p.odds_value.toFixed(2)}</span>
                  <button onClick={() => remove(p.match_id, p.market)} className="rounded p-1 text-muted-foreground hover:bg-background hover:text-foreground" aria-label="Remove">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-3 space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Total odds</span>
              <span className="font-mono font-bold text-foreground tabular-nums">{totalOdds.toFixed(2)}</span>
            </div>
            <div className="flex items-center gap-1">
              <Button type="button" size="icon" variant="outline" onClick={() => adjust(-minStake)}><Minus className="h-3 w-3" /></Button>
              <Input type="number" min={minStake} step={minStake} value={stake} onChange={(e) => setStake(e.target.value)} placeholder={`Stake (min ${formatTokens(minStake)})`} className="text-base" />
              <Button type="button" size="icon" variant="outline" onClick={() => adjust(minStake)}><Plus className="h-3 w-3" /></Button>
            </div>
            <div className="text-[10px] text-muted-foreground text-right">Min {formatTokens(minStake)} · Max {formatTokens(maxStake)}</div>
            <div className="flex items-center justify-between rounded-lg bg-gold-gradient p-3 text-accent-foreground">
              <span className="text-xs font-semibold uppercase">Potential payout</span>
              <span className="font-mono text-lg font-extrabold tabular-nums">{formatTokens(payout)}</span>
            </div>
            <Button onClick={onCheckout} disabled={placing || picks.length === 0} className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-bold">
              {user ? "CHECKOUT" : "Login to bet"}
            </Button>
            {user && <div className="text-center text-xs text-muted-foreground">Balance: <span className="font-mono font-bold text-foreground">{formatTokens(profile?.token_balance ?? 0)}</span> · <Link to="/tokens" className="text-primary hover:underline">Get more</Link></div>}
          </div>
        </div>
      </div>

      <Dialog open={confirmOpen} onOpenChange={(v) => !placing && setConfirmOpen(v)}>
        <DialogContent className="glass-strong border-primary/20 backdrop-blur-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl brand">Confirm bet</DialogTitle>
            <DialogDescription>Tokens will be deducted from your wallet. Cashout is only available on winning slips after matches end.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 rounded-lg bg-secondary/40 p-3 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Selections</span><span className="font-bold">{picks.length}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Total odds</span><span className="font-mono font-bold">{totalOdds.toFixed(2)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Stake</span><span className="font-mono font-bold">{formatTokens(stakeNum)}</span></div>
            <div className="flex justify-between border-t border-white/5 pt-2"><span className="font-bold">Potential payout</span><span className="font-mono font-extrabold text-gold">{formatTokens(payout)}</span></div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmOpen(false)} disabled={placing}>Cancel</Button>
            <Button onClick={place} disabled={placing} className="bg-gold-gradient text-accent-foreground font-bold">
              {placing ? "Placing…" : "Confirm & Place Bet"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
