import { useEffect, useState } from "react";
import { Calendar, ChevronLeft, ChevronRight, Trophy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Countdown } from "@/components/Countdown";

interface Evt { id: string; title: string; description: string | null; image_url: string | null; countdown_to: string | null }

export function EventCountdownBanner() {
  const [events, setEvents] = useState<Evt[]>([]);
  const [idx, setIdx] = useState(0);

  const load = () =>
    supabase.from("events").select("*").eq("is_active", true).order("sort_order").then(({ data }) => setEvents((data ?? []) as Evt[]));

  useEffect(() => {
    load();
    const ch = supabase.channel("events-banner")
      .on("postgres_changes", { event: "*", schema: "public", table: "events" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  useEffect(() => {
    if (events.length < 2) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % events.length), 8000);
    return () => clearInterval(t);
  }, [events.length]);

  if (events.length === 0) return null;
  const e = events[idx];

  return (
    <section className="mb-6 relative overflow-hidden rounded-3xl glass-strong ring-1 ring-accent/30">
      <div className="relative h-64 sm:h-80">
        {e.image_url ? (
          <img src={e.image_url} alt={e.title} className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-primary/40 via-background to-accent/40" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/30" />
        {/* Gold shimmer */}
        <div className="pointer-events-none absolute -top-20 -right-20 h-72 w-72 rounded-full bg-accent/30 blur-3xl float-y" />

        <div className="relative z-10 flex h-full flex-col justify-between p-6 sm:p-10">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="mb-2 inline-flex items-center gap-1.5 rounded-full glass-gold px-3 py-1 text-[10px] font-black uppercase tracking-[0.25em] text-gold">
                <Calendar className="h-3 w-3" /> Event Countdown
              </div>
              <h2 className="text-2xl font-black leading-tight text-white drop-shadow-lg sm:text-4xl">
                {e.title}
              </h2>
              {e.description && (
                <p className="mt-2 max-w-xl text-sm text-white/80 line-clamp-2 sm:text-base">{e.description}</p>
              )}
            </div>
            <Trophy className="hidden h-16 w-16 text-accent/70 drop-shadow-2xl float-y sm:block" />
          </div>

          <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-end sm:justify-between">
            {e.countdown_to ? (
              <div className="rounded-2xl glass-gold px-5 py-3 backdrop-blur-xl">
                <div className="mb-1 text-[10px] font-black uppercase tracking-[0.3em] text-accent">Starts in</div>
                <Countdown to={e.countdown_to} gold />
              </div>
            ) : <div />}

            {events.length > 1 && (
              <div className="flex items-center gap-2">
                <button onClick={() => setIdx((i) => (i - 1 + events.length) % events.length)}
                  className="rounded-full glass p-2 text-white hover:bg-white/20" aria-label="Previous">
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <div className="flex gap-1">
                  {events.map((_, i) => (
                    <span key={i} className={`h-1.5 rounded-full transition-all ${i === idx ? "w-6 bg-accent" : "w-1.5 bg-white/40"}`} />
                  ))}
                </div>
                <button onClick={() => setIdx((i) => (i + 1) % events.length)}
                  className="rounded-full glass p-2 text-white hover:bg-white/20" aria-label="Next">
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
