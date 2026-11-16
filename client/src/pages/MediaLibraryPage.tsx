import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useDispatch } from 'react-redux';
import {
  Search,
  Upload,
  Grid,
  List,
  Heart,
  Trash2,
  RefreshCw,
  FolderPlus,
  X,
  Film,
  Image as ImageIcon,
  Music,
  ShieldAlert,
  CheckCircle2,
  Loader2,
  HardDrive,
  FilterX,
  Sparkles,
  Check,
  AlertCircle,
  Eye
} from 'lucide-react';
import { api } from '../services/api';
import { addToast, toggleSelectedClip, clearSelectedClips } from '../store/studioSlice';

interface MediaItem {
  id: string;
  filename: string;
  sourceType: 'ugreen_nas' | 'local_upload' | 'demo';
  mediaType: 'video' | 'image' | 'audio';
  mimeType: string;
  fileSize: number;
  duration: number;
  width: number;
  height: number;
  frameRate: number;
  processingStatus: string;
  isFavorite: boolean;
  isDemoData: boolean;
  collections: string[];
  thumbnailUrl: string;
  playbackUrl: string;
  createdAt: string;
  metadata?: {
    summary?: string;
    tags?: string[];
    sha256Hash?: string;
    perceptualHash?: string;
    duplicateOfId?: string;
    qualityMetrics?: { overallScore?: number; notes?: string };
  };
}

