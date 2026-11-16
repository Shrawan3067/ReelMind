import { useState, useEffect, useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useDispatch } from "react-redux";
import {
  Sparkles,
  Copy,
  Check,
  Loader2,
  FileText,
  Download,
  RefreshCw,
  Film,
  Hash,
  MessageSquareQuote,
  Type,
  Mic,
  AlertCircle,
  CheckCircle2,
  Eye,
  Star,
} from "lucide-react";
import { api } from "../services/api";
import { addToast } from "../store/studioSlice";

type PlatformKey = "youtube" | "shorts" | "tiktok" | "instagram" | "linkedin";
type ToneKey =
  | "cinematic"
  | "energetic"
  | "educational"
  | "professional"
  | "casual"
  | "humorous";
type SectionTab = "all" | "titles_hooks" | "captions_seo" | "tags_narration";

interface StoryboardSummary {
  id: string;
  title: string;
  creativeConcept?: string;
  aspectRatio?: string;
  actualDuration?: number;
  mood?: string;
  scenes?: Array<{ id: string }>;
}

interface GeneratedContentPack {
  groundedInStoryboard: boolean;
  titles: string[];
  captions: string[];
  descriptions: string[];
  hashtags: string[];
  hooks: string[];
  thumbnailTexts: string[];
  narrationScript: Array<{
    sceneOrder: number;
    timestamp: string;
    line: string;
  }>;
}

const PLATFORMS: Array<{ id: PlatformKey; label: string; hint: string }> = [
  { id: "youtube", label: "YouTube", hint: "Long-form SEO" },
  { id: "shorts", label: "Shorts", hint: "60s Vertical" },
  { id: "tiktok", label: "TikTok", hint: "Fast Hook" },
  { id: "instagram", label: "Reels", hint: "Visual Story" },
  { id: "linkedin", label: "LinkedIn", hint: "Pro Insight" },
];

const TONES: Array<{ id: ToneKey; label: string }> = [
  { id: "cinematic", label: "Cinematic" },
  { id: "energetic", label: "Energetic" },
  { id: "educational", label: "Educational" },
  { id: "professional", label: "Professional" },
  { id: "casual", label: "Casual" },
  { id: "humorous", label: "Humorous" },
];

const BRIEF_PRESETS = [
  {
    label: "Dog Pool Cut",
    text: "Golden retriever jumping into a sparkling swimming pool on a sunny summer afternoon",
  },
  {
    label: "Coastal Travel",
    text: "Scenic coastline road trip featuring bicycle cliffside rides and golden-hour ocean waves",
  },
  {
    label: "Product Ad",
    text: "Sleek creator desk hardware setup showcase with dynamic close-up studio lighting",
  },
];

