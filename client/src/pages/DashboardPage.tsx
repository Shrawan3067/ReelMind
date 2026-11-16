import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useDispatch, useSelector } from "react-redux";
import {
  Video,
  Database,
  Cpu,
  Sparkles,
  Search,
  Film,
  HardDrive,
  ArrowRight,
  Loader2,
  FolderPlus,
  Clock,
  Activity,
  AlertCircle,
  RefreshCw,
  Wand2,
  Layers,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
} from "recharts";
import { AspectRatio } from "@reelmind/shared";
import { api } from "../services/api";
import { RootState } from "../store";
import { addToast } from "../store/studioSlice";

function formatBytes(bytes: number): string {
  if (!bytes) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

function formatTotalDuration(totalSec: number): string {
  if (!totalSec || totalSec <= 0) return "0s";
  const hrs = Math.floor(totalSec / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = Math.floor(totalSec % 60);
  if (hrs > 0) return `${hrs}h ${mins}m`;
  if (mins > 0) return `${mins}m ${secs}s`;
  return `${secs}s`;
}

const SCENARIO_PRESETS: Array<{
  label: string;
  prompt: string;
  duration: number;
  aspectRatio: AspectRatio;
}> = [
  {
    label: "Dog Swimming Pool",
    prompt:
      "Create a 30-second cinematic video of a dog enjoying a swimming pool.",
    duration: 30,
    aspectRatio: "16:9",
  },
  {
    label: "Beach & Sunset Montage",
    prompt:
      "Create a 30-second travel montage using beach, mountain, bicycle, and sunset footage.",
    duration: 30,
    aspectRatio: "16:9",
  },
  {
    label: "Vertical Product Ad",
    prompt:
      "Create a 20-second vertical product advertisement showcase for studio hardware.",
    duration: 20,
    aspectRatio: "9:16",
  },
];

export function DashboardPage() {
  const [quickPrompt, setQuickPrompt] = useState(SCENARIO_PRESETS[0].prompt);
  const [targetDuration, setTargetDuration] = useState(30);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("16:9");

  const user = useSelector((state: RootState) => state.auth.user);
  const theme = useSelector((state: RootState) => state.studio.theme);
  const isDark = theme === "dark";
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const dispatch = useDispatch();

  const {
    data: statsData,
    isLoading: statsLoading,
    isError: statsError,
    refetch: refetchStats,
  } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const res = await api.get("/dashboard/stats");
      return res.data.data;
    },
  });

  const { data: recentProjectsData, isLoading: projectsLoading } = useQuery({
    queryKey: ["recent-projects"],
    queryFn: async () => {
      const res = await api.get("/dashboard/recent-projects");
      return res.data.data.projects;
    },
  });

  const seedMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post("/media/seed-demo");
      return res.data.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      queryClient.invalidateQueries({ queryKey: ["media"] });
      dispatch(
        addToast({
          type: "success",
          message: data.alreadySeeded
            ? "Demo media library (150 assets) is already loaded."
            : `Loaded ${data.assetsCreated} DEMO DATA assets and indexed ${data.scenesCreated} scenes!`,
        }),
      );
    },
    onError: () => {
      dispatch(
        addToast({ type: "error", message: "Failed to seed demo dataset." }),
      );
    },
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post("/storyboards/generate", {
        prompt: quickPrompt,
        targetDuration,
        aspectRatio,
        includeDemoMedia: true,
      });
      return res.data.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["recent-projects"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      dispatch(
        addToast({
          type: "success",
          message: `Storyboard "${data.storyboard.title}" generated!`,
        }),
      );
      navigate(`/app/storyboard/${data.storyboard.id}`);
    },
    onError: (err: unknown) => {
      const e = err as {
        response?: { data?: { error?: { message?: string } } };
      };
      dispatch(
        addToast({
          type: "error",
          message:
            e.response?.data?.error?.message ||
            "Could not generate storyboard. Ensure media is indexed first.",
        }),
      );
    },
  });

  const stats = statsData?.stats || {
    totalMedia: 0,
    videosIndexed: 0,
    photosIndexed: 0,
    audioIndexed: 0,
    demoMediaCount: 0,
    nasMediaCount: 0,
    localMediaCount: 0,
    realMediaCount: 0,
    totalStorageBytes: 0,
    totalDurationSeconds: 0,
    totalScenesIndexed: 0,
    activeJobs: 0,
    failedJobs: 0,
    totalStoryboards: 0,
  };

  const aiCaps = statsData?.aiCapabilities || {
    provider: "none",
    configured: false,
    model: "deterministic-local-planner",
  };
  const nasStatus = statsData?.nasStatus || { status: "disconnected" };
  const recentSearches = statsData?.recentSearches || [];
  const recentStoryboards = statsData?.recentStoryboards || [];
  const projects = recentProjectsData || [];

  const firstName = user?.name?.split(" ")[0] || "Creator";

  const chartData = [
    { name: "Videos", count: stats.videosIndexed, color: "#3B82F6" },
    { name: "Photos", count: stats.photosIndexed, color: "#06B6D4" },
    { name: "Audio", count: stats.audioIndexed, color: "#10B981" },
    { name: "Scenes", count: stats.totalScenesIndexed, color: "#F59E0B" },
  ];

  const displayItems =
    recentStoryboards.length > 0 ? recentStoryboards : projects;

  return (
    <div className="max-w-[1400px] mx-auto space-y-5 sm:space-y-6 pb-8 min-w-0">
      {/* Header Row */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 mb-1.5">
            <h1 className="font-display text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-ink">
              Creative Command Center
            </h1>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-card border border-borderSubtle text-ink-secondary">
              <Cpu className="w-3.5 h-3.5 text-[#3B82F6]" />
              {aiCaps.configured
                ? `${aiCaps.provider} (${aiCaps.model})`
                : "Deterministic Local Engine"}
            </span>
          </div>
          <p className="text-sm sm:text-base text-ink-secondary">
            Welcome back, {firstName}. Search indexed footage, monitor pipeline
            health, and direct storyboards.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
          {stats.demoMediaCount === 0 && (
            <button
              onClick={() => seedMutation.mutate()}
              disabled={seedMutation.isPending}
              className="inline-flex items-center justify-center gap-2 px-4 sm:px-5 py-2.5 min-h-[44px] sm:min-h-[46px] rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/25 text-amber-700 dark:text-amber-300 text-xs sm:text-sm font-semibold transition-colors"
            >
              {seedMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <FolderPlus className="w-4 h-4" />
              )}
              Load 150-Clip Demo Library
            </button>
          )}
          <Link
            to="/app/library"
            className="inline-flex items-center justify-center gap-2 px-4 sm:px-5 py-2.5 min-h-[44px] sm:min-h-[46px] rounded-xl bg-card hover:bg-hoverSurface border border-borderSubtle hover:border-[#3B82F6]/45 text-xs sm:text-sm font-semibold text-ink transition-colors"
          >
            Media Library
          </Link>
          <Link
            to="/app/search"
            className="inline-flex items-center justify-center gap-2 px-4 sm:px-5 py-2.5 min-h-[44px] sm:min-h-[46px] rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs sm:text-sm font-semibold transition-colors shadow-lg shadow-blue-600/25"
          >
            <Search className="w-4 h-4" />
            AI Search Studio
          </Link>
        </div>
      </div>

      {/* Error Recovery Banner */}
      {statsError && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/25 flex flex-wrap items-center justify-between gap-3 text-sm text-rose-700 dark:text-rose-300">
          <span className="flex items-center gap-2 font-medium">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
            Unable to load live dashboard metrics. Check your backend
            connection.
          </span>
          <button
            onClick={() => refetchStats()}
            className="inline-flex items-center gap-1.5 px-4 py-2 min-h-[40px] rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-sm font-semibold transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Retry
          </button>
        </div>
      )}

      {/* Director Prompt Hero Workspace */}
      <section className="relative overflow-hidden p-4 sm:p-6 lg:p-7 rounded-2xl bg-gradient-to-br from-card via-card to-surface border border-[#3B82F6]/30 shadow-card">
        <div className="relative space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs sm:text-sm font-bold text-blue-700 dark:text-blue-300 uppercase tracking-wider">
              <Sparkles className="w-4 h-4 text-[#3B82F6] shrink-0" />
              AI Creative Director • Instant Storyboard Builder
            </div>
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              {stats.demoMediaCount > 0 && (
                <span className="text-xs px-2.5 sm:px-3 py-1 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/25 font-semibold">
                  {stats.demoMediaCount} Isolated DEMO Assets Indexed
                </span>
              )}
              {stats.realMediaCount > 0 && (
                <span className="text-xs px-2.5 sm:px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/25 font-semibold">
                  {stats.realMediaCount} Real Assets
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-col xl:flex-row gap-3">
            <div className="relative flex-1">
              <Wand2 className="w-4 h-4 text-[#3B82F6] absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={quickPrompt}
                onChange={(e) => setQuickPrompt(e.target.value)}
                placeholder="Describe the video cut you want to direct (e.g., Find clips of a dog jumping into a pool)..."
                className="w-full pl-11 pr-4 py-3.5 min-h-[50px] rounded-xl input-surface text-sm sm:text-base transition-colors"
              />
            </div>

            <div className="grid grid-cols-1 sm:flex sm:flex-wrap md:flex-nowrap items-center gap-2.5">
              {/* Aspect Ratio Pills */}
              <div className="grid grid-cols-4 sm:flex items-center p-1 rounded-xl subtle-surface shrink-0">
                {(["16:9", "9:16", "1:1", "4:5"] as AspectRatio[]).map((ar) => (
                  <button
                    key={ar}
                    type="button"
                    onClick={() => setAspectRatio(ar)}
                    className={`px-2.5 sm:px-3.5 py-2 min-h-[40px] rounded-lg text-xs sm:text-sm font-mono font-semibold transition-colors text-center ${
                      aspectRatio === ar
                        ? "bg-[#2563EB] text-white shadow-sm shadow-blue-600/25"
                        : "text-ink-muted hover:text-blue-600 dark:hover:text-blue-300"
                    }`}
                  >
                    {ar}
                  </button>
                ))}
              </div>

              <select
                value={targetDuration}
                onChange={(e) => setTargetDuration(Number(e.target.value))}
                className="w-full sm:w-auto px-4 py-3 min-h-[48px] rounded-xl input-surface text-sm font-semibold"
                aria-label="Target Duration"
              >
                <option value={15}>15 sec</option>
                <option value={20}>20 sec</option>
                <option value={30}>30 sec</option>
                <option value={45}>45 sec</option>
                <option value={60}>60 sec</option>
              </select>

              <button
                onClick={() => generateMutation.mutate()}
                disabled={generateMutation.isPending || !quickPrompt.trim()}
                className="w-full sm:w-auto sm:flex-initial px-5 sm:px-7 py-3.5 min-h-[50px] rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-50 text-white text-sm sm:text-base font-semibold inline-flex items-center justify-center gap-2 transition-colors whitespace-nowrap shadow-lg shadow-blue-600/25"
              >
                {generateMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Directing...
                  </>
                ) : (
                  <>
                    Generate Storyboard
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 pt-0.5">
            <span className="text-xs font-semibold text-ink-muted mr-1">
              Signature presets:
            </span>
            {SCENARIO_PRESETS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => {
                  setQuickPrompt(preset.prompt);
                  setTargetDuration(preset.duration);
                  setAspectRatio(preset.aspectRatio);
                }}
                title={preset.prompt}
                className="text-xs sm:text-sm px-3 sm:px-3.5 py-1.5 sm:py-2 min-h-[36px] sm:min-h-[38px] rounded-xl bg-surface border border-borderSubtle hover:border-[#3B82F6]/50 hover:bg-hoverSurface text-ink-secondary hover:text-ink transition-colors font-medium"
              >
                {preset.label} ({preset.duration}s • {preset.aspectRatio})
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* KPI Metrics Row */}
      {statsLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-32 rounded-2xl panel-card animate-pulse"
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Link
            to="/app/library"
            className="p-4 sm:p-5 lg:p-6 rounded-2xl panel-card hover:border-[#3B82F6]/45 transition-all group"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold text-ink-muted">
                Media Archive
              </span>
              <div className="w-9 h-9 rounded-lg bg-[#3B82F6]/15 border border-[#3B82F6]/30 flex items-center justify-center">
                <Database className="w-4 h-4 text-[#3B82F6]" />
              </div>
            </div>
            <p className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-ink">
              {stats.totalMedia}
            </p>
            <div className="flex items-center justify-between mt-2.5 text-xs sm:text-sm text-ink-muted">
              <span>{formatBytes(stats.totalStorageBytes)}</span>
              <span className="font-mono text-cyan-700 dark:text-cyan-400 font-semibold flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                {formatTotalDuration(stats.totalDurationSeconds)}
              </span>
            </div>
          </Link>

          <Link
            to="/app/search"
            className="p-4 sm:p-5 lg:p-6 rounded-2xl panel-card hover:border-cyan-500/40 transition-all"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold text-ink-muted">
                Indexed Intelligence
              </span>
              <div className="w-9 h-9 rounded-lg bg-cyan-500/10 border border-cyan-500/25 flex items-center justify-center">
                <Video className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
              </div>
            </div>
            <p className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-ink">
              {stats.totalScenesIndexed}{" "}
              <span className="text-xs sm:text-sm font-medium text-ink-muted">scenes</span>
            </p>
            <div className="flex items-center justify-between mt-2.5 text-xs sm:text-sm text-ink-muted">
              <span>{stats.videosIndexed} videos</span>
              <span>{stats.photosIndexed} photos</span>
            </div>
          </Link>

          <Link
            to="/app/storyboard"
            className="p-4 sm:p-5 lg:p-6 rounded-2xl panel-card hover:border-emerald-500/40 transition-all"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold text-ink-muted">
                AI Storyboards
              </span>
              <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center">
                <Film className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              </div>
            </div>
            <p className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-ink">
              {stats.totalStoryboards}
            </p>
            <div className="flex items-center justify-between mt-2.5 text-xs sm:text-sm text-ink-muted">
              <span>Validated timelines</span>
              <span className="text-emerald-700 dark:text-emerald-400 font-semibold">
                Open Studio →
              </span>
            </div>
          </Link>

          <Link
            to="/app/settings"
            className="p-4 sm:p-5 lg:p-6 rounded-2xl panel-card hover:border-amber-500/40 transition-all"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold text-ink-muted">
                NAS & Processing
              </span>
              <div className="w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/25 flex items-center justify-center">
                <HardDrive className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  nasStatus.status === "connected"
                    ? "bg-emerald-500 dark:bg-emerald-400"
                    : "bg-amber-500 dark:bg-amber-400"
                }`}
              />
              <p className="font-display text-xl sm:text-2xl font-bold capitalize text-ink">
                {nasStatus.status}
              </p>
            </div>
            <div className="flex items-center justify-between mt-2.5 text-xs sm:text-sm text-ink-muted">
              <span>
                {stats.activeJobs} active / {stats.failedJobs} failed
              </span>
              <span className="text-blue-700 dark:text-blue-300 font-semibold">
                {nasStatus.status === "connected" ? "Sync →" : "Configure →"}
              </span>
            </div>
          </Link>
        </div>
      )}

      {/* Main Content Bento Grid */}
      <div className="grid lg:grid-cols-12 gap-5 sm:gap-6 items-start">
        {/* Left 8 Columns: Visual Storyboards & Quick Studio Launchers */}
        <div className="lg:col-span-8 space-y-5 sm:space-y-6 min-w-0">
          <div className="p-4 sm:p-6 rounded-2xl panel-card">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
              <div className="min-w-0">
                <h2 className="font-display font-bold text-base sm:text-lg sm:text-xl text-ink">
                  Recent AI Storyboards & Projects
                </h2>
                <p className="text-xs sm:text-sm text-ink-muted mt-0.5">
                  Jump back into your timeline editor or generate a new
                  production plan
                </p>
              </div>
              <Link
                to="/app/storyboard"
                className="text-xs sm:text-sm font-semibold text-blue-600 dark:text-blue-300 hover:underline inline-flex items-center gap-1 shrink-0"
              >
                All Storyboards
                <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </Link>
            </div>

            {projectsLoading || statsLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[1, 2].map((i) => (
                  <div
                    key={i}
                    className="h-36 rounded-xl subtle-surface animate-pulse"
                  />
                ))}
              </div>
            ) : displayItems.length === 0 ? (
              <div className="py-12 px-4 text-center border border-dashed border-borderStrong rounded-2xl bg-surface/60">
                <Film className="w-10 h-10 text-ink-muted mx-auto mb-3" />
                <p className="text-base font-semibold text-ink">
                  No storyboards created yet
                </p>
                <p className="text-sm text-ink-muted mt-1.5 max-w-md mx-auto">
                  Load the isolated 150-clip demo library or upload your own
                  clips, then click{" "}
                  <strong className="text-ink">
                    Generate Storyboard
                  </strong>{" "}
                  above.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4">
                {displayItems
                  .slice(0, 4)
                  .map(
                    (item: {
                      id: string;
                      title: string;
                      creativeConcept?: string;
                      prompt?: string;
                      actualDuration?: number;
                      targetDuration?: number;
                      aspectRatio: string;
                      mood?: string;
                      sceneCount?: number;
                      coverThumbnailUrl?: string | null;
                      hasDemoMedia?: boolean;
                      storyboardId?: string;
                    }) => {
                      const targetLink = item.storyboardId
                        ? `/app/storyboard/${item.storyboardId}`
                        : `/app/storyboard/${item.id}`;
                      return (
                        <Link
                          key={item.id}
                          to={targetLink}
                          className="group rounded-2xl overflow-hidden bg-surface border border-borderSubtle hover:border-[#3B82F6]/50 hover:bg-hoverSurface/70 transition-all flex flex-col min-w-0"
                        >
                          <div className="relative h-28 sm:h-32 bg-[#090B10] overflow-hidden">
                            {item.coverThumbnailUrl ? (
                              <img
                                src={item.coverThumbnailUrl}
                                alt={item.title}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <Film className="w-7 h-7 text-slate-500" />
                              </div>
                            )}
                          </div>

                          <div className="p-3.5 sm:p-4 space-y-2">
                            <div className="flex items-center justify-between gap-2">
                              <h3 className="text-sm sm:text-base font-bold text-ink truncate">
                                {item.title}
                              </h3>
                              <ArrowRight className="w-4 h-4 text-[#3B82F6] dark:text-[#60A5FA] shrink-0 group-hover:translate-x-0.5 transition-transform" />
                            </div>
                            <p className="text-xs sm:text-sm text-ink-secondary truncate">
                              {item.creativeConcept || item.prompt || item.mood}
                            </p>
                            <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                              <span className="px-2 py-0.5 rounded-md bg-card border border-borderSubtle text-ink-secondary font-mono text-[11px] sm:text-xs font-medium">
                                {item.aspectRatio}
                              </span>
                              <span className="px-2 py-0.5 rounded-md bg-cyan-500/10 border border-cyan-500/25 text-cyan-700 dark:text-cyan-300 font-mono text-[11px] sm:text-xs font-semibold">
                                {item.actualDuration || item.targetDuration}s
                              </span>
                              <span className="px-2 py-0.5 rounded-md bg-card border border-borderSubtle font-mono text-[11px] sm:text-xs text-ink-muted">
                                {item.sceneCount === 1
                                  ? "1 scene"
                                  : `${item.sceneCount || 0} scenes`}
                              </span>
                              {item.hasDemoMedia && (
                                <span className="px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/25 text-amber-700 dark:text-amber-300 text-[11px] sm:text-xs font-bold">
                                  DEMO
                                </span>
                              )}
                            </div>
                          </div>
                        </Link>
                      );
                    },
                  )}
              </div>
            )}
          </div>

          {/* Studio Workflow Shortcuts */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
            <Link
              to="/app/search"
              className="p-4 sm:p-5 rounded-2xl panel-card hover:border-[#3B82F6]/45 transition-all flex items-start gap-3 sm:gap-3.5 min-w-0"
            >
              <div className="w-10 h-10 rounded-xl bg-[#3B82F6]/15 border border-[#3B82F6]/30 flex items-center justify-center shrink-0">
                <Search className="w-4 h-4 text-[#3B82F6]" />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm sm:text-base font-bold text-ink">
                  Natural Search
                </h3>
                <p className="text-xs sm:text-sm text-ink-muted mt-0.5 leading-relaxed">
                  Find scenes by action, mood, or spoken words
                </p>
              </div>
            </Link>

            <Link
              to="/app/content"
              className="p-4 sm:p-5 rounded-2xl panel-card hover:border-cyan-500/40 transition-all flex items-start gap-3 sm:gap-3.5 min-w-0"
            >
              <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/25 flex items-center justify-center shrink-0">
                <Layers className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm sm:text-base font-bold text-ink">
                  Content Studio
                </h3>
                <p className="text-xs sm:text-sm text-ink-muted mt-0.5 leading-relaxed">
                  Generate YouTube titles, hooks & captions
                </p>
              </div>
            </Link>

            <Link
              to="/app/processing"
              className="p-4 sm:p-5 rounded-2xl panel-card hover:border-emerald-500/40 transition-all flex items-start gap-3 sm:gap-3.5 min-w-0"
            >
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center shrink-0">
                <Activity className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm sm:text-base font-bold text-ink">
                  Processing Queue
                </h3>
                <p className="text-xs sm:text-sm text-ink-muted mt-0.5 leading-relaxed">
                  Live indexing jobs & retry recovery
                </p>
              </div>
            </Link>
          </div>
        </div>

        {/* Right 4 Columns: Analytics & Recent Searches */}
        <div className="lg:col-span-4 space-y-5 sm:space-y-6 min-w-0">
          <div className="p-4 sm:p-6 rounded-2xl panel-card flex flex-col justify-between">
            <div>
              <h2 className="font-display font-bold text-base sm:text-lg text-ink mb-1">
                Index Composition
              </h2>
              <p className="text-xs sm:text-sm text-ink-muted mb-4">
                Indexed media categories & extracted scenes
              </p>

              {stats.totalMedia === 0 ? (
                <div className="h-44 rounded-xl subtle-surface flex flex-col items-center justify-center text-center p-4">
                  <Database className="w-6 h-6 text-ink-muted mb-2" />
                  <p className="text-sm text-ink-muted">
                    Load demo clips or upload media to visualize index
                    distribution.
                  </p>
                </div>
              ) : (
                <div className="h-44 sm:h-48 w-full min-w-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                      <XAxis
                        dataKey="name"
                        stroke={isDark ? "#94A3B8" : "#475569"}
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        stroke={isDark ? "#94A3B8" : "#475569"}
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                        width={34}
                      />
                      <Tooltip
                        cursor={{
                          fill: isDark
                            ? "rgba(255, 255, 255, 0.04)"
                            : "rgba(15, 23, 42, 0.04)",
                        }}
                        contentStyle={{
                          backgroundColor: isDark ? "#11151D" : "#FFFFFF",
                          border: isDark
                            ? "1px solid rgba(255,255,255,0.12)"
                            : "1px solid rgba(15,23,42,0.12)",
                          borderRadius: "10px",
                          fontSize: "13px",
                          color: isDark ? "#F8FAFC" : "#0F172A",
                          boxShadow: isDark
                            ? "0 10px 30px rgba(0,0,0,0.45)"
                            : "0 10px 30px rgba(15,23,42,0.12)",
                        }}
                      />
                      <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                        {chartData.map((entry) => (
                          <Cell key={entry.name} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Source Distribution Breakdown */}
              <div className="mt-4 pt-4 border-t border-borderSubtle space-y-2.5 text-xs sm:text-sm">
                <div className="flex items-center justify-between text-ink-muted">
                  <span className="font-medium">Source Provenance</span>
                  <span className="font-mono font-semibold text-ink">
                    {stats.totalMedia} total
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-1.5 sm:gap-2 text-center">
                  <div className="p-2 sm:p-3 rounded-xl subtle-surface min-w-0">
                    <p className="font-mono font-bold text-sm sm:text-base text-ink">
                      {stats.nasMediaCount || 0}
                    </p>
                    <p className="text-[10px] sm:text-xs font-medium text-ink-muted mt-0.5 truncate">
                      UGREEN NAS
                    </p>
                  </div>
                  <div className="p-2 sm:p-3 rounded-xl subtle-surface min-w-0">
                    <p className="font-mono font-bold text-sm sm:text-base text-ink">
                      {stats.localMediaCount || 0}
                    </p>
                    <p className="text-[10px] sm:text-xs font-medium text-ink-muted mt-0.5 truncate">
                      Uploads
                    </p>
                  </div>
                  <div className="p-2 sm:p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 min-w-0">
                    <p className="font-mono font-bold text-sm sm:text-base text-amber-700 dark:text-amber-300">
                      {stats.demoMediaCount || 0}
                    </p>
                    <p className="text-[10px] sm:text-xs font-semibold text-amber-700 dark:text-amber-400 mt-0.5 truncate">
                      DEMO DATA
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-5 pt-4 border-t border-borderSubtle">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs sm:text-sm font-bold text-ink-muted uppercase tracking-wider">
                  Recent Semantic Searches
                </h3>
                <Link
                  to="/app/search"
                  className="text-xs sm:text-sm font-semibold text-blue-600 dark:text-blue-300 hover:underline"
                >
                  Search →
                </Link>
              </div>
              {recentSearches.length === 0 ? (
                <p className="text-xs sm:text-sm text-ink-muted">
                  No searches logged yet.
                </p>
              ) : (
                <div className="space-y-1.5">
                  {recentSearches
                    .slice(0, 4)
                    .map(
                      (s: {
                        id: string;
                        query: string;
                        resultCount: number;
                      }) => (
                        <Link
                          key={s.id}
                          to={`/app/search?q=${encodeURIComponent(s.query)}`}
                          className="flex items-center justify-between gap-2 text-xs sm:text-sm px-2.5 sm:px-3 py-2 min-h-[38px] rounded-lg hover:bg-[#3B82F6]/15 text-ink-secondary hover:text-blue-700 dark:hover:text-blue-200 transition-colors"
                        >
                          <span className="flex items-center gap-2 truncate pr-1 min-w-0">
                            <Search className="w-3.5 h-3.5 shrink-0 text-[#3B82F6]" />
                            <span className="truncate font-medium">
                              {s.query}
                            </span>
                          </span>
                          <span className="font-mono text-xs text-ink-muted shrink-0">
                            {s.resultCount} hits
                          </span>
                        </Link>
                      ),
                    )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
