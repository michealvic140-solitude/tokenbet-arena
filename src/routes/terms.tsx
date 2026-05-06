import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ScrollText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/terms")({
  head: () => ({ meta: [{ title: "Terms & Conditions — LSL" }] }),
  component: TermsPage,
});

interface Section { id: string; category: string; title: string; body: string; sort_order: number }

function TermsPage() {
  const [sections, setSections] = useState<Section[]>([]);

  useEffect(() => {
    supabase.from("terms_sections").select("*").eq("is_active", true).order("sort_order").then(({ data }) =>
      setSections((data ?? []) as Section[]));
  }, []);

  const grouped = sections.reduce<Record<string, Section[]>>((acc, s) => {
    (acc[s.category] ||= []).push(s); return acc;
  }, {});

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <div className="mb-6 text-center">
        <div className="mx-auto mb-3 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gold-gradient shadow-[var(--shadow-gold)]">
          <ScrollText className="h-7 w-7 text-accent-foreground" />
        </div>
        <h1 className="text-3xl font-black brand">Terms & Conditions</h1>
        <p className="mt-1 text-sm text-muted-foreground">By using LOMITA SHOOTERS LEAGUE you agree to the following.</p>
      </div>
      {sections.length === 0 ? (
        <div className="glass-strong rounded-2xl p-6 text-sm leading-relaxed text-muted-foreground">
          <h2 className="mb-2 text-lg font-bold text-foreground">General</h2>
          <p>This platform uses <strong>virtual tokens only</strong> — no real money is deposited or withdrawn. All winnings, cashouts, and payouts are paid in virtual tokens. Maximum payout per bet is capped at 60,000,000 tokens. Identical duplicate bets on the same match are not allowed.</p>
          <p className="mt-3">Admin manually controls match creation, settlement, and token grants. Audit logs are kept for transparency. Banned users may submit appeals from the login screen.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(grouped).map(([cat, items]) => (
            <div key={cat} className="glass-strong rounded-2xl p-6">
              <h2 className="mb-3 text-xl font-black brand uppercase tracking-wider">{cat}</h2>
              <div className="space-y-3">
                {items.map((s) => (
                  <div key={s.id}>
                    <h3 className="font-bold text-foreground">{s.title}</h3>
                    <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">{s.body}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
