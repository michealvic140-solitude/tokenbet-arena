import { Outlet, createRootRoute, HeadContent, Scripts, Link } from "@tanstack/react-router";
import appCss from "../styles.css?url";
import { AuthProvider } from "@/lib/auth";
import { AppHeader } from "@/components/AppHeader";
import { Toaster } from "@/components/ui/sonner";
import { BetSlipProvider } from "@/lib/betslip";
import { BetSlipFab } from "@/components/BetSlip";
import { AnimatedBackground } from "@/components/AnimatedBackground";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-black brand">404</h1>
        <h2 className="mt-4 text-xl font-semibold">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">The page you're looking for doesn't exist.</p>
        <div className="mt-6">
          <Link to="/" className="inline-flex items-center rounded-lg bg-gold-gradient px-4 py-2 text-sm font-bold text-accent-foreground hover:opacity-90">
            Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "SHOOTERS BET — Luxury Sports Betting with Virtual Tokens" },
      { name: "description", content: "Place bets, cashout, and chase wins on SHOOTERS BET — the luxury virtual-token sports betting platform." },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head><HeadContent /></head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  return (
    <AuthProvider>
      <BetSlipProvider>
        <AnimatedBackground />
        <div className="relative z-10 flex min-h-screen flex-col">
          <AppHeader />
          <main className="flex-1"><Outlet /></main>
        </div>
        <BetSlipFab />
        <Toaster theme="dark" position="top-right" />
      </BetSlipProvider>
    </AuthProvider>
  );
}
