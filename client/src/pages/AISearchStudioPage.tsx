import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useDispatch, useSelector } from 'react-redux';
import {
  Search,
  Sparkles,
  Check,
  Plus,
  Trash2,
  Clock,
  Film,
  Loader2,
  History,
  Info,
  ArrowRight,
  Video,
  Image as ImageIcon,
  Music,
  X,
  Eye,
  SlidersHorizontal,
  FolderOpen,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Layers,
  AlertCircle
} from 'lucide-react';
import { AspectRatio, EvidenceSource, SearchResultItem } from '@reelmind/shared';
import { api } from '../services/api';
import { RootState } from '../store';
import { toggleSelectedClip, clearSelectedClips, addToast } from '../store/studioSlice';

const EXAMPLE_QUERIES = [
  'Find every video where a dog jumps into a swimming pool',
  'Show me clips of someone riding a bicycle near the beach',
  'Find sunset aerial footage',
  'Show me clips of people laughing',
  'Find footage with a red sports car',
  'Find clips suitable for a product advertisement'
];

type DurationPreset = 'all' | 'short' | 'medium' | 'long';

const DURATION_PRESETS: Record<DurationPreset, { label: string; min?: number; max?: number }> = {
  all: { label: 'Any Duration' },
  short: { label: 'Short (≤ 15s)', max: 15 },
  medium: { label: 'Medium (15–30s)', min: 15, max: 30 },
  long: { label: 'Long (> 30s)', min: 30 }
};

const EVIDENCE_META: Record<EvidenceSource, { label: string; tone: string }> = {
  visual_analysis: {
    label: 'Visual Analysis',
    tone: 'bg-[#3B82F6]/15 text-blue-700 dark:text-blue-300 border-[#3B82F6]/30'
  },
  transcript: {
    label: 'Audio Transcript',
    tone: 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border-cyan-500/25'
  },
  hybrid: {
    label: 'Visual + Transcript',
    tone: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/25'
  },
  metadata: {
    label: 'Metadata & Scene Index',
    tone: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/25'
  }
};

