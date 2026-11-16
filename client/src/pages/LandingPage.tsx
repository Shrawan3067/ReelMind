import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  Clapperboard,
  Search,
  Film,
  Sparkles,
  HardDrive,
  ShieldCheck,
  Zap,
  Layers,
  ArrowRight,
  CheckCircle2,
  Play,
  ArrowUp,
  Menu,
  X,
} from "lucide-react";
import { ThemeToggle } from "../components/ThemeToggle";

const NAV_ITEMS = [
  { id: "features", href: "#features", label: "Features" },
  { id: "how-it-works", href: "#how-it-works", label: "How It Works" },
  { id: "ugreen-nas", href: "#ugreen-nas", label: "UGREEN NAS" },
  { id: "use-cases", href: "#use-cases", label: "Use Cases" },
];

export function LandingPage() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<string>("");

  useEffect(() => {
    const handleScroll = () => {
      // 140px offset accounts for 76px navbar + top breathing room
      const scrollPos = window.scrollY + 140;

      // Bottom of page detection highlights the final section
      if (
        window.innerHeight + window.scrollY >=
        document.documentElement.scrollHeight - 60
      ) {
        setActiveSection("use-cases");
        return;
      }

      let current = "";
      for (const item of NAV_ITEMS) {
        const el = document.getElementById(item.id);
        if (el) {
          const top = el.offsetTop;
          if (scrollPos >= top) {
            current = item.id;
          }
        }
      }
      setActiveSection(current);
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("hashchange", handleScroll);
    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("hashchange", handleScroll);
    };
  }, []);

  return (
    <div className="min-h-screen bg-canvas text-ink pt-[76px] overflow-x-clip transition-colors">
      {/* Fixed Primary Navigation */}
      <nav className="fixed top-0 inset-x-0 z-40 navbar-surface border-b border-borderSubtle">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-[76px] flex items-center justify-between gap-2">
          <Link to="/" className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-gradient-to-br from-[#2563EB] to-[#06B6D4] flex items-center justify-center shadow-lg shadow-blue-600/25 shrink-0">
              <Clapperboard className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <span className="font-display font-bold text-lg sm:text-xl tracking-tight text-ink block truncate">
                ReelMind
              </span>
              <span className="hidden xs:block sm:block text-[11px] sm:text-xs font-bold uppercase tracking-wider text-cyan-700 dark:text-cyan-400 -mt-0.5 truncate">
                AI Video Studio
              </span>
            </div>
          </Link>

          <div className="hidden md:flex items-center gap-7 text-base font-medium text-ink-secondary">
            {NAV_ITEMS.map((item) => {
              const isActive = activeSection === item.id;
              return (
                <a
                  key={item.id}
                  href={item.href}
                  onClick={() => setActiveSection(item.id)}
                  className={`py-1.5 transition-colors border-b-2 ${
                    isActive
                      ? "text-blue-700 dark:text-blue-300 font-semibold border-[#3B82F6]"
                      : "text-ink-secondary hover:text-blue-600 dark:hover:text-blue-300 border-transparent font-medium"
                  }`}
                >
                  {item.label}
                </a>
              );
            })}
          </div>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <ThemeToggle compact />
            <Link
              to="/login"
              className="hidden sm:inline-flex items-center justify-center px-5 py-2.5 min-h-[44px] rounded-xl border border-borderSubtle bg-card hover:bg-hoverSurface text-sm sm:text-base font-semibold text-ink-secondary transition-colors"
            >
              Sign In
            </Link>
            <Link
              to="/register"
              className="inline-flex items-center justify-center px-3.5 sm:px-5 py-2.5 min-h-[44px] rounded-xl text-xs sm:text-base font-semibold bg-[#2563EB] hover:bg-[#1D4ED8] text-white transition-colors shadow-lg shadow-blue-600/25 whitespace-nowrap"
            >
              Start Creating
            </Link>
            <button
              type="button"
              onClick={() => setMobileNavOpen(o => !o)}
              aria-label={mobileNavOpen ? "Close menu" : "Open menu"}
              className="md:hidden w-11 h-11 flex items-center justify-center rounded-xl border border-borderStrong bg-card hover:bg-hoverSurface text-ink-secondary transition-colors"
            >
              {mobileNavOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Drawer Links */}
        {mobileNavOpen && (
          <div className="md:hidden border-t border-borderSubtle bg-surface px-4 py-4 space-y-2 shadow-elevated">
            {NAV_ITEMS.map((link) => {
              const isActive = activeSection === link.id;
              return (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => {
                    setActiveSection(link.id);
                    setMobileNavOpen(false);
                  }}
                  className={`flex items-center px-4 py-3 min-h-[44px] rounded-xl text-base transition-colors ${
                    isActive
                      ? "bg-[#3B82F6]/15 text-blue-700 dark:text-blue-300 border border-[#3B82F6]/30 font-semibold"
                      : "text-ink-secondary hover:text-ink hover:bg-card border border-transparent font-medium"
                  }`}
                >
                  {link.label}
                </a>
              );
            })}
            <div className="pt-2 border-t border-borderSubtle grid grid-cols-2 gap-2.5">
              <Link
                to="/login"
                onClick={() => setMobileNavOpen(false)}
                className="inline-flex items-center justify-center px-4 py-2.5 min-h-[44px] rounded-xl border border-borderSubtle bg-card hover:bg-hoverSurface text-sm font-semibold text-ink-secondary transition-colors"
              >
                Sign In
              </Link>
              <Link
                to="/register"
                onClick={() => setMobileNavOpen(false)}
                className="inline-flex items-center justify-center px-4 py-2.5 min-h-[44px] rounded-xl text-sm font-semibold bg-[#2563EB] hover:bg-[#1D4ED8] text-white transition-colors"
              >
                Start Creating
              </Link>
            </div>
          </div>
        )}
      </nav>

      {/* Hero Section */}
      <section className="relative pt-10 sm:pt-16 pb-14 sm:pb-16 px-4 sm:px-6 bg-canvas border-b border-borderSubtle">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-12 gap-8 items-end">
            <div className="lg:col-span-8 space-y-5">
              <div className="flex flex-wrap items-center gap-3 text-xs sm:text-sm font-bold uppercase tracking-wider">
                <span className="text-blue-700 dark:text-blue-300">ReelMind AI Media Studio</span>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 normal-case tracking-normal font-semibold text-xs sm:text-sm">
                  <ShieldCheck className="w-4 h-4" /> Uliya Standard Verified
                </span>
              </div>

              <h1 className="font-display text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight leading-[1.1] text-ink">
                Your Media Library Just Became Your{" "}
                <span className="bg-gradient-to-r from-[#2563EB] via-[#3B82F6] to-[#0891B2] dark:from-[#60A5FA] dark:via-[#3B82F6] dark:to-[#06B6D4] bg-clip-text text-transparent">
                  Creative Director.
                </span>
              </h1>

              <p className="text-lg sm:text-xl text-ink-secondary max-w-2xl leading-relaxed">
                Search thousands of videos with natural language. Discover the
                perfect moments. Create intelligent storyboards in minutes.
              </p>
            </div>

            <div className="lg:col-span-4 flex flex-wrap lg:justify-end gap-3.5">
              <Link
                to="/register"
                className="inline-flex items-center justify-center gap-2.5 px-7 py-3.5 min-h-[52px] rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-base font-semibold transition-all shadow-lg shadow-blue-600/25"
              >
                <Sparkles className="w-5 h-5" />
                Start Creating
              </Link>
              <a
                href="#features"
                className="inline-flex items-center justify-center gap-2.5 px-7 py-3.5 min-h-[52px] rounded-xl bg-card hover:bg-hoverSurface border border-borderSubtle text-ink-secondary text-base font-semibold transition-all"
              >
                Explore Features
              </a>
            </div>
          </div>

          {/* Showcase Preview Panel */}
          <div className="mt-12 rounded-2xl bg-surface border border-borderSubtle p-5 sm:p-6 shadow-elevated">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-4 mb-5 border-b border-borderSubtle">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-rose-500/80" />
                <div className="w-3 h-3 rounded-full bg-amber-400/80" />
                <div className="w-3 h-3 rounded-full bg-emerald-400/80" />
                <span className="ml-2 text-xs sm:text-sm font-mono text-ink-muted font-medium">
                  ReelMind Studio • Prompt-to-Storyboard Pipeline
                </span>
              </div>
              <span className="text-xs sm:text-sm px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 font-semibold">
                150 Indexed Assets Ready
              </span>
            </div>

            <div className="grid lg:grid-cols-3 gap-5">
              <div className="lg:col-span-2 rounded-xl bg-card border border-borderSubtle p-5 space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-2 text-xs sm:text-sm text-blue-700 dark:text-blue-300 font-bold uppercase tracking-wider">
                    <Search className="w-4 h-4" />
                    Natural Language Query
                  </span>
                  <span className="text-xs sm:text-sm font-semibold text-cyan-700 dark:text-cyan-400">
                    Hybrid Semantic Vector
                  </span>
                </div>
                <p className="font-mono text-sm sm:text-base text-ink-secondary bg-surface dark:bg-[#090B10]/80 rounded-xl px-4 py-3.5 border border-borderSubtle">
                  "Find every clip where the dog jumps into the swimming pool
                  and create a 30-second cinematic video."
                </p>

                <div className="grid sm:grid-cols-2 gap-3.5">
                  {[
                    {
                      code: "SCN-01",
                      file: "dog_pool_01.mp4",
                      ts: "00:12–00:17",
                      desc: "Golden retriever approaching the pool edge",
                      score: "96%",
                    },
                    {
                      code: "SCN-02",
                      file: "dog_pool_02.mp4",
                      ts: "00:24–00:31",
                      desc: "Dog crouching playfully, preparing to jump",
                      score: "94%",
                    },
                    {
                      code: "SCN-03",
                      file: "dog_pool_03.mp4",
                      ts: "00:05–00:13",
                      desc: "Mid-air leap into sparkling pool water splash",
                      score: "98%",
                    },
                    {
                      code: "SCN-04",
                      file: "dog_pool_04.mp4",
                      ts: "00:40–00:50",
                      desc: "Swimming joyfully in summer sunlight",
                      score: "93%",
                    },
                  ].map((clip) => (
                    <div
                      key={clip.file}
                      className="p-4 rounded-xl bg-surface dark:bg-[#090B10]/80 border border-borderSubtle hover:border-[#3B82F6]/50 flex flex-col justify-between transition-colors"
                    >
                      <div className="flex items-center justify-between text-xs mb-2.5">
                        <span className="px-2.5 py-0.5 rounded bg-[#3B82F6]/15 text-blue-700 dark:text-blue-300 border border-[#3B82F6]/30 font-mono text-xs font-bold">
                          {clip.code}
                        </span>
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border border-cyan-500/20 text-xs font-semibold">
                          {clip.score} Match
                        </span>
                      </div>
                      <p className="text-sm sm:text-base font-bold text-ink mb-1.5">
                        {clip.file}
                      </p>
                      <p className="text-xs sm:text-sm text-ink-secondary mb-3 leading-relaxed bg-card dark:bg-[#11151D] p-2.5 rounded-lg border border-borderSubtle">
                        {clip.desc}
                      </p>
                      <div className="flex items-center justify-between text-xs font-mono text-cyan-700 dark:text-cyan-400 font-semibold pt-2.5 border-t border-borderSubtle">
                        <span>TS: {clip.ts}</span>
                        <Play className="w-3.5 h-3.5 text-[#3B82F6] dark:text-[#60A5FA]" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-xl bg-card border border-borderSubtle p-5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-3.5">
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-cyan-700 dark:text-cyan-400">
                      <Film className="w-4 h-4" />
                      Production Output
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs font-semibold">
                      Validated
                    </span>
                  </div>
                  <h3 className="font-display font-bold text-xl text-ink mb-1">
                    Summer Pool Adventure
                  </h3>
                  <p className="text-sm text-ink-muted mb-5">
                    30.0s • 16:9 YouTube • Playful & Joyful
                  </p>
                  <div className="space-y-3 text-sm bg-surface dark:bg-[#090B10]/80 p-4 rounded-xl border border-borderSubtle">
                    <div className="flex justify-between py-2 border-b border-borderSubtle">
                      <span className="text-ink-muted">
                        Verified Timestamps
                      </span>
                      <span className="text-emerald-700 dark:text-emerald-400 font-semibold">
                        100% Bounded
                      </span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-borderSubtle">
                      <span className="text-ink-muted">Ranking Engine</span>
                      <span className="text-ink font-semibold">
                        Multi-Factor
                      </span>
                    </div>
                    <div className="flex justify-between py-2">
                      <span className="text-ink-muted">Export Manifests</span>
                      <span className="text-cyan-700 dark:text-cyan-400 font-semibold font-mono">
                        JSON & CMX3600 EDL
                      </span>
                    </div>
                  </div>
                </div>
                <Link
                  to="/login"
                  className="mt-6 w-full inline-flex items-center justify-center py-3 min-h-[46px] rounded-xl bg-[#3B82F6]/15 hover:bg-[#3B82F6]/25 dark:bg-[#3B82F6]/20 dark:hover:bg-[#3B82F6]/30 border border-[#3B82F6]/40 text-blue-700 dark:text-blue-200 text-center text-sm sm:text-base font-semibold transition-colors"
                >
                  Open Interactive Editor →
                </Link>
              </div>
            </div>
          </div>

          {/* Callout Banner */}
          <div className="mt-8 rounded-2xl bg-gradient-to-r from-[#1D4ED8] via-[#2563EB] to-[#0891B2] p-6 sm:p-8 text-white flex flex-col md:flex-row md:items-center justify-between gap-5 border border-white/10 shadow-xl shadow-blue-600/20">
            <div className="space-y-1.5">
              <p className="text-xs sm:text-sm font-bold uppercase tracking-widest text-cyan-100">
                ⚡ AUTONOMOUS AI CREATIVE DIRECTOR
              </p>
              <h2 className="font-display font-bold text-2xl sm:text-3xl text-white">
                Turn raw NAS folders into a timeline in 30 seconds.
              </h2>
              <p className="text-sm sm:text-base text-blue-100">
                Describe any mood, scene, or dialogue query to rank matching
                clips and assemble verified storyboards.
              </p>
            </div>
            <Link
              to="/register"
              className="inline-flex items-center justify-center gap-2.5 px-6 py-3.5 min-h-[50px] rounded-xl bg-[#090B10] hover:bg-[#11151D] border border-white/20 text-white text-sm sm:text-base font-bold shrink-0 shadow-lg shadow-black/25 transition-colors"
            >
              Launch Studio <ArrowRight className="w-4 h-4 text-cyan-400" />
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-16 px-6 bg-surface/60">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10">
            <div>
              <span className="inline-block text-xs sm:text-sm font-bold uppercase tracking-widest text-cyan-700 dark:text-cyan-400 mb-1.5">
                Studio Capabilities
              </span>
              <h2 className="font-display text-3xl sm:text-4xl font-bold text-ink">
                Built for Real Media Archives
              </h2>
            </div>
            <p className="text-ink-muted max-w-md text-sm sm:text-base leading-relaxed">
              Every subsystem is engineered for reliability, verifiable source
              evidence, and creative speed.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-5">
            {[
              {
                code: "MOD-01",
                icon: Search,
                title: "Hybrid Semantic Search",
                desc: "Combines dense semantic embeddings, lexical keyword matching, and audio transcript indexing with explicit match explanations.",
              },
              {
                code: "MOD-02",
                icon: Layers,
                title: "Smart Clip Ranking",
                desc: "Evaluates relevance, resolution, quality, audio suitability, and diversity with dynamic weight renormalization.",
              },
              {
                code: "MOD-03",
                icon: Film,
                title: "Interactive Timeline Editor",
                desc: "Trim in/out points, reorder scenes, regenerate individual shots, switch aspect ratios, and export JSON or EDL plans.",
              },
              {
                code: "MOD-04",
                icon: Sparkles,
                title: "AI Content Studio",
                desc: "Generates platform-tailored titles, hooks, hashtags, descriptions, and scene-by-scene narration grounded in your selected clips.",
              },
              {
                code: "MOD-05",
                icon: Zap,
                title: "Async Media Pipeline",
                desc: "Non-blocking background job queue with Socket.IO live progress, SHA-256 duplicate detection, and retry handling.",
              },
              {
                code: "MOD-06",
                icon: ShieldCheck,
                title: "Zero Fabrication Policy",
                desc: "Strict Zod schema validation enforces source clip boundaries. Demo files are clearly isolated and never masked as real NAS data.",
              },
            ].map((f) => {
              const Icon = f.icon;
              return (
                <div
                  key={f.title}
                  className="p-6 rounded-2xl bg-card border border-borderSubtle hover:border-[#3B82F6]/45 shadow-card transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <span className="px-2.5 py-0.5 rounded bg-[#3B82F6]/15 text-blue-700 dark:text-blue-300 border border-[#3B82F6]/30 font-mono text-xs font-bold">
                        {f.code}
                      </span>
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border border-cyan-500/25 text-xs font-semibold">
                        Verified Module
                      </span>
                    </div>
                    <div className="w-11 h-11 rounded-xl bg-[#3B82F6]/15 border border-[#3B82F6]/30 flex items-center justify-center mb-3.5">
                      <Icon className="w-5 h-5 text-[#3B82F6]" />
                    </div>
                    <h3 className="font-display font-bold text-lg sm:text-xl text-ink mb-2.5">
                      {f.title}
                    </h3>
                    <div className="p-3.5 rounded-xl bg-surface border border-borderSubtle">
                      <p className="text-sm text-ink-secondary leading-relaxed">
                        {f.desc}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section
        id="how-it-works"
        className="py-16 px-6 bg-canvas border-t border-borderSubtle"
      >
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10">
            <span className="inline-block text-xs sm:text-sm font-bold uppercase tracking-widest text-blue-600 dark:text-blue-400 mb-1.5">
              End-to-End Pipeline
            </span>
            <h2 className="font-display text-3xl sm:text-4xl font-bold text-ink">
              Autonomous Creative Workflow
            </h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              {
                step: "01",
                title: "Connect & Index",
                desc: "Pair your UGREEN NAS, upload footage, or load the isolated 150-asset demo library.",
              },
              {
                step: "02",
                title: "Search Naturally",
                desc: "Ask for specific actions, objects, moods, or spoken dialogue across your archive.",
              },
              {
                step: "03",
                title: "Direct & Assemble",
                desc: "ReelMind ranks top candidates and generates a timestamp-validated storyboard.",
              },
              {
                step: "04",
                title: "Refine & Publish",
                desc: "Trim scenes, customize captions, export NLE plans, and generate social copy.",
              },
            ].map((item) => (
              <div
                key={item.step}
                className="p-5 sm:p-6 rounded-2xl bg-card border border-borderSubtle hover:border-cyan-500/40 shadow-card transition-colors"
              >
                <span className="inline-block px-3 py-1 rounded-md bg-cyan-500/10 border border-cyan-500/25 font-mono text-xs font-bold text-cyan-700 dark:text-cyan-300">
                  {item.step}
                </span>
                <h3 className="font-display font-bold text-lg text-ink mt-3.5 mb-2">
                  {item.title}
                </h3>
                <p className="text-sm text-ink-muted leading-relaxed">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* UGREEN NAS Integration */}
      <section
        id="ugreen-nas"
        className="py-16 px-6 border-t border-borderSubtle bg-surface/60"
      >
        <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-10 items-center">
          <div>
            <div className="inline-flex items-center gap-2 text-xs sm:text-sm font-bold text-cyan-700 dark:text-cyan-400 uppercase tracking-wider mb-3">
              <HardDrive className="w-4 h-4" />
              UGREEN AI NAS Architecture
            </div>
            <h2 className="font-display text-3xl sm:text-4xl font-bold text-ink mb-4">
              Built Strictly to the Official Uliya Skill Standard
            </h2>
            <p className="text-base text-ink-secondary leading-relaxed mb-6">
              ReelMind separates the lightweight UGREEN Uliya Skill
              specification (`SKILL.md`) from the heavy MERN processing backend,
              ensuring clean read-only media discovery and zero unauthorized
              runtime bloat on your NAS.
            </p>
            <ul className="space-y-3.5 text-sm sm:text-base text-ink-secondary">
              <li className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                Non-destructive indexing — original NAS files are never
                auto-deleted.
              </li>
              <li className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                Encrypted credential storage with AES-256-GCM on the application
                server.
              </li>
              <li className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                Provider-independent AI layer supporting OpenAI, Gemini,
                Anthropic, Ollama, and deterministic offline fallback.
              </li>
            </ul>
          </div>
          <div className="p-6 rounded-2xl bg-card border border-borderSubtle shadow-elevated font-mono text-xs sm:text-sm text-ink-secondary space-y-3">
            <p className="text-cyan-700 dark:text-cyan-400 font-bold">
              skills/reelmind-studio/SKILL.md
            </p>
            <div className="p-4 rounded-xl bg-canvas border border-borderSubtle text-ink-secondary leading-relaxed">
              ---
              <br />
              name: reelmind-studio
              <br />
              description: AI media discovery and storyboard orchestration skill
              for UGREEN AI NAS.
              <br />
              ---
              <br />
              <br />
              # Expert Agent Orchestration
              <br />
              1. Discover authorized share media
              <br />
              2. Query local semantic index
              <br />
              3. Assemble validated production storyboard
            </div>
          </div>
        </div>
      </section>

      {/* Use Cases */}
      <section
        id="use-cases"
        className="py-16 px-6 bg-canvas border-t border-borderSubtle"
      >
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-10">
            <span className="inline-block text-xs sm:text-sm font-bold uppercase tracking-widest text-blue-600 dark:text-blue-400 mb-1.5">
              Ready Workflows
            </span>
            <h2 className="font-display text-3xl sm:text-4xl font-bold text-ink">
              Three Signature Scenarios Ready Out of the Box
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                tag: "Family & Memories",
                title: "Dog Swimming Pool Cut",
                prompt:
                  '"Create a 30-second cinematic video of a dog enjoying a swimming pool."',
              },
              {
                tag: "Travel & Vlogging",
                title: "Beach, Mountain & Sunset Montage",
                prompt:
                  '"Create a 30-second travel montage using beach, mountain, bicycle, and sunset footage."',
              },
              {
                tag: "Brand & Commercial",
                title: "Studio Product Ad",
                prompt:
                  '"Create a 20-second vertical product advertisement showcase for modern studio hardware."',
              },
            ].map((uc) => (
              <div
                key={uc.title}
                className="p-6 rounded-2xl bg-card border border-borderSubtle hover:border-[#3B82F6]/45 shadow-card flex flex-col justify-between transition-colors"
              >
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-cyan-700 dark:text-cyan-400">
                    {uc.tag}
                  </span>
                  <h3 className="font-display font-bold text-xl text-ink mt-2 mb-3.5">
                    {uc.title}
                  </h3>
                </div>
                <p className="text-sm font-mono text-ink-secondary bg-surface p-4 rounded-xl border border-borderSubtle leading-relaxed">
                  {uc.prompt}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer Section */}
      <footer className="bg-surface text-ink border-t border-borderSubtle">
        <div className="bg-card border-b border-borderSubtle">
          <div className="max-w-6xl mx-auto px-6 py-6 grid sm:grid-cols-3 gap-4 items-center">
            <div>
              <p className="text-xs font-semibold text-ink-muted">
                AI Processing Architecture
              </p>
              <p className="text-sm sm:text-base font-bold text-ink">
                FFprobe + Semantic Search + Storyboard Validator
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold text-ink-muted">
                UGREEN Uliya Standard
              </p>
              <p className="text-sm sm:text-base font-bold text-ink">
                skills/reelmind-studio/SKILL.md
              </p>
            </div>
            <div className="sm:text-right">
              <Link
                to="/register"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 min-h-[46px] rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-sm sm:text-base font-bold transition-colors shadow-lg shadow-blue-600/25"
              >
                Launch ReelMind Studio <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>

        <div className="max-w-6xl mx-auto px-6 py-12 grid md:grid-cols-4 gap-8">
          <div className="md:col-span-2 space-y-3.5">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#2563EB] to-[#06B6D4] flex items-center justify-center shadow-lg shadow-blue-600/25">
                <Clapperboard className="w-4 h-4 text-white" />
              </div>
              <div>
                <span className="font-display font-bold text-lg text-ink">
                  ReelMind Studio
                </span>
                <span className="block text-xs text-cyan-700 dark:text-cyan-400 font-medium">
                  Autonomous AI Media Production
                </span>
              </div>
            </div>
            <p className="text-sm text-ink-muted max-w-md leading-relaxed">
              Your entire media library transformed into a semantic search
              engine, smart clip director, validated storyboard timeline, and
              grounded social publishing studio.
            </p>
          </div>

          <div className="space-y-2.5 text-sm">
            <p className="font-bold text-ink uppercase tracking-wider text-xs">
              Workspace
            </p>
            <div className="flex flex-col gap-2 text-ink-muted">
              <a
                href="#features"
                className="hover:text-ink transition-colors"
              >
                Features
              </a>
              <a
                href="#how-it-works"
                className="hover:text-ink transition-colors"
              >
                How It Works
              </a>
              <a
                href="#ugreen-nas"
                className="hover:text-ink transition-colors"
              >
                UGREEN NAS Standard
              </a>
              <a
                href="#use-cases"
                className="hover:text-ink transition-colors"
              >
                Signature Scenarios
              </a>
            </div>
          </div>

          <div className="space-y-2.5 text-sm">
            <p className="font-bold text-ink uppercase tracking-wider text-xs">
              Get Started
            </p>
            <div className="flex flex-col gap-2 text-ink-muted">
              <Link to="/login" className="hover:text-ink transition-colors">
                Sign In to Studio
              </Link>
              <Link
                to="/register"
                className="hover:text-ink transition-colors"
              >
                Create Account
              </Link>
            </div>
          </div>
        </div>

        <div className="border-t border-borderSubtle bg-canvas">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-5 flex flex-wrap items-center justify-between gap-4 text-xs sm:text-sm text-ink-muted">
            <span>
              ReelMind — Autonomous AI Video Studio • Built for UGREEN AI NAS
              Hackathon 2026
            </span>
            <a
              href="#"
              aria-label="Back to top"
              className="w-10 h-10 rounded-full bg-[#2563EB] hover:bg-[#1D4ED8] flex items-center justify-center text-white transition-colors shadow-lg shadow-blue-600/25"
            >
              <ArrowUp className="w-4 h-4" />
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