export function ContentStudioPage() {
  const [searchParams] = useSearchParams();
  const initialSbId = searchParams.get("storyboardId") || "";

  const [storyboardId, setStoryboardId] = useState(initialSbId);
  const [platform, setPlatform] = useState<PlatformKey>("youtube");
  const [tone, setTone] = useState<ToneKey>("cinematic");
  const [audience, setAudience] = useState("Creators & Dog Lovers");
  const [language, setLanguage] = useState("English");
  const [topicOrSummary, setTopicOrSummary] = useState(BRIEF_PRESETS[0].text);
  const [hasEditedBrief, setHasEditedBrief] = useState(false);

  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<SectionTab>("all");
  const [pack, setPack] = useState<GeneratedContentPack | null>(null);
  const [regeneratingSection, setRegeneratingSection] = useState<string | null>(
    null,
  );

  // Active indices for Live Platform Preview & Markdown export
  const [selectedIdx, setSelectedIdx] = useState({
    title: 0,
    hook: 0,
    thumb: 0,
    caption: 0,
    desc: 0,
    tags: 0,
  });

  const dispatch = useDispatch();

  const { data: storyboards } = useQuery({
    queryKey: ["storyboards"],
    queryFn: async () => {
      const res = await api.get("/storyboards");
      return (res.data.data.storyboards || []) as StoryboardSummary[];
    },
  });

  const anchoredStoryboard = useMemo(
    () => storyboards?.find((sb) => sb.id === storyboardId),
    [storyboards, storyboardId],
  );

  // Sync brief when arriving directly via ?storyboardId=...
  useEffect(() => {
    if (anchoredStoryboard && !hasEditedBrief) {
      setTopicOrSummary(
        anchoredStoryboard.title ||
          anchoredStoryboard.creativeConcept ||
          BRIEF_PRESETS[0].text,
      );
    }
  }, [anchoredStoryboard, hasEditedBrief]);

  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post("/content/generate-pack", {
        platform,
        tone,
        audience,
        language,
        storyboardId: storyboardId || undefined,
        topicOrSummary,
      });
      return res.data.data as GeneratedContentPack;
    },
    onSuccess: (data) => {
      setPack(data);
      setSelectedIdx({
        title: 0,
        hook: 0,
        thumb: 0,
        caption: 0,
        desc: 0,
        tags: 0,
      });
      dispatch(
        addToast({
          type: "success",
          message: "Generated complete content publishing kit!",
        }),
      );
    },
    onError: () => {
      dispatch(
        addToast({
          type: "error",
          message:
            "Content generation failed. Please check your brief and retry.",
        }),
      );
    },
  });

  const regenerateSection = async (
    endpoint:
      | "generate-title"
      | "generate-caption"
      | "generate-description"
      | "generate-hashtags",
    targetKey: "titles" | "captions" | "descriptions" | "hashtags",
  ) => {
    if (!pack || topicOrSummary.trim().length < 3) return;
    setRegeneratingSection(targetKey);
    try {
      const res = await api.post(`/content/${endpoint}`, {
        platform,
        tone,
        audience,
        language,
        storyboardId: storyboardId || undefined,
        topicOrSummary,
      });
      const updatedList = res.data?.data?.[targetKey] as string[] | undefined;
      if (updatedList && updatedList.length > 0) {
        setPack((prev) =>
          prev ? { ...prev, [targetKey]: updatedList } : prev,
        );
        dispatch(
          addToast({
            type: "success",
            message: `Regenerated ${targetKey} options.`,
          }),
        );
      }
    } catch {
      dispatch(
        addToast({
          type: "error",
          message: `Failed to regenerate ${targetKey}.`,
        }),
      );
    } finally {
      setRegeneratingSection(null);
    }
  };

  const handleCopy = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      dispatch(addToast({ type: "info", message: "Copied to clipboard" }));
      setTimeout(() => setCopiedKey(null), 1800);
    } catch {
      dispatch(
        addToast({ type: "error", message: "Clipboard copy not available" }),
      );
    }
  };

  const buildMarkdownKit = (p: GeneratedContentPack) => {
    const title = p.titles[selectedIdx.title] || p.titles[0] || "";
    const hook = p.hooks[selectedIdx.hook] || p.hooks[0] || "";
    const thumb =
      p.thumbnailTexts[selectedIdx.thumb] || p.thumbnailTexts[0] || "";
    const caption = p.captions[selectedIdx.caption] || p.captions[0] || "";
    const description =
      p.descriptions[selectedIdx.desc] || p.descriptions[0] || "";
    const tags = p.hashtags[selectedIdx.tags] || p.hashtags[0] || "";

    const lines = [
      `# Publishing Kit (${platform.toUpperCase()} • ${tone})`,
      anchoredStoryboard
        ? `Storyboard: ${anchoredStoryboard.title}`
        : `Brief: ${topicOrSummary}`,
      "",
      `## Selected Title\n${title}`,
      "",
      `## Thumbnail Text\n${thumb}`,
      "",
      `## Opening Hook (0–3s)\n${hook}`,
      "",
      `## Platform Caption\n${caption}`,
      "",
      `## Description\n${description}`,
      "",
      `## Hashtags\n${tags}`,
    ];

    if (p.narrationScript.length > 0) {
      lines.push("", "## Narration Script");
      p.narrationScript.forEach((n) => {
        lines.push(`- [${n.timestamp}] Scene ${n.sceneOrder}: ${n.line}`);
      });
    }
    return lines.join("\n");
  };

  const exportMarkdownKit = () => {
    if (!pack) return;
    const content = buildMarkdownKit(pack);
    const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `reelmind-${platform}-publishing-kit.md`;
    a.click();
    URL.revokeObjectURL(url);
    dispatch(
      addToast({ type: "success", message: "Exported publishing kit (.md)" }),
    );
  };

  const sectionDefinitions: Array<{
    label: string;
    key:
      | "titles"
      | "hooks"
      | "thumbnailTexts"
      | "captions"
      | "descriptions"
      | "hashtags";
    selKey: keyof typeof selectedIdx;
    prefix: string;
    rows: number;
    tab: SectionTab;
    regenEndpoint?:
      | "generate-title"
      | "generate-caption"
      | "generate-description"
      | "generate-hashtags";
    charTarget?: number;
  }> = [
    {
      label: "Title Variations",
      key: "titles",
      selKey: "title",
      prefix: "title",
      rows: 1,
      tab: "titles_hooks",
      regenEndpoint: "generate-title",
      charTarget: 70,
    },
    {
      label: "Video Hooks (First 3 Seconds)",
      key: "hooks",
      selKey: "hook",
      prefix: "hook",
      rows: 1,
      tab: "titles_hooks",
    },
    {
      label: "Thumbnail Text Ideas",
      key: "thumbnailTexts",
      selKey: "thumb",
      prefix: "thumb",
      rows: 1,
      tab: "titles_hooks",
    },
    {
      label: "Platform Captions",
      key: "captions",
      selKey: "caption",
      prefix: "cap",
      rows: 2,
      tab: "captions_seo",
      regenEndpoint: "generate-caption",
    },
    {
      label: "SEO Descriptions",
      key: "descriptions",
      selKey: "desc",
      prefix: "desc",
      rows: 4,
      tab: "captions_seo",
      regenEndpoint: "generate-description",
    },
    {
      label: "Hashtag Sets",
      key: "hashtags",
      selKey: "tags",
      prefix: "tag",
      rows: 2,
      tab: "tags_narration",
      regenEndpoint: "generate-hashtags",
    },
  ];

  const visibleSections = sectionDefinitions.filter(
    (s) => activeTab === "all" || s.tab === activeTab,
  );
  const showNarration = activeTab === "all" || activeTab === "tags_narration";

  const previewTitle = pack?.titles[selectedIdx.title] || pack?.titles[0] || "";
  const previewThumb =
    pack?.thumbnailTexts[selectedIdx.thumb] || pack?.thumbnailTexts[0] || "";
  const previewCaption =
    pack?.captions[selectedIdx.caption] || pack?.captions[0] || "";
  const previewTags =
    pack?.hashtags[selectedIdx.tags] || pack?.hashtags[0] || "";

  return (
    <div className="max-w-[1400px] mx-auto space-y-6 pb-8">
      {/* Studio Page Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-ink">
              AI Content Studio
            </h1>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#3B82F6]/15 border border-[#3B82F6]/30 text-xs sm:text-sm font-semibold text-blue-700 dark:text-blue-300">
              <Sparkles className="w-3.5 h-3.5 text-[#3B82F6]" />
              {anchoredStoryboard
                ? `Anchored: ${anchoredStoryboard.title}`
                : "Grounded Publishing Generator"}
            </span>
          </div>
          <p className="text-base text-ink-secondary mt-1">
            Craft titles, 3-second hooks, captions, SEO descriptions, hashtags,
            and narration anchored to your real footage.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <Link
            to={
              storyboardId
                ? `/app/storyboard/${storyboardId}`
                : "/app/storyboard"
            }
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 min-h-[44px] rounded-xl bg-card hover:bg-hoverSurface border border-borderSubtle hover:border-[#3B82F6]/50 text-sm font-semibold text-ink transition-colors whitespace-nowrap"
          >
            <Film className="w-4 h-4 text-[#3B82F6]" />
            {storyboardId ? "Back to Storyboard" : "Storyboard Studio"}
          </Link>

          {pack && (
            <>
              <button
                type="button"
                onClick={() => handleCopy("full_kit", buildMarkdownKit(pack))}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 min-h-[44px] rounded-xl subtle-surface hover:border-[#3B82F6]/50 hover:bg-hoverSurface text-sm font-semibold text-ink transition-colors whitespace-nowrap"
              >
                {copiedKey === "full_kit" ? (
                  <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
                {copiedKey === "full_kit" ? "Copied Kit" : "Copy Full Kit"}
              </button>
              <button
                type="button"
                onClick={exportMarkdownKit}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 min-h-[44px] rounded-xl bg-cyan-500/10 border border-cyan-500/25 hover:bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 text-sm font-semibold transition-colors whitespace-nowrap"
              >
                <Download className="w-4 h-4" />
                Export .MD
              </button>
            </>
          )}
        </div>
      </div>

      {/* Main 12-Col Studio Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Controls Panel (4 cols) */}
        <aside className="lg:col-span-4 p-5 sm:p-6 rounded-2xl panel-card space-y-5 lg:sticky lg:top-24">
          <div>
            <label className="block text-sm font-semibold text-ink-secondary mb-2">
              Anchor to Storyboard (Optional)
            </label>
            <select
              aria-label="Anchor to storyboard"
              value={storyboardId}
              onChange={(e) => {
                const nextId = e.target.value;
                setStoryboardId(nextId);
                const selected = storyboards?.find((s) => s.id === nextId);
                if (selected) {
                  setTopicOrSummary(
                    selected.title ||
                      selected.creativeConcept ||
                      BRIEF_PRESETS[0].text,
                  );
                  setHasEditedBrief(false);
                }
              }}
              className="w-full px-3.5 py-3 min-h-[46px] rounded-xl input-surface text-sm font-semibold"
            >
              <option value="">Custom Topic / Manual Brief</option>
              {(storyboards || []).map((sb) => (
                <option key={sb.id} value={sb.id}>
                  {sb.title}{" "}
                  {sb.actualDuration ? `(${sb.actualDuration}s)` : ""}
                </option>
              ))}
            </select>

            {anchoredStoryboard && (
              <div className="mt-3 p-3.5 rounded-xl bg-[#3B82F6]/15 border border-[#3B82F6]/30 text-sm space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-blue-800 dark:text-blue-200 truncate">
                    {anchoredStoryboard.title}
                  </span>
                  <span className="font-mono text-xs px-2 py-0.5 rounded bg-card border border-[#3B82F6]/35 text-blue-700 dark:text-blue-300">
                    {anchoredStoryboard.aspectRatio || "16:9"}
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-ink-secondary font-mono">
                  {anchoredStoryboard.actualDuration || 30}s •{" "}
                  {anchoredStoryboard.scenes?.length || 0} scene
                  {anchoredStoryboard.scenes?.length === 1 ? "" : "s"} •{" "}
                  {anchoredStoryboard.mood || "cinematic"}
                </p>
              </div>
            )}
          </div>

          {/* Target Platform Segmented Pills */}
          <div>
            <label className="block text-sm font-semibold text-ink-secondary mb-2">
              Target Platform
            </label>
            <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-3 gap-2">
              {PLATFORMS.map((p) => {
                const active = platform === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPlatform(p.id)}
                    aria-pressed={active}
                    className={`px-3 py-2.5 min-h-[54px] rounded-xl border text-left transition-colors ${
                      active
                        ? "bg-[#2563EB] border-[#2563EB] text-white shadow-sm shadow-blue-600/25"
                        : "bg-surface border-borderSubtle text-ink-secondary hover:border-[#3B82F6]/45 hover:text-ink"
                    }`}
                  >
                    <span className="block text-sm font-semibold">
                      {p.label}
                    </span>
                    <span
                      className={`block text-xs ${active ? "text-blue-100" : "text-ink-muted"}`}
                    >
                      {p.hint}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tone Pills */}
          <div>
            <label className="block text-sm font-semibold text-ink-secondary mb-2">
              Voice & Tone
            </label>
            <div className="flex flex-wrap gap-2">
              {TONES.map((t) => {
                const active = tone === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTone(t.id)}
                    aria-pressed={active}
                    className={`px-3.5 py-2 min-h-[40px] rounded-xl text-xs sm:text-sm font-semibold border transition-colors ${
                      active
                        ? "bg-[#3B82F6]/15 border-[#3B82F6] text-blue-700 dark:text-blue-200"
                        : "bg-surface border-borderSubtle text-ink-secondary hover:border-[#3B82F6]/45 hover:text-ink"
                    }`}
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold text-ink-secondary mb-2">
                Audience
              </label>
              <input
                type="text"
                value={audience}
                onChange={(e) => setAudience(e.target.value)}
                className="w-full px-3.5 py-2.5 min-h-[46px] rounded-xl input-surface text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-ink-secondary mb-2">
                Language
              </label>
              <input
                type="text"
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="w-full px-3.5 py-2.5 min-h-[46px] rounded-xl input-surface text-sm"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-semibold text-ink-secondary">
                Footage Summary / Brief
              </label>
              <span className="text-xs font-mono text-ink-muted">
                {topicOrSummary.trim().length} chars
              </span>
            </div>
            <textarea
              rows={4}
              value={topicOrSummary}
              onChange={(e) => {
                setTopicOrSummary(e.target.value);
                setHasEditedBrief(true);
              }}
              placeholder="Describe the scene sequence, subject, setting, and pacing..."
              className="w-full px-3.5 py-3 rounded-xl input-surface text-sm resize-none"
            />
            {!storyboardId && (
              <div className="flex flex-wrap gap-2 mt-2.5">
                {BRIEF_PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => {
                      setTopicOrSummary(preset.text);
                      setHasEditedBrief(false);
                    }}
                    className="text-xs px-3 py-1.5 min-h-[36px] rounded-lg subtle-surface hover:border-[#3B82F6]/50 hover:bg-hoverSurface text-ink-secondary font-medium transition-colors"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => generateMutation.mutate()}
            disabled={
              generateMutation.isPending || topicOrSummary.trim().length < 3
            }
            className="w-full py-3.5 min-h-[50px] rounded-xl bg-gradient-to-r from-[#2563EB] to-[#06B6D4] hover:opacity-95 disabled:opacity-50 text-white text-sm sm:text-base font-bold inline-flex items-center justify-center gap-2 transition-opacity shadow-lg shadow-blue-600/25"
          >
            {generateMutation.isPending ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Sparkles className="w-5 h-5" />
            )}
            Generate Publishing Pack
          </button>
        </aside>

        {/* Right Publishing Workspace (8 cols) */}
        <section className="lg:col-span-8 space-y-5">
          {/* Error Banner */}
          {generateMutation.isError && (
            <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/25 flex flex-wrap items-center justify-between gap-3 sm:gap-4 text-sm text-rose-700 dark:text-rose-300 font-medium">
              <span className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
                Could not generate publishing pack. Verify your brief length and
                backend connection.
              </span>
              <button
                type="button"
                onClick={() => generateMutation.mutate()}
                className="px-4 py-2 min-h-[40px] rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-sm font-semibold shrink-0 transition-colors"
              >
                Retry
              </button>
            </div>
          )}

          {generateMutation.isPending ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="p-5 rounded-2xl panel-card space-y-3 animate-pulse"
                >
                  <div className="h-4 w-40 rounded subtle-surface" />
                  <div className="h-10 rounded-xl subtle-surface" />
                  <div className="h-10 rounded-xl subtle-surface" />
                </div>
              ))}
            </div>
          ) : !pack ? (
            <div className="p-8 sm:p-10 rounded-2xl panel-card space-y-6">
              <div className="text-center space-y-3 max-w-lg mx-auto">
                <div className="w-12 h-12 rounded-2xl bg-[#3B82F6]/15 border border-[#3B82F6]/30 flex items-center justify-center mx-auto">
                  <FileText className="w-6 h-6 text-[#3B82F6]" />
                </div>
                <h2 className="font-display font-bold text-xl text-ink">
                  Ready to Craft Publishing Assets
                </h2>
                <p className="text-sm sm:text-base text-ink-secondary leading-relaxed">
                  Pick a target platform, tone, and storyboard anchor on the
                  left, then click{" "}
                  <strong className="text-ink">
                    Generate Publishing Pack
                  </strong>{" "}
                  to build a complete, editable release kit.
                </p>
              </div>

              <div className="grid sm:grid-cols-3 gap-3.5 pt-2">
                {[
                  {
                    Icon: Type,
                    title: "Titles & Hooks",
                    desc: "3 clickable headline cuts & 3s scroll-stoppers",
                  },
                  {
                    Icon: MessageSquareQuote,
                    title: "Captions & SEO",
                    desc: "Platform copy & timestamped video descriptions",
                  },
                  {
                    Icon: Hash,
                    title: "Tags & Narration",
                    desc: "Curated hashtags & scene voiceover script",
                  },
                ].map(({ Icon, title, desc }) => (
                  <div
                    key={title}
                    className="p-4 rounded-xl subtle-surface space-y-2"
                  >
                    <div className="w-8 h-8 rounded-lg bg-card border border-borderSubtle flex items-center justify-center">
                      <Icon className="w-4 h-4 text-[#3B82F6]" />
                    </div>
                    <p className="text-sm sm:text-base font-bold text-ink">
                      {title}
                    </p>
                    <p className="text-xs sm:text-sm text-ink-muted leading-relaxed">
                      {desc}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <>
              {/* Grounded Telemetry & Section Filter Tabs */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                {pack.groundedInStoryboard ? (
                  <div className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    Grounded in actual storyboard scenes and source footage
                    timestamps.
                  </div>
                ) : (
                  <div className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/25 text-sm font-semibold text-cyan-700 dark:text-cyan-300">
                    <Sparkles className="w-4 h-4 shrink-0" />
                    Generated strictly from your active brief • Editable before
                    export.
                  </div>
                )}

                <div className="flex items-center p-1 rounded-xl bg-card border border-borderSubtle text-xs sm:text-sm">
                  {(
                    [
                      { key: "all", label: "All Assets" },
                      { key: "titles_hooks", label: "Titles & Hooks" },
                      { key: "captions_seo", label: "Captions & SEO" },
                      { key: "tags_narration", label: "Tags & Script" },
                    ] as Array<{ key: SectionTab; label: string }>
                  ).map((t) => (
                    <button
                      key={t.key}
                      type="button"
                      onClick={() => setActiveTab(t.key)}
                      className={`px-3.5 py-2 min-h-[40px] rounded-lg font-semibold transition-colors ${
                        activeTab === t.key
                          ? "bg-[#2563EB] text-white"
                          : "text-ink-secondary hover:text-ink"
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Live Platform Feed Card Preview */}
              <div className="p-5 sm:p-6 rounded-2xl bg-gradient-to-br from-card to-surface border border-[#3B82F6]/30 shadow-card space-y-3">
                <div className="flex items-center justify-between gap-2 text-xs sm:text-sm">
                  <span className="inline-flex items-center gap-1.5 font-bold text-blue-700 dark:text-blue-300 uppercase tracking-wider">
                    <Eye className="w-4 h-4" />
                    Selected {
                      PLATFORMS.find((p) => p.id === platform)?.label
                    }{" "}
                    Preview
                  </span>
                  {previewThumb && (
                    <span className="px-3 py-1 rounded-md bg-[#3B82F6]/15 border border-[#3B82F6]/35 text-blue-700 dark:text-blue-200 font-display font-bold text-xs tracking-wide">
                      {previewThumb}
                    </span>
                  )}
                </div>
                <div className="p-4 rounded-xl bg-canvas border border-borderSubtle space-y-2.5">
                  <p className="font-display font-bold text-lg sm:text-xl text-ink leading-snug">
                    {previewTitle}
                  </p>
                  {previewCaption && (
                    <p className="text-sm text-ink-secondary leading-relaxed">
                      {previewCaption}
                    </p>
                  )}
                  {previewTags && (
                    <p className="text-xs sm:text-sm font-mono text-cyan-700 dark:text-cyan-400 font-medium">
                      {previewTags}
                    </p>
                  )}
                </div>
              </div>

              {/* Section Editors */}
              {visibleSections.map((section) => {
                const items = pack[section.key];
                const isRegening = regeneratingSection === section.key;
                const activeChoice = selectedIdx[section.selKey];

                return (
                  <div
                    key={section.prefix}
                    className="p-5 sm:p-6 rounded-2xl panel-card space-y-3.5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <h3 className="font-display font-bold text-base sm:text-lg text-ink">
                          {section.label}
                        </h3>
                        <span className="px-2.5 py-0.5 rounded-full subtle-surface font-mono text-xs font-semibold text-ink-secondary">
                          {items.length}
                        </span>
                      </div>

                      {section.regenEndpoint && (
                        <button
                          type="button"
                          onClick={() =>
                            regenerateSection(
                              section.regenEndpoint!,
                              section.key as
                                | "titles"
                                | "captions"
                                | "descriptions"
                                | "hashtags",
                            )
                          }
                          disabled={isRegening}
                          className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 min-h-[38px] rounded-xl subtle-surface hover:border-[#3B82F6]/50 hover:bg-hoverSurface text-xs sm:text-sm font-semibold text-ink disabled:opacity-50 transition-colors"
                        >
                          <RefreshCw
                            className={`w-3.5 h-3.5 ${isRegening ? "animate-spin text-[#3B82F6]" : ""}`}
                          />
                          Regenerate
                        </button>
                      )}
                    </div>

                    <div className="space-y-3">
                      {items.map((text, i) => {
                        const k = `${section.prefix}_${i}`;
                        const isPicked = activeChoice === i;
                        const overTarget = section.charTarget
                          ? text.length > section.charTarget
                          : false;

                        return (
                          <div
                            key={k}
                            className={`p-3.5 rounded-xl border transition-colors text-sm space-y-2.5 ${
                              isPicked
                                ? "bg-[#3B82F6]/10 border-[#3B82F6]/50"
                                : "bg-surface border-borderSubtle focus-within:border-[#3B82F6] focus-within:bg-canvas"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <textarea
                                rows={
                                  section.rows === 1 && text.length > 78
                                    ? 2
                                    : section.rows
                                }
                                value={text}
                                onChange={(e) => {
                                  const nextVal = e.target.value;
                                  setPack((prev) => {
                                    if (!prev) return prev;
                                    const updatedArr = [...prev[section.key]];
                                    updatedArr[i] = nextVal;
                                    return {
                                      ...prev,
                                      [section.key]: updatedArr,
                                    };
                                  });
                                }}
                                className={`w-full bg-transparent text-ink focus:outline-none leading-relaxed font-medium text-sm ${
                                  section.rows <= 2 ? "resize-none" : "resize-y"
                                }`}
                              />
                              <button
                                type="button"
                                onClick={() => handleCopy(k, text)}
                                className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-hoverSurface text-ink-muted hover:text-blue-600 dark:hover:text-blue-300 shrink-0 transition-colors"
                                title="Copy"
                                aria-label={`Copy ${section.label} ${i + 1}`}
                              >
                                {copiedKey === k ? (
                                  <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                                ) : (
                                  <Copy className="w-4 h-4" />
                                )}
                              </button>
                            </div>

                            <div className="flex items-center justify-between pt-2 border-t border-borderSubtle text-xs">
                              <span
                                className={`font-mono font-semibold ${
                                  overTarget
                                    ? "text-amber-700 dark:text-amber-300"
                                    : "text-ink-muted"
                                }`}
                              >
                                {text.length} chars
                                {section.charTarget
                                  ? ` / ${section.charTarget} optimal`
                                  : ""}
                              </span>
                              <button
                                type="button"
                                onClick={() =>
                                  setSelectedIdx((prev) => ({
                                    ...prev,
                                    [section.selKey]: i,
                                  }))
                                }
                                className={`inline-flex items-center justify-center gap-1.5 px-3 py-1.5 min-h-[36px] rounded-lg text-xs font-semibold transition-colors ${
                                  isPicked
                                    ? "bg-[#2563EB] text-white"
                                    : "text-ink-secondary hover:text-blue-700 dark:hover:text-blue-300 hover:bg-hoverSurface"
                                }`}
                              >
                                <Star
                                  className={`w-3 h-3 ${isPicked ? "fill-current" : ""}`}
                                />
                                {isPicked ? "Selected in Kit" : "Use in Kit"}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              {/* Scene-by-Scene Narration Script */}
              {showNarration && pack.narrationScript.length > 0 && (
                <div className="p-5 sm:p-6 rounded-2xl panel-card space-y-3.5">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-display font-bold text-base sm:text-lg text-ink flex items-center gap-2">
                      <Mic className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                      Scene-by-Scene Narration Script
                    </h3>
                    <button
                      type="button"
                      onClick={() =>
                        handleCopy(
                          "narration_all",
                          pack.narrationScript
                            .map(
                              (n) =>
                                `[${n.timestamp}] Scene ${n.sceneOrder}: ${n.line}`,
                            )
                            .join("\n"),
                        )
                      }
                      className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 min-h-[38px] rounded-xl subtle-surface hover:border-[#3B82F6]/50 hover:bg-hoverSurface text-xs sm:text-sm font-semibold text-ink transition-colors"
                    >
                      {copiedKey === "narration_all" ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                      Copy Script
                    </button>
                  </div>

                  <div className="space-y-2.5">
                    {pack.narrationScript.map((n, idx) => (
                      <div
                        key={n.sceneOrder}
                        className="flex flex-col sm:flex-row sm:items-center gap-3 p-3.5 rounded-xl bg-surface border border-borderSubtle focus-within:border-[#3B82F6] focus-within:bg-canvas text-sm transition-colors"
                      >
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="px-2 py-0.5 rounded bg-[#3B82F6]/15 border border-[#3B82F6]/30 text-blue-700 dark:text-blue-300 font-mono font-bold text-xs">
                            S{n.sceneOrder}
                          </span>
                          <span className="font-mono font-semibold text-cyan-700 dark:text-cyan-400">
                            {n.timestamp}
                          </span>
                        </div>
                        <input
                          type="text"
                          value={n.line}
                          onChange={(e) => {
                            const val = e.target.value;
                            setPack((prev) => {
                              if (!prev) return prev;
                              const nextScript = [...prev.narrationScript];
                              nextScript[idx] = {
                                ...nextScript[idx],
                                line: val,
                              };
                              return { ...prev, narrationScript: nextScript };
                            });
                          }}
                          className="w-full bg-transparent text-ink focus:outline-none font-medium text-sm"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
