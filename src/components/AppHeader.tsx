import { Link, useNavigate } from "@tanstack/react-router";
import { Coins, LogIn, LogOut, Menu, Shield, User as UserIcon, Trophy } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { formatTokens } from "@/lib/format";
import { Button } from "@/components/ui/button";

export function AppHeader() {
  const { user, profile, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const handleLogout = async () => {
    await signOut();
    navigate({ to: "/" });
  };

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-sidebar/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4">
        <button className="md:hidden" onClick={() => setOpen(!open)} aria-label="Menu">
          <Menu className="h-5 w-5" />
        </button>
        <Link to="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md" style={{ background: "var(--gradient-primary)" }}>
            <Trophy className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="text-lg font-extrabold tracking-tight">
            LOMITA<span className="text-primary">BET</span>
          </span>
        </Link>

        <nav className="ml-4 hidden items-center gap-1 md:flex">
          <NavLink to="/">Sports</NavLink>
          <NavLink to="/live">Live</NavLink>
          <NavLink to="/dashboard">My Bets</NavLink>
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {user ? (
            <>
              <Link to="/tokens" className="hidden items-center gap-1.5 rounded-md bg-secondary px-3 py-1.5 text-sm font-semibold sm:flex">
                <Coins className="h-4 w-4 text-accent" />
                <span className="tabular-nums">{formatTokens(profile?.token_balance ?? 0)}</span>
              </Link>
              {isAdmin && (
                <Link to="/admin" className="hidden md:block">
                  <Button size="sm" variant="outline" className="gap-1"><Shield className="h-3.5 w-3.5" /> Admin</Button>
                </Link>
              )}
              <Link to="/dashboard" className="rounded-full bg-secondary p-2" aria-label="Profile">
                <UserIcon className="h-4 w-4" />
              </Link>
              <Button size="sm" variant="ghost" onClick={handleLogout} aria-label="Sign out">
                <LogOut className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <>
              <Link to="/login"><Button size="sm" variant="ghost" className="gap-1"><LogIn className="h-4 w-4" /> Login</Button></Link>
              <Link to="/register"><Button size="sm">Register</Button></Link>
            </>
          )}
        </div>
      </div>

      {open && (
        <nav className="border-t border-border bg-sidebar px-4 py-2 md:hidden">
          <div className="flex flex-col gap-1">
            <NavLink to="/" onClick={() => setOpen(false)}>Sports</NavLink>
            <NavLink to="/live" onClick={() => setOpen(false)}>Live</NavLink>
            <NavLink to="/dashboard" onClick={() => setOpen(false)}>My Bets</NavLink>
            <NavLink to="/tokens" onClick={() => setOpen(false)}>Tokens</NavLink>
            {isAdmin && <NavLink to="/admin" onClick={() => setOpen(false)}>Admin</NavLink>}
          </div>
        </nav>
      )}
    </header>
  );
}

function NavLink({ to, children, onClick }: { to: string; children: React.ReactNode; onClick?: () => void }) {
  return (
    <Link
      to={to}
      onClick={onClick}
      activeProps={{ className: "bg-secondary text-foreground" }}
      activeOptions={{ exact: to === "/" }}
      className="rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground"
    >
      {children}
    </Link>
  );
}