function formatSec(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function AISearchStudioPage() {
  const [searchParams] = useSearchParams();
  const initialQuery = searchParams.get('q') || EXAMPLE_QUERIES[0];

  const [query, setQuery] = useState(initialQuery);
  const [mediaTypes, setMediaTypes] = useState<Array<'video' | 'image' | 'audio'>>(['video', 'image']);
  const [sourceFilter, setSourceFilter] = useState<'' | 'local_upload' | 'ugreen_nas' | 'demo'>('');
  const [durationFilter, setDurationFilter] = useState<DurationPreset>('all');
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [searchMeta, setSearchMeta] = useState<{
    totalMatched: number;
    searchMode: string;
    queryEmbeddingModel: string;
    executedQuery: string;
  } | null>(null);

  const [expandedBreakdownIds, setExpandedBreakdownIds] = useState<Record<string, boolean>>({});
  const [previewItem, setPreviewItem] = useState<SearchResultItem | null>(null);

  const [targetDuration, setTargetDuration] = useState(30);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('16:9');
  const [creativePrompt, setCreativePrompt] = useState('');

  const selectedClips = useSelector((state: RootState) => state.studio.selectedClips);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: historyData } = useQuery({
    queryKey: ['search-history'],
    queryFn: async () => {
      const res = await api.get('/search/history');
      return res.data.data.history as Array<{ id: string; query: string; resultCount: number; createdAt?: string }>;
    }
  });

  const searchMutation = useMutation({
    mutationFn: async (qText: string) => {
      const durCfg = DURATION_PRESETS[durationFilter];
      const res = await api.post('/search/semantic', {
        query: qText,
        mediaTypes,
        sourceTypes: sourceFilter ? [sourceFilter] : undefined,
        minDuration: durCfg.min,
        maxDuration: durCfg.max,
        limit: 24,
        page: 1
      });
      return { payload: res.data.data, executedQuery: qText };
    },
    onSuccess: ({ payload, executedQuery }) => {
      setResults(payload.results || []);
      setSearchMeta({
        totalMatched: payload.totalMatched,
        searchMode: payload.searchMode,
        queryEmbeddingModel: payload.queryEmbeddingModel,
        executedQuery
      });
      queryClient.invalidateQueries({ queryKey: ['search-history'] });
    },
    onError: () => {
      dispatch(addToast({ type: 'error', message: 'Semantic search failed. Check connection and try again.' }));
    }
  });

  const deleteHistoryMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/search/history/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['search-history'] });
    }
  });

  const generateStoryboardMutation = useMutation({
    mutationFn: async () => {
      const promptToUse = creativePrompt.trim() || query.trim();
      const selectedIds = selectedClips.map(c => c.mediaAssetId);
      const res = await api.post('/storyboards/generate', {
        prompt: promptToUse,
        targetDuration,
        aspectRatio,
        selectedMediaIds: selectedIds.length > 0 ? selectedIds : undefined,
        includeDemoMedia: true
      });
      return res.data.data;
    },
    onSuccess: data => {
      dispatch(clearSelectedClips());
      dispatch(addToast({ type: 'success', message: `Generated "${data.storyboard.title}"!` }));
      navigate(`/app/storyboard/${data.storyboard.id}`);
    },
    onError: (err: unknown) => {
      const e = err as { response?: { data?: { error?: { message?: string } } } };
      dispatch(
        addToast({
          type: 'error',
          message: e.response?.data?.error?.message || 'Unable to generate storyboard.'
        })
      );
    }
  });

  useEffect(() => {
    const paramQ = searchParams.get('q');
    if (paramQ) {
      setQuery(paramQ);
      searchMutation.mutate(paramQ);
    }
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    searchMutation.mutate(query.trim());
  };

  const toggleMediaType = (t: 'video' | 'image' | 'audio') => {
    setMediaTypes(prev => (prev.includes(t) ? (prev.length > 1 ? prev.filter(x => x !== t) : prev) : [...prev, t]));
  };

  const resetFiltersAndSearch = () => {
    setMediaTypes(['video', 'image']);
    setSourceFilter('');
    setDurationFilter('all');
    if (query.trim()) {
      searchMutation.mutate(query.trim());
    }
  };

  const selectTopMatches = () => {
    const existingIds = new Set(selectedClips.map(c => c.sceneId));
    let added = 0;
    for (const item of results.slice(0, 4)) {
      if (!existingIds.has(item.sceneId)) {
        dispatch(toggleSelectedClip(item));
        added++;
      }
    }
    if (added > 0) {
      dispatch(addToast({ type: 'success', message: `Added top ${added} clip${added > 1 ? 's' : ''} to director basket.` }));
    }
  };

  const toggleBreakdown = (sceneId: string) => {
    setExpandedBreakdownIds(prev => ({ ...prev, [sceneId]: !prev[sceneId] }));
  };

  const renderSourceBadge = (item: SearchResultItem) => {
    if (item.isDemoData || item.sourceType === 'demo') {
      return (
        <span className="px-2.5 py-0.5 rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/25 text-xs font-bold">
          DEMO DATA
        </span>
      );
    }
    if (item.sourceType === 'ugreen_nas') {
      return (
        <span className="px-2.5 py-0.5 rounded-md bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border border-cyan-500/25 text-xs font-semibold">
          UGREEN NAS
        </span>
      );
    }
    return (
      <span className="px-2.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/25 text-xs font-semibold">
        Local Upload
      </span>
    );
  };

  return (
    <div className="max-w-[1440px] mx-auto space-y-5 sm:space-y-6 pb-8 min-w-0">
      {/* Studio Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 sm:gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
            <h1 className="font-display font-bold text-2xl sm:text-3xl lg:text-4xl tracking-tight text-ink">
              AI Search Studio
            </h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-full bg-[#3B82F6]/15 border border-[#3B82F6]/30 text-xs sm:text-sm font-semibold text-blue-700 dark:text-blue-300">
              <Sparkles className="w-3.5 h-3.5 text-[#3B82F6] shrink-0" />
              <span className="truncate max-w-[200px] sm:max-w-none">
                {searchMeta ? `${searchMeta.searchMode} • ${searchMeta.queryEmbeddingModel}` : 'Hybrid Vector + Lexical'}
              </span>
            </span>
          </div>
          <p className="text-xs sm:text-sm sm:text-base text-ink-secondary mt-1">
            Find exact scenes across video, photo, and audio assets using natural language and verified index evidence.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          <Link
            to="/app/library"
            className="inline-flex items-center justify-center gap-2 px-3.5 sm:px-4 py-2 sm:py-2.5 min-h-[42px] sm:min-h-[44px] rounded-xl bg-card hover:bg-hoverSurface border border-borderSubtle hover:border-[#3B82F6]/50 text-xs sm:text-sm font-semibold text-ink transition-colors"
          >
            <FolderOpen className="w-4 h-4 text-[#3B82F6]" />
            Media Library
          </Link>
        </div>
      </div>

      {/* Main 12-Col Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6 items-start">
        {/* Primary Search & Ranked Results (8 cols) */}
        <section className="lg:col-span-8 space-y-4 sm:space-y-5 min-w-0">
          {/* Unified Search & Filters Command Panel */}
          <div className="p-4 sm:p-6 rounded-2xl panel-card space-y-3.5 sm:space-y-4">
            <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-2.5 sm:gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-ink-muted absolute left-3.5 sm:left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Describe any scene, object, emotion, or spoken phrase..."
                  className="w-full pl-10 sm:pl-11 pr-11 py-3 sm:py-3.5 min-h-[46px] sm:min-h-[50px] rounded-xl input-surface text-sm sm:text-base"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => setQuery('')}
                    aria-label="Clear search query"
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center rounded-lg text-ink-muted hover:text-ink hover:bg-hoverSurface transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              <button
                type="submit"
                disabled={searchMutation.isPending || !query.trim()}
                className="w-full sm:w-auto px-5 sm:px-6 py-3 sm:py-3.5 min-h-[46px] sm:min-h-[50px] rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-50 text-white text-xs sm:text-sm md:text-base font-semibold inline-flex items-center justify-center gap-2 shrink-0 transition-colors shadow-lg shadow-blue-600/25"
              >
                {searchMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                Search Library
              </button>
            </form>

            {/* Compact Filters Row */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-1">
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                <span className="text-xs sm:text-sm font-semibold text-ink-muted mr-1 inline-flex items-center gap-1.5">
                  <SlidersHorizontal className="w-3.5 h-3.5" /> Types:
                </span>
                {(
                  [
                    { key: 'video', label: 'Video', Icon: Video },
                    { key: 'image', label: 'Photo', Icon: ImageIcon },
                    { key: 'audio', label: 'Audio', Icon: Music }
                  ] as const
                ).map(({ key, label, Icon }) => {
                  const active = mediaTypes.includes(key);
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => toggleMediaType(key)}
                      aria-pressed={active}
                      className={`inline-flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 sm:py-2 min-h-[38px] sm:min-h-[40px] rounded-xl text-xs sm:text-sm font-semibold border transition-colors ${
                        active
                          ? 'bg-[#2563EB] border-[#2563EB] text-white shadow-sm shadow-blue-600/20'
                          : 'bg-surface border-borderSubtle text-ink-secondary hover:border-[#3B82F6]/45 hover:text-ink'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {label}
                    </button>
                  );
                })}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:flex md:flex-wrap items-center gap-2 w-full md:w-auto">
                <select
                  aria-label="Filter by media source"
                  value={sourceFilter}
                  onChange={e => setSourceFilter(e.target.value as typeof sourceFilter)}
                  className="w-full sm:w-auto px-3 sm:px-3.5 py-2 sm:py-2.5 min-h-[40px] sm:min-h-[42px] rounded-xl input-surface text-xs sm:text-sm font-medium"
                >
                  <option value="">All Sources (NAS + Local + Demo)</option>
                  <option value="ugreen_nas">UGREEN NAS Only</option>
                  <option value="local_upload">Local Uploads Only</option>
                  <option value="demo">DEMO DATA Only</option>
                </select>

                <select
                  aria-label="Filter by clip duration"
                  value={durationFilter}
                  onChange={e => setDurationFilter(e.target.value as DurationPreset)}
                  className="w-full sm:w-auto px-3 sm:px-3.5 py-2 sm:py-2.5 min-h-[40px] sm:min-h-[42px] rounded-xl input-surface text-xs sm:text-sm font-medium"
                >
                  {Object.entries(DURATION_PRESETS).map(([key, val]) => (
                    <option key={key} value={key}>
                      {val.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Example Preset Prompts */}
            <div className="pt-3 border-t border-borderSubtle flex flex-wrap items-center gap-1.5 sm:gap-2">
              <span className="text-xs font-semibold text-ink-muted mr-1">Try queries:</span>
              {EXAMPLE_QUERIES.map(eq => (
                <button
                  key={eq}
                  type="button"
                  onClick={() => {
                    setQuery(eq);
                    searchMutation.mutate(eq);
                  }}
                  className="text-xs sm:text-sm px-2.5 sm:px-3 py-1.5 min-h-[34px] sm:min-h-[36px] rounded-xl bg-surface border border-borderSubtle hover:border-[#3B82F6]/50 hover:text-blue-700 dark:hover:text-blue-200 hover:bg-hoverSurface text-ink-secondary font-medium transition-colors text-left"
                >
                  {eq}
                </button>
              ))}
            </div>
          </div>

          {/* Search Status Bar */}
          {searchMeta && !searchMutation.isPending && (
            <div className="flex flex-wrap items-center justify-between gap-2.5 sm:gap-3 px-1 text-xs sm:text-sm">
              <div className="flex items-center gap-2 text-ink-secondary">
                <span>
                  Found <strong className="text-ink font-bold">{searchMeta.totalMatched}</strong> ranked scene
                  {searchMeta.totalMatched === 1 ? '' : 's'}
                </span>
                <span className="hidden sm:inline text-ink-muted">•</span>
                <span className="hidden sm:inline truncate max-w-[320px] text-ink-muted">"{searchMeta.executedQuery}"</span>
              </div>

              {results.length > 0 && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={selectTopMatches}
                    className="px-3 sm:px-3.5 py-1.5 sm:py-2 min-h-[36px] sm:min-h-[38px] rounded-xl bg-[#3B82F6]/15 border border-[#3B82F6]/35 hover:bg-[#3B82F6]/25 text-xs sm:text-sm font-semibold text-blue-700 dark:text-blue-200 transition-colors"
                  >
                    + Select Top {Math.min(4, results.length)} Clips
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Error Banner */}
          {searchMutation.isError && (
            <div className="p-3.5 sm:p-4 rounded-2xl border border-rose-500/25 bg-rose-500/10 flex flex-wrap items-center justify-between gap-3 text-xs sm:text-sm">
              <div className="flex items-center gap-2 text-rose-700 dark:text-rose-300 font-medium">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
                <span>Could not complete semantic search. Check your backend connection and retry.</span>
              </div>
              <button
                type="button"
                onClick={() => query.trim() && searchMutation.mutate(query.trim())}
                className="px-3.5 sm:px-4 py-2 min-h-[38px] sm:min-h-[40px] rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs sm:text-sm font-semibold shrink-0 transition-colors"
              >
                Retry
              </button>
            </div>
          )}

          {/* Loading Skeleton */}
          {searchMutation.isPending ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="p-3.5 sm:p-4 rounded-2xl panel-card flex flex-col sm:flex-row gap-3.5 sm:gap-4 animate-pulse">
                  <div className="w-full sm:w-48 md:w-52 aspect-video rounded-xl subtle-surface shrink-0" />
                  <div className="flex-1 space-y-2.5 py-1">
                    <div className="h-4 w-1/3 rounded subtle-surface" />
                    <div className="h-3 w-5/6 rounded subtle-surface" />
                    <div className="h-3 w-2/3 rounded subtle-surface" />
                    <div className="h-7 w-28 rounded-lg subtle-surface mt-4" />
                  </div>
                </div>
              ))}
            </div>
          ) : results.length === 0 ? (
            <div className="p-6 sm:p-12 text-center rounded-2xl panel-card border-dashed space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-[#3B82F6]/15 border border-[#3B82F6]/30 flex items-center justify-center mx-auto">
                <Search className="w-6 h-6 text-[#3B82F6]" />
              </div>
              {searchMeta ? (
                <>
                  <h3 className="font-display font-bold text-base sm:text-lg text-ink">No Matching Scenes Found</h3>
                  <p className="text-xs sm:text-sm text-ink-muted max-w-md mx-auto">
                    No indexed footage matched "{searchMeta.executedQuery}" under the active filters. Try clearing source or duration filters or load the demo library if empty.
                  </p>
                  <div className="flex flex-wrap items-center justify-center gap-2.5 sm:gap-3 pt-2">
                    <button
                      type="button"
                      onClick={resetFiltersAndSearch}
                      className="inline-flex items-center justify-center gap-2 px-4 sm:px-5 py-2.5 min-h-[42px] sm:min-h-[44px] rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs sm:text-sm font-semibold transition-colors flex-1 sm:flex-initial"
                    >
                      <RotateCcw className="w-4 h-4" />
                      Reset Filters & Search
                    </button>
                    <Link
                      to="/app/library"
                      className="inline-flex items-center justify-center gap-2 px-4 sm:px-5 py-2.5 min-h-[42px] sm:min-h-[44px] rounded-xl subtle-surface text-xs sm:text-sm font-semibold text-ink hover:bg-hoverSurface transition-colors flex-1 sm:flex-initial"
                    >
                      Open Library
                    </Link>
                  </div>
                </>
              ) : (
                <>
                  <h3 className="font-display font-bold text-base sm:text-lg text-ink">Ready to Search Your Footage</h3>
                  <p className="text-xs sm:text-sm text-ink-muted max-w-md mx-auto">
                    Run a natural language query above to match visual descriptions, spoken transcripts, and indexed metadata across your archive.
                  </p>
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => query.trim() && searchMutation.mutate(query.trim())}
                      className="inline-flex items-center justify-center gap-2 px-5 py-2.5 min-h-[42px] sm:min-h-[44px] rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs sm:text-sm font-semibold shadow-lg shadow-blue-600/25 transition-colors"
                    >
                      <Sparkles className="w-4 h-4" />
                      Run Query Now
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="space-y-3.5">
              {results.map(item => {
                const isSelected = selectedClips.some(c => c.sceneId === item.sceneId);
                const evidence = EVIDENCE_META[item.evidenceSource] || EVIDENCE_META.metadata;
                const isExpanded = Boolean(expandedBreakdownIds[item.sceneId]);

                const rankingDimensions = item.ranking
                  ? [
                      { key: 'Semantic', val: item.ranking.semanticRelevance },
                      { key: 'Visual Quality', val: item.ranking.visualQuality },
                      { key: 'Narrative', val: item.ranking.narrativeValue },
                      { key: 'Resolution', val: item.ranking.resolutionQuality },
                      { key: 'Audio', val: item.ranking.audioSuitability },
                      { key: 'Diversity', val: item.ranking.diversity }
                    ].filter((d): d is { key: string; val: number } => typeof d.val === 'number')
                  : [];

                return (
                  <article
                    key={item.sceneId}
                    className={`p-3.5 sm:p-5 rounded-2xl panel-card transition-all flex flex-col sm:flex-row gap-3.5 sm:gap-4 ${
                      isSelected ? 'ring-2 ring-[#3B82F6]/60 border-[#3B82F6]' : 'hover:border-[#3B82F6]/45'
                    }`}
                  >
                    {/* Clean Thumbnail Preview without overlapping top-left badges */}
                    <button
                      type="button"
                      onClick={() => setPreviewItem(item)}
                      aria-label={`Preview ${item.filename}`}
                      className="w-full sm:w-48 md:w-52 aspect-video rounded-xl overflow-hidden bg-[#090B10] shrink-0 self-start relative group text-left border border-borderSubtle"
                    >
                      <img
                        src={item.thumbnailUrl}
                        alt={item.filename}
                        loading="lazy"
                        className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
                      />
                      <span className="media-overlay absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                        <span className="opacity-0 group-hover:opacity-100 transition-opacity px-3 py-1.5 rounded-full bg-[#090B10]/85 border border-white/20 text-xs font-semibold inline-flex items-center gap-1.5">
                          <Eye className="w-3.5 h-3.5" /> Preview Clip
                        </span>
                      </span>
                      <span className="media-overlay absolute bottom-2 right-2 px-2 py-0.5 rounded-md bg-[#090B10]/85 font-mono text-xs font-medium">
                        {formatSec(item.startTime)}–{formatSec(item.endTime)}
                      </span>
                    </button>

                    {/* Metadata, Evidence & Actions */}
                    <div className="flex-1 min-w-0 flex flex-col justify-between gap-2.5 sm:gap-3">
                      <div className="space-y-2 sm:space-y-2.5">
                        <div className="flex items-start justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => setPreviewItem(item)}
                            className="text-sm sm:text-base font-bold text-ink truncate hover:text-blue-600 dark:hover:text-blue-300 transition-colors text-left"
                            title={item.filename}
                          >
                            {item.filename}
                          </button>
                          <span className="shrink-0 px-2.5 sm:px-3 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-700 dark:text-emerald-400 text-xs font-bold">
                            {Math.round(item.matchScore * 100)}% Match
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className={`px-2.5 py-0.5 rounded-md border text-xs font-semibold ${evidence.tone}`}>
                            {evidence.label}
                          </span>
                          {renderSourceBadge(item)}
                          <span className="px-2.5 py-0.5 rounded-md subtle-surface font-mono text-xs uppercase text-ink-secondary font-medium">
                            {item.mediaType} • {formatSec(item.duration)}
                          </span>
                        </div>

                        <p className="text-xs sm:text-sm leading-relaxed text-ink-secondary">{item.description}</p>

                        {item.transcript && (
                          <p className="text-xs sm:text-sm italic text-cyan-800 dark:text-cyan-300 border-l-2 border-[#06B6D4] pl-2.5 sm:pl-3 py-1 bg-cyan-500/10 rounded-r-md">
                            "{item.transcript}"
                          </p>
                        )}

                        {isExpanded && rankingDimensions.length > 0 && (
                          <div className="p-3 sm:p-3.5 rounded-xl subtle-surface space-y-2 mt-2">
                            <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-1.5 sm:gap-2">
                              {rankingDimensions.map(dim => (
                                <div
                                  key={dim.key}
                                  className="px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg bg-card border border-borderSubtle text-xs flex items-center justify-between sm:justify-start gap-1.5"
                                >
                                  <span className="text-ink-muted font-medium">{dim.key}:</span>
                                  <span className="font-mono font-bold text-ink">{Math.round(dim.val * 100)}%</span>
                                </div>
                              ))}
                            </div>
                            {item.ranking?.explanation && (
                              <p className="text-xs sm:text-sm text-ink-secondary">{item.ranking.explanation}</p>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-3 border-t border-borderSubtle">
                        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 min-w-0">
                          <span
                            className="text-xs text-ink-muted flex items-center gap-1.5 min-w-0"
                            title={item.ranking?.explanation || item.explanation}
                          >
                            <Info className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#3B82F6] shrink-0" />
                            <span className="truncate max-w-[200px] sm:max-w-[300px]">{item.explanation}</span>
                          </span>
                          {rankingDimensions.length > 0 && (
                            <button
                              type="button"
                              onClick={() => toggleBreakdown(item.sceneId)}
                              className="inline-flex items-center gap-1 px-1.5 py-1 min-h-[30px] sm:min-h-[34px] text-xs font-semibold text-blue-600 dark:text-blue-300 hover:underline shrink-0"
                            >
                              {isExpanded ? (
                                <>
                                  Hide factors <ChevronUp className="w-3.5 h-3.5" />
                                </>
                              ) : (
                                <>
                                  Score details <ChevronDown className="w-3.5 h-3.5" />
                                </>
                              )}
                            </button>
                          )}
                        </div>

                        <div className="flex items-center gap-2 w-full sm:w-auto">
                          <button
                            type="button"
                            onClick={() => setPreviewItem(item)}
                            className="inline-flex items-center justify-center gap-1.5 px-3.5 sm:px-4 py-2 min-h-[40px] sm:min-h-[42px] rounded-xl bg-surface border border-borderSubtle hover:border-[#3B82F6]/50 hover:bg-hoverSurface text-ink text-xs sm:text-sm font-semibold transition-colors flex-1 sm:flex-initial"
                          >
                            <Eye className="w-4 h-4" />
                            Preview
                          </button>
                          <button
                            type="button"
                            onClick={() => dispatch(toggleSelectedClip(item))}
                            aria-pressed={isSelected}
                            className={`inline-flex items-center justify-center gap-1.5 px-3.5 sm:px-4 py-2 min-h-[40px] sm:min-h-[42px] rounded-xl text-xs sm:text-sm font-semibold transition-colors flex-1 sm:flex-initial ${
                              isSelected
                                ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
                                : 'bg-[#2563EB] hover:bg-[#1D4ED8] text-white shadow-sm shadow-blue-600/20'
                            }`}
                          >
                            {isSelected ? (
                              <>
                                <Check className="w-4 h-4" /> Selected
                              </>
                            ) : (
                              <>
                                <Plus className="w-4 h-4" /> Select Clip
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        {/* Right Rail: Creative Director Basket & Search History (4 cols) */}
        <aside className="lg:col-span-4 space-y-4 sm:space-y-5 lg:sticky lg:top-24 min-w-0">
          {/* Creative Selection & Storyboard Builder */}
          <div className="p-4 sm:p-6 rounded-2xl panel-card space-y-3.5 sm:space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display font-bold text-base sm:text-lg text-ink flex items-center gap-2">
                <Film className="w-4 h-4 text-[#3B82F6]" />
                Creative Selection ({selectedClips.length})
              </h2>
              {selectedClips.length > 0 && (
                <button
                  type="button"
                  onClick={() => dispatch(clearSelectedClips())}
                  className="px-2.5 py-1 min-h-[32px] sm:min-h-[34px] text-xs font-semibold text-ink-muted hover:text-rose-600 dark:hover:text-rose-400 transition-colors rounded-lg hover:bg-rose-500/10"
                >
                  Clear all
                </button>
              )}
            </div>

            {selectedClips.length === 0 ? (
              <div className="text-xs sm:text-sm text-ink-secondary subtle-surface p-3.5 sm:p-4 rounded-xl leading-relaxed">
                Select specific scenes from search results, or leave blank to let the AI Creative Director select top matches automatically.
              </div>
            ) : (
              <div className="space-y-2 sm:space-y-2.5 max-h-60 overflow-y-auto pr-1">
                {selectedClips.map(clip => (
                  <div
                    key={clip.sceneId}
                    className="flex items-center justify-between gap-2 p-2 sm:p-2.5 rounded-xl subtle-surface text-xs sm:text-sm"
                  >
                    <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
                      <img
                        src={clip.thumbnailUrl}
                        alt={clip.filename}
                        className="w-12 h-8 rounded-lg object-cover shrink-0 bg-[#090B10]"
                      />
                      <div className="min-w-0">
                        <p className="font-semibold text-ink truncate text-xs sm:text-sm">{clip.filename}</p>
                        <p className="text-xs font-mono text-cyan-700 dark:text-cyan-400 font-semibold">
                          {formatSec(clip.startTime)}–{formatSec(clip.endTime)}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => dispatch(toggleSelectedClip(clip))}
                      className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-lg text-ink-muted hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-500/10 shrink-0 transition-colors"
                      aria-label={`Remove ${clip.filename}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-3.5 sm:space-y-4 pt-3 border-t border-borderSubtle">
              <div>
                <label className="block text-xs sm:text-sm font-semibold text-ink-secondary mb-1.5 sm:mb-2">Creative Brief / Concept</label>
                <textarea
                  rows={2}
                  value={creativePrompt}
                  onChange={e => setCreativePrompt(e.target.value)}
                  placeholder={query || 'Describe your target video cut...'}
                  className="w-full px-3 sm:px-3.5 py-2 sm:py-2.5 rounded-xl input-surface text-xs sm:text-sm resize-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-ink-secondary mb-1.5 sm:mb-2 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" /> Target Duration
                  </label>
                  <select
                    aria-label="Target storyboard duration"
                    value={targetDuration}
                    onChange={e => setTargetDuration(Number(e.target.value))}
                    className="w-full px-3 sm:px-3.5 py-2 sm:py-2.5 min-h-[42px] sm:min-h-[44px] rounded-xl input-surface text-xs sm:text-sm font-medium"
                  >
                    <option value={15}>15 seconds</option>
                    <option value={30}>30 seconds</option>
                    <option value={45}>45 seconds</option>
                    <option value={60}>60 seconds</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-ink-secondary mb-1.5 sm:mb-2 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5" /> Aspect Ratio
                  </label>
                  <div className="grid grid-cols-4 gap-1 sm:gap-1.5">
                    {(['16:9', '9:16', '1:1', '4:5'] as AspectRatio[]).map(ar => (
                      <button
                        key={ar}
                        type="button"
                        onClick={() => setAspectRatio(ar)}
                        className={`py-2 sm:py-2.5 min-h-[40px] sm:min-h-[42px] rounded-lg text-xs font-mono font-semibold border transition-colors ${
                          aspectRatio === ar
                            ? 'bg-[#2563EB] border-[#2563EB] text-white shadow-sm shadow-blue-600/20'
                            : 'bg-surface border-borderSubtle text-ink-secondary hover:border-[#3B82F6]/50'
                        }`}
                      >
                        {ar}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => generateStoryboardMutation.mutate()}
                disabled={generateStoryboardMutation.isPending}
                className="w-full py-3 sm:py-3.5 min-h-[46px] sm:min-h-[50px] rounded-xl bg-gradient-to-r from-[#2563EB] to-[#06B6D4] hover:opacity-95 disabled:opacity-50 text-white text-xs sm:text-sm md:text-base font-bold inline-flex items-center justify-center gap-2 shadow-lg shadow-blue-600/25 transition-opacity"
              >
                {generateStoryboardMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Generating Storyboard...
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

          {/* Search History Card */}
          <div className="p-4 sm:p-6 rounded-2xl panel-card space-y-3">
            <h2 className="font-display font-bold text-base sm:text-lg text-ink flex items-center gap-2">
              <History className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
              Recent Searches
            </h2>
            {!historyData || historyData.length === 0 ? (
              <p className="text-xs sm:text-sm text-ink-muted">
                Your recent semantic queries will appear here for one-click reuse.
              </p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {historyData.slice(0, 8).map(h => (
                  <div
                    key={h.id}
                    className="group flex items-center justify-between gap-2 p-2 sm:p-2.5 rounded-xl bg-surface border border-borderSubtle hover:border-[#3B82F6]/45 transition-colors text-xs sm:text-sm"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setQuery(h.query);
                        searchMutation.mutate(h.query);
                      }}
                      className="text-left flex-1 min-w-0 py-1 hover:text-blue-600 dark:hover:text-blue-300 transition-colors"
                    >
                      <span className="block truncate font-semibold text-ink text-xs sm:text-sm">{h.query}</span>
                      <span className="block text-xs text-ink-muted mt-0.5 font-mono">
                        {h.resultCount} match{h.resultCount === 1 ? '' : 'es'}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteHistoryMutation.mutate(h.id)}
                      className="opacity-75 sm:opacity-0 sm:group-hover:opacity-100 w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-lg text-ink-muted hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-500/10 transition-all shrink-0"
                      aria-label="Delete history item"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* Clip Preview & Ranking Breakdown Modal */}
      {previewItem && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-card border border-borderSubtle overflow-hidden max-h-[92vh] flex flex-col shadow-elevated">
            <div className="px-4 sm:px-6 py-3.5 sm:py-4 border-b border-borderSubtle flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
                <h3 className="font-display font-bold text-base sm:text-lg text-ink truncate">{previewItem.filename}</h3>
                {previewItem.isDemoData && (
                  <span className="px-2 sm:px-2.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300 text-xs font-bold shrink-0">
                    DEMO DATA
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => setPreviewItem(null)}
                className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center rounded-xl text-ink-muted hover:text-ink hover:bg-hoverSurface transition-colors shrink-0"
                aria-label="Close clip preview"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 sm:p-6 overflow-y-auto space-y-4 sm:space-y-5">
              <div className="aspect-video rounded-xl overflow-hidden bg-[#090B10] border border-borderSubtle relative">
                {previewItem.sourceType === 'local_upload' && previewItem.mediaType === 'video' && previewItem.playbackUrl ? (
                  <video
                    src={`${previewItem.playbackUrl}#t=${previewItem.startTime},${previewItem.endTime}`}
                    controls
                    className="w-full h-full object-contain"
                  />
                ) : previewItem.sourceType === 'local_upload' && previewItem.mediaType === 'audio' && previewItem.playbackUrl ? (
                  <div className="w-full h-full flex flex-col items-center justify-center p-4 sm:p-6 gap-3 sm:gap-4 bg-[#090B10] text-white">
                    <Music className="w-8 h-8 sm:w-10 sm:h-10 text-cyan-400" />
                    <audio
                      src={`${previewItem.playbackUrl}#t=${previewItem.startTime},${previewItem.endTime}`}
                      controls
                      className="w-full max-w-md"
                    />
                  </div>
                ) : (
                  <img
                    src={previewItem.thumbnailUrl}
                    alt={previewItem.filename}
                    className="w-full h-full object-contain"
                  />
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3 text-xs sm:text-sm">
                <div className="p-3 sm:p-3.5 rounded-xl subtle-surface">
                  <p className="text-xs text-ink-muted">Matched Window</p>
                  <p className="font-mono font-bold text-ink mt-1 truncate">
                    {formatSec(previewItem.startTime)} – {formatSec(previewItem.endTime)}
                  </p>
                </div>
                <div className="p-3 sm:p-3.5 rounded-xl subtle-surface">
                  <p className="text-xs text-ink-muted">Match Score</p>
                  <p className="font-mono font-bold text-emerald-600 dark:text-emerald-400 mt-1 truncate">
                    {Math.round(previewItem.matchScore * 100)}%
                  </p>
                </div>
                <div className="p-3 sm:p-3.5 rounded-xl subtle-surface col-span-2 sm:col-span-1">
                  <p className="text-xs text-ink-muted">Evidence Source</p>
                  <p className="font-semibold text-ink mt-1 truncate">
                    {(EVIDENCE_META[previewItem.evidenceSource] || EVIDENCE_META.metadata).label}
                  </p>
                </div>
              </div>

              <div className="space-y-1.5 sm:space-y-2 text-xs sm:text-sm">
                <p className="font-bold text-ink">Scene Description</p>
                <p className="text-ink-secondary leading-relaxed">{previewItem.description}</p>
                {previewItem.transcript && (
                  <p className="italic text-cyan-700 dark:text-cyan-300 border-l-2 border-[#06B6D4] pl-2.5 sm:pl-3 bg-cyan-500/10 py-1 sm:py-1.5 rounded-r-md">
                    "{previewItem.transcript}"
                  </p>
                )}
              </div>

              {previewItem.ranking && (
                <div className="p-3.5 sm:p-4 rounded-xl subtle-surface space-y-2.5">
                  <p className="text-xs sm:text-sm font-bold text-ink">ClipRankingAgent Breakdown</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 sm:gap-2 text-xs">
                    {[
                      { label: 'Semantic', value: previewItem.ranking.semanticRelevance },
                      { label: 'Visual Quality', value: previewItem.ranking.visualQuality },
                      { label: 'Narrative', value: previewItem.ranking.narrativeValue },
                      { label: 'Resolution', value: previewItem.ranking.resolutionQuality },
                      { label: 'Audio', value: previewItem.ranking.audioSuitability },
                      { label: 'Diversity', value: previewItem.ranking.diversity }
                    ]
                      .filter((d): d is { label: string; value: number } => typeof d.value === 'number')
                      .map(dim => (
                        <div key={dim.label} className="p-2 sm:p-2.5 rounded-lg bg-surface border border-borderSubtle flex items-center justify-between">
                          <span className="text-ink-muted font-medium truncate mr-1">{dim.label}</span>
                          <span className="font-mono font-bold text-ink">{Math.round(dim.value * 100)}%</span>
                        </div>
                      ))}
                  </div>
                  <p className="text-xs sm:text-sm text-ink-secondary">{previewItem.ranking.explanation}</p>
                </div>
              )}

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2.5 sm:gap-3 pt-3 border-t border-borderSubtle">
                <button
                  type="button"
                  onClick={() => setPreviewItem(null)}
                  className="px-4 sm:px-5 py-2.5 min-h-[42px] sm:min-h-[44px] rounded-xl subtle-surface text-xs sm:text-sm font-semibold text-ink-secondary hover:bg-hoverSurface transition-colors flex-1 sm:flex-initial text-center"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => {
                    dispatch(toggleSelectedClip(previewItem));
                    setPreviewItem(null);
                  }}
                  className="px-4 sm:px-5 py-2.5 min-h-[42px] sm:min-h-[44px] rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs sm:text-sm font-semibold transition-colors flex-1 sm:flex-initial text-center"
                >
                  {selectedClips.some(c => c.sceneId === previewItem.sceneId)
                    ? 'Remove from Selection'
                    : 'Select Clip for Storyboard'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
