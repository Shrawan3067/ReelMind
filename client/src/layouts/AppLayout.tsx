import { useState } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { useQuery } from "@tanstack/react-query";
import {
  LayoutDashboard,
  FolderKanban,
  Search,
  Film,
  Sparkles,
  Activity,
  Settings,
  LogOut,
  HardDrive,
  Menu,
  X,
  Clapperboard,
} from "lucide-react";
import { RootState } from "../store";
import { clearCredentials } from "../store/authSlice";
import { api } from "../services/api";
import { useSocket } from "../hooks/useSocket";
import { ThemeToggle } from "../components/ThemeToggle";

export function AppLayout() {
  useSocket();
  const [mobileOpen, setMobileOpen] = useState(false);
  const user = useSelector((state: RootState) => state.auth.user);
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const { data: nasData } = useQuery({
    queryKey: ["nas-status"],
    queryFn: async () => {
      const res = await api.get("/nas/status");
      return res.data.data;
    },
    refetchInterval: 60000,
  });

  const handleLogout = async () => {
    try {
      await api.post("/auth/logout");
    } catch {
      // Ignore error on logout
    }
    dispatch(clearCredentials());
    navigate("/login");
  };

  const navItems = [
    { to: "/app/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { to: "/app/library", label: "Media Library", icon: FolderKanban },
    { to: "/app/search", label: "AI Search Studio", icon: Search },
    { to: "/app/storyboard", label: "Storyboard Studio", icon: Film },
    { to: "/app/content", label: "Content Studio", icon: Sparkles },
    { to: "/app/processing", label: "Processing Center", icon: Activity },
    { to: "/app/settings", label: "Settings & NAS", icon: Settings },
  ];

  const nasConnected = Boolean(nasData?.connected);

  return (
    <div className="min-h-screen bg-canvas text-ink overflow-x-clip">
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-30 bg-black/70 backdrop-blur-sm lg:hidden"
        />
      )}

      {/* Fixed Sidebar (Desktop + Mobile Drawer) */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 max-w-[85vw] h-screen bg-surface border-r border-borderSubtle flex flex-col transition-transform duration-200 lg:translate-x-0 ${
          mobileOpen
            ? "translate-x-0 shadow-2xl shadow-black/60"
            : "-translate-x-full"
        }`}
      >
        <div className="h-[72px] shrink-0 px-5 flex items-center justify-between">
          <Link to="/app/dashboard" className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#2563EB] to-[#06B6D4] flex items-center justify-center shadow-lg shadow-blue-600/25">
              <Clapperboard className="w-4 h-4 text-white" />
            </div>
            <div>
              <span className="font-display font-bold text-lg tracking-tight text-ink">
                ReelMind
              </span>
              <span className="block text-xs font-bold uppercase tracking-wider text-cyan-600 dark:text-cyan-400 -mt-0.5">
                AI Video Studio
              </span>
            </div>
          </Link>
          <button
            onClick={() => setMobileOpen(false)}
            className="lg:hidden w-10 h-10 flex items-center justify-center rounded-xl text-ink-muted hover:text-ink hover:bg-hoverSurface transition-colors"
            aria-label="Close navigation"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 min-h-0 px-3 py-4 space-y-1.5 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-3 min-h-[44px] rounded-xl text-sm sm:text-base whitespace-nowrap transition-all ${
                    isActive
                      ? "bg-[#3B82F6]/15 text-blue-700 dark:text-blue-300 border border-[#3B82F6]/30 font-semibold shadow-sm"
                      : "text-ink-secondary font-medium border border-transparent hover:text-ink hover:bg-card"
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon
                      className={`w-4 h-4 shrink-0 ${isActive ? "text-[#3B82F6]" : "text-ink-muted"}`}
                    />
                    <span className="truncate">{item.label}</span>
                  </>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* NAS Status Mini Card + Profile Footer */}
        <div className="shrink-0 p-3.5 border-t border-borderSubtle space-y-3.5 bg-canvas/50">
          <Link
            to="/app/settings"
            className="block p-3.5 rounded-xl bg-card border border-borderSubtle hover:border-[#3B82F6]/50 transition-colors shadow-sm"
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="flex items-center gap-1.5 text-sm font-semibold text-ink">
                <HardDrive className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                UGREEN NAS
              </span>
              <span
                className={`inline-flex items-center gap-1.5 text-[12px] px-1.5 py-0.5 rounded-full border ${
                  nasConnected
                    ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/25"
                    : "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/25"
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${nasConnected ? "bg-emerald-500 dark:bg-emerald-400" : "bg-amber-500 dark:bg-amber-400"}`}
                />
                {nasConnected ? "Connected" : "Demo"}
              </span>
            </div>
            <p className="text-xs text-ink-muted truncate">
              {nasConnected
                ? nasData?.configuration?.host || "UGOS Share Ready"
                : "NAS disconnected • Click to pair"}
            </p>
          </Link>

          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-full bg-[#3B82F6]/15 border border-[#3B82F6]/30 flex items-center justify-center text-sm font-bold text-blue-700 dark:text-blue-300 shrink-0">
                {user?.name?.charAt(0).toUpperCase() || "U"}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-ink truncate">
                  {user?.name}
                </p>
                <p className="text-xs text-ink-muted truncate">{user?.email}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              title="Log out"
              aria-label="Log out"
              className="w-10 h-10 flex items-center justify-center rounded-xl text-ink-muted hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-500/10 transition-colors shrink-0"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Fixed Top Navbar */}
      <header className="fixed top-0 right-0 left-0 lg:left-64 z-30 h-[72px] px-3.5 sm:px-6 lg:px-8 border-b border-borderSubtle navbar-surface flex items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setMobileOpen(true)}
            className="lg:hidden w-10 h-10 flex items-center justify-center rounded-xl text-ink-secondary hover:bg-card transition-colors"
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5" />
          </button>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <ThemeToggle compactOnMobile />
          <Link
            to="/app/search"
            className="inline-flex items-center justify-center gap-2 px-3.5 sm:px-6 py-2.5 min-h-[44px] sm:min-h-[46px] rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs sm:text-base font-semibold transition-colors shadow-lg shadow-blue-600/25 whitespace-nowrap"
          >
            <Sparkles className="w-4 h-4 shrink-0" />
            <span className="sm:hidden">New Cut</span>
            <span className="hidden sm:inline">New AI Storyboard</span>
          </Link>
        </div>
      </header>

      {/* Main Content Area offset for fixed Sidebar & Navbar */}
      <main className="lg:pl-64 pt-[72px] min-h-screen flex flex-col min-w-0">
        <div className="flex-1 p-3.5 sm:p-5 lg:p-8 min-w-0">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