function formatBytes(bytes: number): string {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

function formatDurationBadge(seconds: number): string {
  if (!seconds || seconds <= 0) return '';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function getResolutionTag(width: number): string {
  if (width >= 3840) return '4K';
  if (width >= 1920) return '1080p';
  if (width >= 1280) return '720p';
  if (width > 0) return 'SD';
  return '';
}

export function MediaLibraryPage() {
  const [activeTab, setActiveTab] = useState<'library' | 'quality'>('library');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [search, setSearch] = useState('');
  const [mediaType, setMediaType] = useState('');
  const [sourceType, setSourceType] = useState('');
  const [minWidth, setMinWidth] = useState('');
  const [durationRange, setDurationRange] = useState('');
  const [favoriteOnly, setFavoriteOnly] = useState(false);
  const [selectedCollection, setSelectedCollection] = useState('');
  const [sortBy, setSortBy] = useState('createdAt');
  const [page, setPage] = useState(1);

  const [isDraggingPage, setIsDraggingPage] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const [inspectedAssetId, setInspectedAssetId] = useState<string | null>(null);
  const [showNewColModal, setShowNewColModal] = useState(false);
  const [newColName, setNewColName] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const {
    data: mediaData,
    isLoading,
    isError: mediaError,
    refetch: refetchMedia
  } = useQuery({
    queryKey: ['media', page, search, mediaType, sourceType, minWidth, durationRange, favoriteOnly, selectedCollection, sortBy],
    queryFn: async () => {
      const params: Record<string, string | number | boolean> = { page, limit: 24, sortBy };
      if (search) params.search = search;
      if (mediaType) params.mediaType = mediaType;
      if (sourceType) params.sourceType = sourceType;
      if (minWidth) params.minWidth = minWidth;
      if (durationRange === 'short') {
        params.minDuration = 1;
        params.maxDuration = 15;
      } else if (durationRange === 'medium') {
        params.minDuration = 15;
        params.maxDuration = 30;
      } else if (durationRange === 'long') {
        params.minDuration = 30;
      }
      if (favoriteOnly) params.favorite = true;
      if (selectedCollection) params.collection = selectedCollection;
      const res = await api.get('/media', { params });
      return res.data.data;
    }
  });

  const { data: collectionsData } = useQuery({
    queryKey: ['collections'],
    queryFn: async () => {
      const res = await api.get('/media/collections');
      return res.data.data.collections as Array<{ id: string; name: string; color: string; mediaCount: number }>;
    }
  });

  const { data: statsSummary } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const res = await api.get('/dashboard/stats');
      return res.data.data.stats;
    }
  });

  const {
    data: qualityReport,
    isLoading: qualityLoading,
    isError: qualityError,
    refetch: refetchQuality
  } = useQuery({
    queryKey: ['quality-report'],
    enabled: activeTab === 'quality',
    queryFn: async () => {
      const res = await api.get('/media/quality-report');
      return res.data.data;
    }
  });

  const { data: inspectedDetail, isLoading: inspectedLoading } = useQuery({
    queryKey: ['media-detail', inspectedAssetId],
    enabled: Boolean(inspectedAssetId),
    queryFn: async () => {
      const res = await api.get(`/media/${inspectedAssetId}`);
      return res.data.data;
    }
  });

  const uploadMutation = useMutation({
    mutationFn: async (files: FileList) => {
      const formData = new FormData();
      Array.from(files).forEach(f => formData.append('files', f));
      const res = await api.post('/media/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      return res.data.data;
    },
    onSuccess: data => {
      setShowUploadModal(false);
      queryClient.invalidateQueries({ queryKey: ['media'] });
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      dispatch(
        addToast({
          type: 'success',
          message: `Uploaded ${data.assets.length} file(s). Background AI analysis queued!`
        })
      );
    },
    onError: (err: unknown) => {
      const e = err as { response?: { data?: { error?: { message?: string } } } };
      dispatch(addToast({ type: 'error', message: e.response?.data?.error?.message || 'Upload failed' }));
    }
  });

  const seedMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post('/media/seed-demo');
      return res.data.data;
    },
    onSuccess: data => {
      queryClient.invalidateQueries({ queryKey: ['media'] });
      queryClient.invalidateQueries({ queryKey: ['collections'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      dispatch(
        addToast({
          type: 'success',
          message: data.alreadySeeded ? 'Demo library already loaded.' : `Loaded ${data.assetsCreated} DEMO DATA files!`
        })
      );
    }
  });

  const favMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.patch(`/media/${id}/favorite`);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['media'] });
      queryClient.invalidateQueries({ queryKey: ['media-detail', inspectedAssetId] });
    }
  });

  const analyzeMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.post(`/media/${id}/analyze`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      dispatch(addToast({ type: 'info', message: 'Re-analysis job queued.' }));
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/media/${id}?confirm=true`);
    },
    onSuccess: () => {
      setConfirmDeleteId(null);
      setInspectedAssetId(null);
      queryClient.invalidateQueries({ queryKey: ['media'] });
      queryClient.invalidateQueries({ queryKey: ['quality-report'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      dispatch(addToast({ type: 'success', message: 'Asset index entry removed.' }));
    }
  });

  const createCollectionMutation = useMutation({
    mutationFn: async (name: string) => {
      await api.post('/media/collections', { name });
    },
    onSuccess: () => {
      setNewColName('');
      setShowNewColModal(false);
      queryClient.invalidateQueries({ queryKey: ['collections'] });
      dispatch(addToast({ type: 'success', message: 'Collection created!' }));
    }
  });

  const updateCollectionsMutation = useMutation({
    mutationFn: async ({ id, collections }: { id: string; collections: string[] }) => {
      const res = await api.patch(`/media/${id}/collections`, { collections });
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['media'] });
      queryClient.invalidateQueries({ queryKey: ['media-detail', inspectedAssetId] });
      dispatch(addToast({ type: 'success', message: 'Asset collections updated!' }));
    }
  });

  const items: MediaItem[] = mediaData?.items || [];
  const pagination = mediaData?.pagination || { page: 1, totalPages: 1, total: 0 };
  const demoCount = statsSummary?.demoMediaCount ?? 0;

  const hasActiveFilters = Boolean(
    search || mediaType || sourceType || minWidth || durationRange || favoriteOnly || selectedCollection
  );

  const clearFilters = () => {
    setSearch('');
    setMediaType('');
    setSourceType('');
    setMinWidth('');
    setDurationRange('');
    setFavoriteOnly(false);
    setSelectedCollection('');
    setPage(1);
  };

  const toggleSelectId = (id: string) => {
    setSelectedIds(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
  };

  const sendSelectionToStudio = () => {
    const chosen = items.filter(it => selectedIds.includes(it.id));
    if (chosen.length === 0) return;
    dispatch(clearSelectedClips());
    for (const item of chosen) {
      dispatch(
        toggleSelectedClip({
          sceneId: item.id,
          mediaAssetId: item.id,
          filename: item.filename,
          sourceType: item.sourceType,
          mediaType: item.mediaType,
          thumbnailUrl: item.thumbnailUrl,
          playbackUrl: item.playbackUrl,
          duration: item.duration || 5,
          startTime: 0,
          endTime: Math.min(item.duration || 5, 10),
          description: item.metadata?.summary || item.filename,
          matchScore: 1,
          evidenceSource: 'metadata',
          explanation: 'Selected directly from Media Library',
          isDemoData: item.isDemoData
        })
      );
    }
    setSelectedIds([]);
    dispatch(addToast({ type: 'success', message: `Sent ${chosen.length} clip(s) to AI Search & Storyboard Studio.` }));
    navigate('/app/search');
  };

  return (
    <div
      className="max-w-[1400px] mx-auto space-y-5 sm:space-y-6 relative pb-8 min-w-0"
      onDragOver={e => {
        e.preventDefault();
        setIsDraggingPage(true);
      }}
      onDragLeave={e => {
        if (e.currentTarget === e.target) setIsDraggingPage(false);
      }}
      onDrop={e => {
        e.preventDefault();
        setIsDraggingPage(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          uploadMutation.mutate(e.dataTransfer.files);
        }
      }}
    >
      {/* Full-Page Drag Overlay */}
      {isDraggingPage && (
        <div className="fixed inset-0 z-50 bg-[#3B82F6]/10 backdrop-blur-sm border-2 border-dashed border-[#3B82F6] flex items-center justify-center p-4 pointer-events-none">
          <div className="p-6 sm:p-8 max-w-sm sm:max-w-md w-full rounded-2xl bg-card border border-borderSubtle text-center space-y-2.5 shadow-elevated">
            <Upload className="w-10 h-10 sm:w-11 sm:h-11 text-[#3B82F6] mx-auto" />
            <p className="font-display font-bold text-lg sm:text-xl text-ink">Drop Media Files to Upload</p>
            <p className="text-xs sm:text-sm text-ink-muted">MP4, MOV, MKV, AVI, WEBM, JPG, PNG, WEBP, MP3, WAV, M4A, AAC</p>
          </div>
        </div>
      )}

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".mp4,.mov,.mkv,.avi,.webm,.jpg,.jpeg,.png,.webp,.mp3,.wav,.m4a,.aac"
        className="hidden"
        onChange={e => {
          if (e.target.files && e.target.files.length > 0) {
            uploadMutation.mutate(e.target.files);
            e.target.value = '';
          }
        }}
      />

      {/* Page Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
            <h1 className="font-display text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-ink">
              AI Media Library
            </h1>
            <span className="px-2.5 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-mono font-semibold bg-card border border-borderSubtle text-ink-secondary">
              {pagination.total} assets
            </span>
          </div>
          <p className="text-sm sm:text-base text-ink-secondary mt-1">
            Browse authorized local uploads, UGREEN NAS mounts, and isolated demo scenes.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
          {demoCount === 0 && (
            <button
              onClick={() => seedMutation.mutate()}
              disabled={seedMutation.isPending}
              className="inline-flex items-center justify-center gap-2 px-3.5 sm:px-5 py-2.5 min-h-[44px] sm:min-h-[46px] rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/25 text-amber-700 dark:text-amber-300 text-xs sm:text-sm font-semibold transition-colors flex-1 sm:flex-initial"
            >
              {seedMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              Load Demo Data (150)
            </button>
          )}

          <button
            onClick={() => setShowNewColModal(true)}
            className="inline-flex items-center justify-center gap-2 px-3.5 sm:px-5 py-2.5 min-h-[44px] sm:min-h-[46px] rounded-xl bg-card hover:bg-hoverSurface border border-borderSubtle hover:border-[#3B82F6]/50 text-xs sm:text-sm font-semibold text-ink transition-colors flex-1 sm:flex-initial"
          >
            <FolderPlus className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
            New Collection
          </button>

          <button
            onClick={() => setShowUploadModal(true)}
            disabled={uploadMutation.isPending}
            className="inline-flex items-center justify-center gap-2 px-4 sm:px-5 py-2.5 min-h-[44px] sm:min-h-[46px] rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs sm:text-sm font-semibold transition-colors shadow-lg shadow-blue-600/25 flex-1 sm:flex-initial"
          >
            {uploadMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            Upload Media
          </button>
        </div>
      </div>

      {/* Top Navigation Tabs & Selection Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-borderSubtle pb-3.5">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          <button
            onClick={() => setActiveTab('library')}
            className={`px-3.5 sm:px-5 py-2 sm:py-2.5 min-h-[40px] sm:min-h-[44px] rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap transition-colors ${
              activeTab === 'library'
                ? 'bg-[#2563EB] text-white shadow-lg shadow-blue-600/25'
                : 'text-ink-secondary hover:text-ink hover:bg-card'
            }`}
          >
            Media Browser
          </button>
          <button
            onClick={() => setActiveTab('quality')}
            className={`px-3.5 sm:px-5 py-2 sm:py-2.5 min-h-[40px] sm:min-h-[44px] rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap transition-colors flex items-center gap-2 ${
              activeTab === 'quality'
                ? 'bg-[#2563EB] text-white shadow-lg shadow-blue-600/25'
                : 'text-ink-secondary hover:text-ink hover:bg-card'
            }`}
          >
            <ShieldAlert className="w-4 h-4 shrink-0" />
            Duplicate & Quality Audit
          </button>
        </div>

        {selectedIds.length > 0 && (
          <div className="flex items-center justify-between sm:justify-start gap-2.5 sm:gap-3 px-3.5 sm:px-4 py-1.5 sm:py-2 rounded-xl bg-[#3B82F6]/15 border border-[#3B82F6]/30 text-xs sm:text-sm">
            <span className="font-semibold text-blue-700 dark:text-blue-300">{selectedIds.length} selected</span>
            <div className="flex items-center gap-2">
              <button
                onClick={sendSelectionToStudio}
                className="px-3 sm:px-4 py-1.5 min-h-[36px] sm:min-h-[38px] rounded-lg bg-[#2563EB] text-white text-xs sm:text-sm font-semibold hover:bg-[#1D4ED8] transition-colors whitespace-nowrap"
              >
                Send to Studio →
              </button>
              <button
                onClick={() => setSelectedIds([])}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-ink-muted hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                aria-label="Clear selection"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {activeTab === 'quality' ? (
        <div className="space-y-5 sm:space-y-6">
          {qualityError ? (
            <div className="p-3.5 sm:p-4 rounded-2xl bg-rose-500/10 border border-rose-500/25 flex flex-wrap items-center justify-between gap-3 text-xs sm:text-sm text-rose-700 dark:text-rose-300 font-medium">
              <span className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                Failed to compute Duplicate & Quality Audit report.
              </span>
              <button onClick={() => refetchQuality()} className="px-4 py-2 min-h-[40px] rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs sm:text-sm font-semibold transition-colors">
                Retry
              </button>
            </div>
          ) : qualityLoading ? (
            <div className="h-48 rounded-2xl panel-card animate-pulse" />
          ) : qualityReport ? (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                <div className="p-4 sm:p-6 rounded-2xl panel-card">
                  <p className="text-xs sm:text-sm font-semibold text-ink-muted">Assets Audited</p>
                  <p className="font-display text-2xl sm:text-3xl font-bold text-ink mt-1">{qualityReport.totalScanned}</p>
                </div>
                <div className="p-4 sm:p-6 rounded-2xl panel-card">
                  <p className="text-xs sm:text-sm font-semibold text-ink-muted">Duplicate Groups</p>
                  <p className="font-display text-2xl sm:text-3xl font-bold mt-1 text-amber-600 dark:text-amber-400">
                    {qualityReport.exactDuplicateGroups.length + qualityReport.similarClipGroups.length}
                  </p>
                </div>
                <div className="p-4 sm:p-6 rounded-2xl panel-card">
                  <p className="text-xs sm:text-sm font-semibold text-ink-muted">Low-Resolution Clips</p>
                  <p className="font-display text-2xl sm:text-3xl font-bold mt-1 text-rose-600 dark:text-rose-400">
                    {qualityReport.lowQualityClips.length}
                  </p>
                </div>
                <div className="p-4 sm:p-6 rounded-2xl panel-card">
                  <p className="text-xs sm:text-sm font-semibold text-ink-muted">Potential Savings</p>
                  <p className="font-display text-2xl sm:text-3xl font-bold mt-1 text-emerald-600 dark:text-emerald-400">
                    {formatBytes(qualityReport.potentialStorageSavingsBytes)}
                  </p>
                </div>
              </div>

              <div className="p-4 sm:p-6 rounded-2xl panel-card space-y-4">
                <div>
                  <h2 className="font-display font-bold text-base sm:text-xl text-ink">Exact & Perceptual Duplicate Groups</h2>
                  <p className="text-xs sm:text-sm text-ink-muted mt-1">
                    Original files are never auto-deleted. Click any flagged file to inspect metadata or manually remove its index entry.
                  </p>
                </div>
                {qualityReport.exactDuplicateGroups.length === 0 &&
                qualityReport.similarClipGroups.length === 0 ? (
                  <p className="text-sm sm:text-base text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 shrink-0" /> No duplicates detected in your media library.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {[...qualityReport.exactDuplicateGroups, ...qualityReport.similarClipGroups].map(
                      (g: {
                        matchType: string;
                        hashKey: string;
                        potentialSavingsBytes: number;
                        assets: Array<{ id: string; filename: string; fileSize: number; isDemoData: boolean }>;
                      }) => (
                        <div key={g.hashKey} className="p-3.5 sm:p-4 rounded-xl subtle-surface">
                          <div className="flex flex-wrap items-center justify-between gap-2 text-xs sm:text-sm mb-3">
                            <span className="font-mono font-bold text-amber-700 dark:text-amber-300 uppercase">
                              {g.matchType.replace('_', ' ')}
                            </span>
                            <span className="text-emerald-700 dark:text-emerald-400 font-semibold">
                              Reclaimable: {formatBytes(g.potentialSavingsBytes)}
                            </span>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-2.5">
                            {g.assets.map(a => (
                              <button
                                key={a.id}
                                type="button"
                                onClick={() => setInspectedAssetId(a.id)}
                                className="flex items-center justify-between px-3.5 sm:px-4 py-2.5 sm:py-3 min-h-[44px] sm:min-h-[48px] rounded-xl bg-card border border-borderSubtle hover:border-[#3B82F6]/50 text-xs sm:text-sm text-left transition-colors"
                              >
                                <span className="truncate font-semibold text-ink pr-2">
                                  {a.filename}{' '}
                                  {a.isDemoData && <span className="text-amber-700 dark:text-amber-300 font-semibold">(DEMO)</span>}
                                </span>
                                <span className="text-ink-muted font-mono shrink-0">{formatBytes(a.fileSize)}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )
                    )}
                  </div>
                )}
              </div>

              {qualityReport.lowQualityClips.length > 0 && (
                <div className="p-4 sm:p-6 rounded-2xl panel-card space-y-3.5">
                  <h2 className="font-display font-bold text-base sm:text-xl text-ink">Low-Quality & Sub-HD Clips</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-3">
                    {qualityReport.lowQualityClips.map(
                      (clip: { id: string; filename: string; resolution: string; reason: string }) => (
                        <button
                          key={clip.id}
                          type="button"
                          onClick={() => setInspectedAssetId(clip.id)}
                          className="p-3.5 sm:p-4 rounded-xl bg-rose-500/10 border border-rose-500/25 hover:border-rose-400 text-xs sm:text-sm text-left transition-colors"
                        >
                          <p className="font-bold text-ink truncate">{clip.filename}</p>
                          <p className="text-rose-700 dark:text-rose-300 mt-1 font-medium">{clip.reason}</p>
                        </button>
                      )
                    )}
                  </div>
                </div>
              )}
            </>
          ) : null}
        </div>
      ) : (
        <>
          {/* Collections Quick Strip */}
          {collectionsData && collectionsData.length > 0 && (
            <div className="flex items-center gap-2 sm:gap-2.5 overflow-x-auto pb-1.5 -mx-1 px-1 sm:mx-0 sm:px-0">
              <button
                onClick={() => {
                  setSelectedCollection('');
                  setPage(1);
                }}
                className={`px-3.5 sm:px-4 py-2 min-h-[38px] sm:min-h-[40px] rounded-full text-xs sm:text-sm font-semibold shrink-0 border transition-colors ${
                  !selectedCollection
                    ? 'bg-[#2563EB] text-white border-[#2563EB] shadow-lg shadow-blue-600/25'
                    : 'bg-card border-borderSubtle text-ink-secondary hover:text-ink hover:border-[#3B82F6]/40'
                }`}
              >
                All Media
              </button>
              {collectionsData.map(col => (
                <button
                  key={col.id}
                  onClick={() => {
                    setSelectedCollection(selectedCollection === col.name ? '' : col.name);
                    setPage(1);
                  }}
                  className={`inline-flex items-center gap-2 px-3.5 sm:px-4 py-2 min-h-[38px] sm:min-h-[40px] rounded-full text-xs sm:text-sm font-semibold shrink-0 border transition-colors ${
                    selectedCollection === col.name
                      ? 'bg-[#3B82F6]/15 border-[#3B82F6]/40 text-blue-700 dark:text-blue-200'
                      : 'bg-card border-borderSubtle text-ink-secondary hover:text-ink hover:border-[#3B82F6]/40'
                  }`}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: col.color || '#3B82F6' }}
                  />
                  {col.name}
                  <span className="font-mono text-xs opacity-75">{col.mediaCount}</span>
                </button>
              ))}
            </div>
          )}

          {/* Filter & Search Toolbar */}
          <div className="p-3 sm:p-4 rounded-2xl panel-card flex flex-wrap items-center gap-2 sm:gap-2.5">
            <div className="relative w-full lg:flex-1 lg:min-w-[220px]">
              <Search className="w-4 h-4 text-ink-muted absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={e => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Search by filename, tag, or description..."
                className="w-full pl-10 pr-3.5 py-2.5 min-h-[42px] sm:min-h-[44px] rounded-xl input-surface text-xs sm:text-sm"
              />
            </div>

            <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 sm:gap-2.5 w-full lg:w-auto">
              <select
                value={mediaType}
                onChange={e => {
                  setMediaType(e.target.value);
                  setPage(1);
                }}
                aria-label="Filter by media type"
                className="w-full sm:w-auto px-3 sm:px-3.5 py-2.5 min-h-[42px] sm:min-h-[44px] rounded-xl input-surface text-xs sm:text-sm font-medium"
              >
                <option value="">All Types</option>
                <option value="video">Videos</option>
                <option value="image">Images</option>
                <option value="audio">Audio</option>
              </select>

              <select
                value={sourceType}
                onChange={e => {
                  setSourceType(e.target.value);
                  setPage(1);
                }}
                aria-label="Filter by source"
                className="w-full sm:w-auto px-3 sm:px-3.5 py-2.5 min-h-[42px] sm:min-h-[44px] rounded-xl input-surface text-xs sm:text-sm font-medium"
              >
                <option value="">All Sources</option>
                <option value="local_upload">Local Uploads</option>
                <option value="ugreen_nas">UGREEN NAS</option>
                <option value="demo">DEMO DATA</option>
              </select>

              <select
                value={minWidth}
                onChange={e => {
                  setMinWidth(e.target.value);
                  setPage(1);
                }}
                aria-label="Filter by resolution"
                className="w-full sm:w-auto px-3 sm:px-3.5 py-2.5 min-h-[42px] sm:min-h-[44px] rounded-xl input-surface text-xs sm:text-sm font-medium"
              >
                <option value="">Any Resolution</option>
                <option value="1920">1080p HD+</option>
                <option value="3840">4K UHD</option>
              </select>

              <select
                value={durationRange}
                onChange={e => {
                  setDurationRange(e.target.value);
                  setPage(1);
                }}
                aria-label="Filter by duration"
                className="w-full sm:w-auto px-3 sm:px-3.5 py-2.5 min-h-[42px] sm:min-h-[44px] rounded-xl input-surface text-xs sm:text-sm font-medium"
              >
                <option value="">Any Duration</option>
                <option value="short">Short (&lt; 15s)</option>
                <option value="medium">Medium (15–30s)</option>
                <option value="long">Long (&gt; 30s)</option>
              </select>

              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value)}
                aria-label="Sort media"
                className="w-full sm:w-auto px-3 sm:px-3.5 py-2.5 min-h-[42px] sm:min-h-[44px] rounded-xl input-surface text-xs sm:text-sm font-medium col-span-2 sm:col-span-1"
              >
                <option value="createdAt">Newest First</option>
                <option value="duration">Duration</option>
                <option value="fileSize">File Size</option>
                <option value="name">Filename</option>
              </select>
            </div>

            <div className="flex items-center justify-between sm:justify-start gap-2 w-full lg:w-auto lg:ml-auto pt-1 sm:pt-0">
              <button
                onClick={() => {
                  setFavoriteOnly(f => !f);
                  setPage(1);
                }}
                className={`px-3.5 py-2 sm:py-2.5 min-h-[42px] sm:min-h-[44px] rounded-xl border text-xs sm:text-sm inline-flex items-center justify-center gap-1.5 sm:gap-2 transition-colors flex-1 sm:flex-initial ${
                  favoriteOnly
                    ? 'bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-300 font-semibold'
                    : 'input-surface text-ink-secondary hover:text-ink font-medium'
                }`}
              >
                <Heart className="w-4 h-4 shrink-0" />
                Favorites
              </button>

              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="px-3 py-2 sm:py-2.5 min-h-[42px] sm:min-h-[44px] rounded-xl text-xs sm:text-sm font-semibold text-ink-muted hover:text-rose-600 dark:hover:text-rose-400 inline-flex items-center gap-1.5 transition-colors"
                  title="Reset all filters"
                >
                  <FilterX className="w-4 h-4 shrink-0" />
                  Reset
                </button>
              )}

              <div className="flex items-center subtle-surface rounded-xl overflow-hidden p-0.5 ml-auto sm:ml-0">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center rounded-lg transition-colors ${
                    viewMode === 'grid' ? 'bg-[#2563EB] text-white' : 'text-ink-muted hover:text-ink'
                  }`}
                  aria-label="Grid view"
                >
                  <Grid className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center rounded-lg transition-colors ${
                    viewMode === 'list' ? 'bg-[#2563EB] text-white' : 'text-ink-muted hover:text-ink'
                  }`}
                  aria-label="List view"
                >
                  <List className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Error Recovery Banner */}
          {mediaError && (
            <div className="p-3.5 sm:p-4 rounded-2xl bg-rose-500/10 border border-rose-500/25 flex flex-wrap items-center justify-between gap-3 text-xs sm:text-sm text-rose-700 dark:text-rose-300 font-medium">
              <span className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                Unable to load media assets. Check your server connection.
              </span>
              <button onClick={() => refetchMedia()} className="px-4 py-2 min-h-[40px] rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs sm:text-sm font-semibold transition-colors">
                Retry
              </button>
            </div>
          )}

          {/* Media Grid or List */}
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5 sm:gap-4">
              {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
                <div key={i} className="h-60 rounded-2xl panel-card animate-pulse" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="py-12 sm:py-16 px-4 text-center rounded-2xl panel-card border-dashed space-y-4">
              <HardDrive className="w-10 h-10 sm:w-11 sm:h-11 text-ink-muted mx-auto" />
              <div>
                <h3 className="font-display font-bold text-lg sm:text-xl text-ink">
                  {hasActiveFilters ? 'No media files match these filters' : 'Your Media Library is Empty'}
                </h3>
                <p className="text-xs sm:text-sm text-ink-muted mt-1.5 max-w-md mx-auto">
                  {hasActiveFilters
                    ? 'Try adjusting or clearing your search and resolution filters.'
                    : 'Drag & drop videos, photos, or audio anywhere on this screen, connect your UGREEN NAS in Settings, or load the isolated 150-clip demo dataset.'}
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2.5 sm:gap-3">
                {hasActiveFilters ? (
                  <button
                    onClick={clearFilters}
                    className="px-5 sm:px-6 py-2.5 sm:py-3 min-h-[44px] sm:min-h-[46px] rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs sm:text-sm font-semibold transition-colors"
                  >
                    Clear All Filters
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() => setShowUploadModal(true)}
                      className="px-5 sm:px-6 py-2.5 sm:py-3 min-h-[44px] sm:min-h-[46px] rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors"
                    >
                      <Upload className="w-4 h-4" />
                      Upload Media
                    </button>
                    <button
                      onClick={() => seedMutation.mutate()}
                      className="px-5 sm:px-6 py-2.5 sm:py-3 min-h-[44px] sm:min-h-[46px] rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/25 text-amber-700 dark:text-amber-300 text-xs sm:text-sm font-semibold transition-colors"
                    >
                      Load Isolated Demo Library (150)
                    </button>
                  </>
                )}
              </div>
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5 sm:gap-4">
              {items.map(item => {
                const isSelected = selectedIds.includes(item.id);
                const resTag = getResolutionTag(item.width);
                const durLabel = formatDurationBadge(item.duration);

                return (
                  <div
                    key={item.id}
                    onClick={() => setInspectedAssetId(item.id)}
                    className={`group rounded-2xl panel-card overflow-hidden cursor-pointer transition-all flex flex-col hover:shadow-elevated ${
                      isSelected
                        ? 'border-[#3B82F6] ring-2 ring-[#3B82F6]/35'
                        : 'hover:border-[#3B82F6]/45'
                    }`}
                  >
                    <div className="relative aspect-video bg-[#090B10] overflow-hidden">
                      <img
                        src={item.thumbnailUrl}
                        alt={item.filename}
                        loading="lazy"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />

                      {/* Inspect Icon Hint */}
                      <div className="media-overlay absolute inset-0 flex items-center justify-center pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity bg-black/35">
                        <span className="px-3.5 py-1.5 rounded-full bg-[#090B10]/85 backdrop-blur-sm text-white text-xs font-semibold inline-flex items-center gap-1.5 border border-white/20">
                          <Eye className="w-4 h-4" />
                          Inspect
                        </span>
                      </div>

                      {/* Duration / Type overlay for non-demo uploaded files */}
                      {!item.isDemoData && durLabel && (
                        <span className="media-overlay absolute bottom-2 right-2 px-2 py-0.5 rounded bg-[#090B10]/85 font-mono text-xs text-white">
                          {durLabel}
                        </span>
                      )}
                    </div>

                    <div className="p-3.5 sm:p-4 flex-1 flex flex-col justify-between gap-3">
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <button
                              type="button"
                              onClick={e => {
                                e.stopPropagation();
                                toggleSelectId(item.id);
                              }}
                              aria-label={`Select ${item.filename}`}
                              className={`w-5 h-5 rounded border flex-shrink-0 flex items-center justify-center transition-colors ${
                                isSelected
                                  ? 'bg-[#2563EB] border-[#2563EB] text-white'
                                  : 'bg-surface border-borderStrong text-transparent hover:border-[#3B82F6]'
                              }`}
                            >
                              {isSelected && <Check className="w-3.5 h-3.5" />}
                            </button>
                            <p className="text-xs sm:text-sm font-bold text-ink truncate flex-1" title={item.filename}>
                              {item.filename}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={e => {
                              e.stopPropagation();
                              favMutation.mutate(item.id);
                            }}
                            aria-label={item.isFavorite ? 'Remove favorite' : 'Mark favorite'}
                            className={`w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-xl transition-colors shrink-0 ${
                              item.isFavorite
                                ? 'text-rose-500 dark:text-rose-400 bg-rose-500/15'
                                : 'text-ink-muted hover:text-rose-500 dark:hover:text-rose-400 hover:bg-rose-500/10'
                            }`}
                          >
                            <Heart className={`w-4 h-4 ${item.isFavorite ? 'fill-current' : ''}`} />
                          </button>
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5 mt-2 text-xs">
                          {resTag && (
                            <span className="px-2 py-0.5 rounded bg-surface border border-borderSubtle font-mono font-semibold text-ink-secondary">
                              {resTag}
                            </span>
                          )}
                          <span className="px-2 py-0.5 rounded bg-surface border border-borderSubtle font-mono text-ink-muted">
                            {formatBytes(item.fileSize)}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded border uppercase font-semibold ${
                              item.sourceType === 'demo'
                                ? 'bg-amber-500/10 border-amber-500/25 text-amber-700 dark:text-amber-300'
                                : item.sourceType === 'ugreen_nas'
                                ? 'bg-cyan-500/10 border-cyan-500/25 text-cyan-700 dark:text-cyan-300'
                                : 'bg-emerald-500/10 border-emerald-500/25 text-emerald-700 dark:text-emerald-400'
                            }`}
                          >
                            {item.sourceType === 'ugreen_nas'
                              ? 'NAS'
                              : item.sourceType === 'local_upload'
                              ? 'Upload'
                              : 'DEMO'}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-2.5 border-t border-borderSubtle text-xs">
                        <span className="text-ink-muted capitalize truncate font-medium">
                          {item.mediaType}
                          {item.collections?.length > 0 ? ` • ${item.collections[0]}` : ''}
                        </span>
                        <span
                          className={`px-2.5 py-0.5 rounded-full capitalize font-semibold border ${
                            item.processingStatus === 'completed'
                              ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-700 dark:text-emerald-400'
                              : item.processingStatus === 'failed'
                              ? 'bg-rose-500/10 border-rose-500/25 text-rose-700 dark:text-rose-300'
                              : 'bg-cyan-500/10 border-cyan-500/25 text-cyan-700 dark:text-cyan-300'
                          }`}
                        >
                          {item.processingStatus}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-2xl panel-card overflow-x-auto -mx-1 sm:mx-0">
              <table className="w-full text-left text-xs sm:text-sm min-w-[640px]">
                <thead className="border-b border-borderSubtle text-ink-muted bg-surface">
                  <tr>
                    <th className="py-3 sm:py-3.5 px-3 sm:px-4 font-semibold">Asset</th>
                    <th className="py-3 sm:py-3.5 px-3 sm:px-4 font-semibold">Source</th>
                    <th className="py-3 sm:py-3.5 px-3 sm:px-4 font-semibold">Resolution</th>
                    <th className="py-3 sm:py-3.5 px-3 sm:px-4 font-semibold">Duration</th>
                    <th className="py-3 sm:py-3.5 px-3 sm:px-4 font-semibold">Size</th>
                    <th className="py-3 sm:py-3.5 px-3 sm:px-4 font-semibold">Status</th>
                    <th className="py-3 sm:py-3.5 px-3 sm:px-4 text-right font-semibold">Fav</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-borderSubtle">
                  {items.map(item => (
                    <tr
                      key={item.id}
                      onClick={() => setInspectedAssetId(item.id)}
                      className="hover:bg-hoverSurface/60 cursor-pointer transition-colors"
                    >
                      <td className="py-2.5 sm:py-3 px-3 sm:px-4 font-semibold text-ink">
                        <div className="flex items-center gap-2.5 sm:gap-3">
                          <img
                            src={item.thumbnailUrl}
                            alt={item.filename}
                            className="w-12 h-8 sm:w-14 sm:h-9 rounded-md object-cover shrink-0 bg-[#090B10]"
                          />
                          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                            {item.mediaType === 'video' ? (
                              <Film className="w-4 h-4 text-[#3B82F6] shrink-0" />
                            ) : item.mediaType === 'image' ? (
                              <ImageIcon className="w-4 h-4 text-cyan-600 dark:text-cyan-400 shrink-0" />
                            ) : (
                              <Music className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                            )}
                            <span className="truncate max-w-[140px] sm:max-w-[220px] md:max-w-none">{item.filename}</span>
                            {item.isDemoData && (
                              <span className="px-1.5 sm:px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/25 text-amber-700 dark:text-amber-300 text-xs font-bold shrink-0">
                                DEMO
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-2.5 sm:py-3 px-3 sm:px-4 capitalize text-ink-secondary">{item.sourceType.replace('_', ' ')}</td>
                      <td className="py-2.5 sm:py-3 px-3 sm:px-4 font-mono text-ink-secondary">
                        {item.width}x{item.height}
                      </td>
                      <td className="py-2.5 sm:py-3 px-3 sm:px-4 font-mono text-ink-secondary">
                        {item.duration > 0 ? `${item.duration}s` : '—'}
                      </td>
                      <td className="py-2.5 sm:py-3 px-3 sm:px-4 font-mono text-ink-secondary">{formatBytes(item.fileSize)}</td>
                      <td className="py-2.5 sm:py-3 px-3 sm:px-4 capitalize font-medium text-ink">{item.processingStatus}</td>
                      <td className="py-2.5 sm:py-3 px-3 sm:px-4 text-right">
                        <button
                          type="button"
                          onClick={e => {
                            e.stopPropagation();
                            favMutation.mutate(item.id);
                          }}
                          className={`w-8 h-8 sm:w-9 sm:h-9 inline-flex items-center justify-center rounded-xl transition-colors ${
                            item.isFavorite
                              ? 'text-rose-500 dark:text-rose-400 bg-rose-500/15'
                              : 'text-ink-muted hover:text-rose-500 dark:hover:text-rose-400 hover:bg-rose-500/10'
                          }`}
                          aria-label={item.isFavorite ? 'Remove favorite' : 'Mark favorite'}
                        >
                          <Heart className={`w-4 h-4 ${item.isFavorite ? 'fill-current' : ''}`} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
              <p className="text-xs sm:text-sm text-ink-muted font-medium text-center sm:text-left">
                Page {pagination.page} of {pagination.totalPages} ({pagination.total} assets)
              </p>
              <div className="flex items-center justify-center gap-2.5">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  className="px-4 sm:px-5 py-2 sm:py-2.5 min-h-[40px] sm:min-h-[44px] rounded-xl panel-card text-xs sm:text-sm font-semibold text-ink disabled:opacity-40 hover:border-[#3B82F6]/50 transition-colors flex-1 sm:flex-initial"
                >
                  Previous
                </button>
                <button
                  disabled={page >= pagination.totalPages}
                  onClick={() => setPage(p => p + 1)}
                  className="px-4 sm:px-5 py-2 sm:py-2.5 min-h-[40px] sm:min-h-[44px] rounded-xl panel-card text-xs sm:text-sm font-semibold text-ink disabled:opacity-40 hover:border-[#3B82F6]/50 transition-colors flex-1 sm:flex-initial"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Upload Dropzone Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="w-full max-w-lg rounded-2xl bg-card border border-borderSubtle overflow-hidden shadow-elevated max-h-[92vh] flex flex-col">
            <div className="px-4 sm:px-6 py-3.5 sm:py-4 border-b border-borderSubtle flex items-center justify-between">
              <h3 className="font-display font-bold text-base sm:text-lg text-ink">Upload Media to ReelMind</h3>
              <button
                onClick={() => setShowUploadModal(false)}
                className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center rounded-xl text-ink-muted hover:text-ink hover:bg-hoverSurface transition-colors"
                aria-label="Close upload modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 sm:p-6 space-y-4 overflow-y-auto">
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={e => e.preventDefault()}
                onDrop={e => {
                  e.preventDefault();
                  if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                    uploadMutation.mutate(e.dataTransfer.files);
                  }
                }}
                className="p-6 sm:p-10 rounded-2xl border-2 border-dashed border-[#3B82F6]/45 hover:border-[#3B82F6] bg-[#3B82F6]/10 text-center cursor-pointer transition-colors space-y-2.5"
              >
                {uploadMutation.isPending ? (
                  <Loader2 className="w-8 h-8 sm:w-9 sm:h-9 text-[#3B82F6] animate-spin mx-auto" />
                ) : (
                  <Upload className="w-8 h-8 sm:w-9 sm:h-9 text-[#3B82F6] mx-auto" />
                )}
                <p className="text-sm sm:text-base font-bold text-ink">
                  {uploadMutation.isPending
                    ? 'Uploading & queuing AI indexing pipeline...'
                    : 'Click to browse or drag & drop files here'}
                </p>
                <p className="text-xs sm:text-sm text-ink-muted">
                  Supports MP4, MOV, MKV, AVI, WEBM, JPG, PNG, WEBP, MP3, WAV, M4A, AAC
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Asset Inspector Modal */}
      {inspectedAssetId && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="w-full max-w-3xl rounded-2xl bg-card border border-borderSubtle overflow-hidden max-h-[92vh] flex flex-col shadow-elevated">
            <div className="px-4 sm:px-6 py-3.5 sm:py-4 border-b border-borderSubtle flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
                <h3 className="font-display font-bold text-base sm:text-lg text-ink truncate">
                  {inspectedDetail?.asset?.filename || 'Loading Asset...'}
                </h3>
                {inspectedDetail?.asset?.isDemoData && (
                  <span className="px-2 sm:px-2.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/25 text-amber-700 dark:text-amber-300 text-xs font-bold shrink-0">
                    DEMO DATA
                  </span>
                )}
              </div>
              <button
                onClick={() => setInspectedAssetId(null)}
                className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center rounded-xl text-ink-muted hover:text-ink hover:bg-hoverSurface transition-colors shrink-0"
                aria-label="Close inspector"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {inspectedLoading || !inspectedDetail ? (
              <div className="p-6 sm:p-8 space-y-4">
                <div className="aspect-video rounded-xl subtle-surface animate-pulse" />
                <div className="h-20 rounded-xl subtle-surface animate-pulse" />
              </div>
            ) : (
              <div className="p-4 sm:p-6 overflow-y-auto space-y-4 sm:space-y-5">
                <div className="aspect-video rounded-xl overflow-hidden bg-[#090B10] border border-borderSubtle relative">
                  {inspectedDetail.asset.sourceType === 'local_upload' &&
                  inspectedDetail.asset.mediaType === 'video' ? (
                    <video src={inspectedDetail.asset.playbackUrl} controls className="w-full h-full object-contain" />
                  ) : (
                    <img
                      src={inspectedDetail.asset.thumbnailUrl}
                      alt={inspectedDetail.asset.filename}
                      className="w-full h-full object-contain"
                    />
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 text-xs sm:text-sm">
                  <div className="p-3 sm:p-3.5 rounded-xl subtle-surface">
                    <p className="text-xs text-ink-muted">Resolution</p>
                    <p className="font-mono font-bold text-ink mt-1 truncate">
                      {inspectedDetail.asset.width}x{inspectedDetail.asset.height}
                    </p>
                  </div>
                  <div className="p-3 sm:p-3.5 rounded-xl subtle-surface">
                    <p className="text-xs text-ink-muted">Duration / FPS</p>
                    <p className="font-mono font-bold text-ink mt-1 truncate">
                      {inspectedDetail.asset.duration}s • {inspectedDetail.asset.frameRate}fps
                    </p>
                  </div>
                  <div className="p-3 sm:p-3.5 rounded-xl subtle-surface">
                    <p className="text-xs text-ink-muted">File Size</p>
                    <p className="font-mono font-bold text-ink mt-1 truncate">
                      {formatBytes(inspectedDetail.asset.fileSize)}
                    </p>
                  </div>
                  <div className="p-3 sm:p-3.5 rounded-xl subtle-surface">
                    <p className="text-xs text-ink-muted">Source Location</p>
                    <p className="font-bold text-ink capitalize mt-1 truncate">
                      {inspectedDetail.asset.sourceType.replace('_', ' ')}
                    </p>
                  </div>
                </div>

                {inspectedDetail.asset.metadata?.duplicateOfId && (
                  <div className="p-3 sm:p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/25 text-xs sm:text-sm text-amber-700 dark:text-amber-300 font-medium break-all">
                    Exact SHA-256 duplicate detected matching asset ID{' '}
                    <span className="font-mono font-bold">{inspectedDetail.asset.metadata.duplicateOfId}</span>.
                  </div>
                )}

                {collectionsData && collectionsData.length > 0 && (
                  <div>
                    <h4 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-ink-muted mb-2 sm:mb-2.5">Collections</h4>
                    <div className="flex flex-wrap gap-2">
                      {collectionsData.map(col => {
                        const currentCols: string[] = inspectedDetail.asset.collections || [];
                        const active = currentCols.includes(col.name);
                        return (
                          <button
                            key={col.id}
                            onClick={() => {
                              const nextCols = active
                                ? currentCols.filter(c => c !== col.name)
                                : [...currentCols, col.name];
                              updateCollectionsMutation.mutate({
                                id: inspectedDetail.asset.id,
                                collections: nextCols
                              });
                            }}
                            className={`px-3 sm:px-3.5 py-1.5 sm:py-2 min-h-[36px] sm:min-h-[38px] rounded-xl text-xs sm:text-sm border transition-colors ${
                              active
                                ? 'bg-[#3B82F6]/15 border-[#3B82F6]/45 text-blue-700 dark:text-blue-200 font-semibold'
                                : 'subtle-surface text-ink-secondary hover:text-ink'
                            }`}
                          >
                            {active ? '✓ ' : '+ '}
                            {col.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div>
                  <h4 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-ink-muted mb-2 sm:mb-2.5">
                    Indexed Scenes & Timestamps ({inspectedDetail.scenes.length})
                  </h4>
                  <div className="space-y-2 sm:space-y-2.5">
                    {inspectedDetail.scenes.map(
                      (s: {
                        id: string;
                        startTime: number;
                        endTime: number;
                        description: string;
                        analysisSource: string;
                        transcript?: string;
                      }) => (
                        <div key={s.id} className="p-3 sm:p-3.5 rounded-xl subtle-surface text-xs sm:text-sm">
                          <div className="flex flex-wrap items-center justify-between gap-1 font-mono text-cyan-700 dark:text-cyan-400 font-semibold mb-1.5">
                            <span>
                              {s.startTime}s – {s.endTime}s
                            </span>
                            <span className="text-xs text-ink-muted font-sans">Evidence: {s.analysisSource}</span>
                          </div>
                          <p className="text-ink-secondary leading-relaxed">{s.description}</p>
                          {s.transcript && (
                            <p className="text-cyan-800 dark:text-cyan-300 italic mt-1.5 border-l-2 border-[#06B6D4] pl-2.5">
                              Transcript: "{s.transcript}"
                            </p>
                          )}
                        </div>
                      )
                    )}
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 sm:gap-3 pt-3.5 border-t border-borderSubtle">
                  <button
                    onClick={() => analyzeMutation.mutate(inspectedDetail.asset.id)}
                    className="inline-flex items-center justify-center gap-2 px-4 sm:px-5 py-2.5 min-h-[42px] sm:min-h-[44px] rounded-xl subtle-surface hover:border-[#3B82F6]/50 text-xs sm:text-sm font-semibold text-ink transition-colors flex-1 sm:flex-initial"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Re-analyze Media
                  </button>
                  <button
                    onClick={() => setConfirmDeleteId(inspectedDetail.asset.id)}
                    className="inline-flex items-center justify-center gap-2 px-4 sm:px-5 py-2.5 min-h-[42px] sm:min-h-[44px] rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/25 text-rose-700 dark:text-rose-300 text-xs sm:text-sm font-semibold transition-colors flex-1 sm:flex-initial"
                  >
                    <Trash2 className="w-4 h-4" />
                    Remove Asset
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Confirm Delete Dialog */}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-[60] bg-black/75 flex items-center justify-center p-3 sm:p-4">
          <div className="w-full max-w-sm rounded-2xl bg-card border border-borderSubtle p-5 sm:p-6 space-y-4 shadow-elevated">
            <h3 className="font-display font-bold text-base sm:text-lg text-ink">Confirm Media Removal</h3>
            <p className="text-xs sm:text-sm text-ink-secondary leading-relaxed">
              This removes the asset from your ReelMind index (original NAS media is never automatically deleted). Continue?
            </p>
            <div className="flex items-center justify-end gap-2.5">
              <button
                onClick={() => setConfirmDeleteId(null)}
                className="px-4 sm:px-5 py-2 sm:py-2.5 min-h-[40px] sm:min-h-[44px] rounded-xl subtle-surface text-xs sm:text-sm font-semibold text-ink hover:bg-hoverSurface transition-colors flex-1 sm:flex-initial"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteMutation.mutate(confirmDeleteId)}
                className="px-4 sm:px-5 py-2 sm:py-2.5 min-h-[40px] sm:min-h-[44px] rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs sm:text-sm font-semibold transition-colors flex-1 sm:flex-initial"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Collection Modal */}
      {showNewColModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="w-full max-w-sm rounded-2xl bg-card border border-borderSubtle p-5 sm:p-6 space-y-4 shadow-elevated">
            <h3 className="font-display font-bold text-base sm:text-lg text-ink">Create Media Collection</h3>
            <input
              type="text"
              value={newColName}
              onChange={e => setNewColName(e.target.value)}
              placeholder="e.g., Summer 2026 Highlights"
              className="w-full px-3.5 sm:px-4 py-2.5 sm:py-3 min-h-[44px] sm:min-h-[46px] rounded-xl input-surface text-sm sm:text-base"
            />
            <div className="flex items-center justify-end gap-2.5">
              <button
                onClick={() => setShowNewColModal(false)}
                className="px-4 sm:px-5 py-2 sm:py-2.5 min-h-[40px] sm:min-h-[44px] rounded-xl subtle-surface text-xs sm:text-sm font-semibold text-ink hover:bg-hoverSurface transition-colors flex-1 sm:flex-initial"
              >
                Cancel
              </button>
              <button
                onClick={() => createCollectionMutation.mutate(newColName)}
                disabled={!newColName.trim()}
                className="px-4 sm:px-5 py-2 sm:py-2.5 min-h-[40px] sm:min-h-[44px] rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-40 text-white text-xs sm:text-sm font-semibold transition-colors flex-1 sm:flex-initial"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
