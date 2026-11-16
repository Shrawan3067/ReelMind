import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useDispatch } from 'react-redux';
import {
  Play,
  Pause,
  Undo2,
  Redo2,
  Save,
  Download,
  RefreshCw,
  Lock,
  Unlock,
  ArrowLeft,
  ArrowRight,
  Music,
  Film,
  Sparkles,
  Loader2,
  X,
  Plus,
  Trash2,
  Copy,
  Check,
  Search,
  AlertCircle
} from 'lucide-react';
import { AspectRatio, EvidenceSource, StoryboardData, StoryboardScene, TransitionType } from '@reelmind/shared';
import { api } from '../services/api';
import { addToast } from '../store/studioSlice';

const ASPECT_RATIO_CLASSES: Record<AspectRatio, string> = {
  '16:9': 'aspect-video max-w-2xl',
  '9:16': 'aspect-[9/16] max-w-[260px]',
  '1:1': 'aspect-square max-w-[380px]',
  '4:5': 'aspect-[4/5] max-w-[340px]'
};

const EVIDENCE_LABELS: Record<EvidenceSource, string> = {
  visual_analysis: 'Visual Analysis',
  transcript: 'Audio Transcript',
  hybrid: 'Visual + Transcript',
  metadata: 'Metadata & Scene Index'
};

export function StoryboardStudioPage() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const dispatch = useDispatch();

  const [draft, setDraft] = useState<StoryboardData | null>(null);
  const [undoStack, setUndoStack] = useState<StoryboardData[]>([]);
  const [redoStack, setRedoStack] = useState<StoryboardData[]>([]);
  const [selectedSceneIdx, setSelectedSceneIdx] = useState(0);
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);

  const [isPlayingSequence, setIsPlayingSequence] = useState(false);
  const [sceneElapsed, setSceneElapsed] = useState(0);

  const [regenPrompt, setRegenPrompt] = useState('');
  const [exportModal, setExportModal] = useState<{ format: string; filename: string; content: string; note: string } | null>(null);
  const [copiedExport, setCopiedExport] = useState(false);
  const [showAddClipModal, setShowAddClipModal] = useState(false);
  const [clipSearchQuery, setClipSearchQuery] = useState('');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);

  const { data: libraryClips, isLoading: clipsLoading } = useQuery({
    queryKey: ['storyboard-clip-picker', clipSearchQuery],
    enabled: showAddClipModal,
    queryFn: async () => {
      const res = await api.get('/media', {
        params: { page: 1, limit: 16, search: clipSearchQuery || undefined }
      });
      return res.data.data.items;
    }
  });

  const { data: allStoryboards } = useQuery({
    queryKey: ['storyboards'],
    queryFn: async () => {
      const res = await api.get('/storyboards');
      return res.data.data.storyboards;
    }
  });

  const activeId = id || allStoryboards?.[0]?.id;

  const {
    data: fetchedStoryboard,
    isLoading,
    isError,
    refetch
  } = useQuery({
    queryKey: ['storyboard', activeId],
    enabled: Boolean(activeId),
    queryFn: async () => {
      const res = await api.get(`/storyboards/${activeId}`);
      return res.data.data.storyboard as StoryboardData;
    }
  });

  useEffect(() => {
    if (fetchedStoryboard) {
      setDraft(fetchedStoryboard);
      setUndoStack([]);
      setRedoStack([]);
      setSelectedSceneIdx(0);
      setSceneElapsed(0);
      setIsPlayingSequence(false);
      setHasUnsavedChanges(false);
    }
  }, [fetchedStoryboard]);

  useEffect(() => {
    if (!isPlayingSequence || !draft || draft.scenes.length === 0) return;

    const scene = draft.scenes[selectedSceneIdx];
    if (!scene) {
      setIsPlayingSequence(false);
      return;
    }
    const sceneDuration = Math.max(0.5, scene.timelineEndTime - scene.timelineStartTime);

    const interval = setInterval(() => {
      setSceneElapsed(prev => {
        const next = prev + 0.1;
        if (next >= sceneDuration) {
          if (selectedSceneIdx < draft.scenes.length - 1) {
            setSelectedSceneIdx(idx => idx + 1);
            return 0;
          } else {
            setIsPlayingSequence(false);
            return 0;
          }
        }
        return next;
      });
    }, 100);

    return () => clearInterval(interval);
  }, [isPlayingSequence, draft, selectedSceneIdx]);

  useEffect(() => {
    const scene = draft?.scenes[selectedSceneIdx];
    const vid = videoRef.current;
    if (!vid || !scene || scene.sourceType !== 'local_upload') return;
    if (isPlayingSequence) {
      vid.currentTime = scene.sourceStartTime;
      vid.play().catch(() => {});
    } else {
      vid.pause();
    }
  }, [selectedSceneIdx, isPlayingSequence, draft?.scenes]);

  const saveMutation = useMutation({
    mutationFn: async (payload: StoryboardData) => {
      const res = await api.patch(`/storyboards/${payload.id}`, payload);
      return res.data.data.storyboard as StoryboardData;
    },
    onSuccess: saved => {
      setDraft(saved);
      setHasUnsavedChanges(false);
      queryClient.invalidateQueries({ queryKey: ['storyboard', saved.id] });
      dispatch(addToast({ type: 'success', message: `Saved v${saved.version}` }));
    },
    onError: (err: unknown) => {
      const e = err as { response?: { data?: { error?: { message?: string } } } };
      dispatch(addToast({ type: 'error', message: e.response?.data?.error?.message || 'Save failed' }));
    }
  });

  useEffect(() => {
    if (!hasUnsavedChanges || !draft?.id) return;
    const timer = setTimeout(() => {
      saveMutation.mutate(draft);
    }, 3000);
    return () => clearTimeout(timer);
  }, [draft, hasUnsavedChanges]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (!draft) return;

      if (e.code === 'Space') {
        e.preventDefault();
        setSceneElapsed(0);
        setIsPlayingSequence(p => !p);
      } else if (e.key === 'ArrowLeft') {
        setSelectedSceneIdx(i => Math.max(0, i - 1));
        setSceneElapsed(0);
      } else if (e.key === 'ArrowRight') {
        setSelectedSceneIdx(i => Math.min(draft.scenes.length - 1, i + 1));
        setSceneElapsed(0);
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (draft.id) saveMutation.mutate(draft);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [draft]);

  const regenSceneMutation = useMutation({
    mutationFn: async ({ sceneId, instruction }: { sceneId: string; instruction?: string }) => {
      const res = await api.post(`/storyboards/${draft!.id}/regenerate-scene`, { sceneId, instruction });
      return res.data.data.storyboard as StoryboardData;
    },
    onSuccess: updated => {
      if (draft) setUndoStack(u => [...u, draft]);
      setDraft(updated);
      setRegenPrompt('');
      setHasUnsavedChanges(false);
      dispatch(addToast({ type: 'success', message: 'Scene regenerated with alternative footage!' }));
    },
    onError: (err: unknown) => {
      const e = err as { response?: { data?: { error?: { message?: string } } } };
      dispatch(addToast({ type: 'error', message: e.response?.data?.error?.message || 'Regeneration failed' }));
    }
  });

  const exportPlanMutation = useMutation({
    mutationFn: async (format: 'json' | 'edl') => {
      if (hasUnsavedChanges && draft?.id) {
        const savedRes = await api.patch(`/storyboards/${draft.id}`, draft);
        setDraft(savedRes.data.data.storyboard as StoryboardData);
        setHasUnsavedChanges(false);
      }
      const res = await api.post(`/storyboards/${draft!.id}/export-plan`, { format });
      return res.data.data;
    },
    onSuccess: data => {
      setCopiedExport(false);
      setExportModal({
        format: data.format,
        filename: data.filename,
        note: data.note,
        content: data.format === 'edl' ? data.content : JSON.stringify(data.plan, null, 2)
      });
    },
    onError: () => {
      dispatch(addToast({ type: 'error', message: 'Could not generate production plan export.' }));
    }
  });

  const recalculateLocalTimeline = (scenes: StoryboardScene[]): { scenes: StoryboardScene[]; actualDuration: number } => {
    let cursor = 0;
    const nextScenes = scenes.map((s, order) => {
      const len = Math.max(0.5, Number((s.sourceEndTime - s.sourceStartTime).toFixed(2)));
      const clampedEnd = Math.min(s.sourceDuration, Number((s.sourceStartTime + len).toFixed(2)));
      const effectiveLen = Math.max(0.5, Number((clampedEnd - s.sourceStartTime).toFixed(2)));
      const tStart = Number(cursor.toFixed(2));
      const tEnd = Number((cursor + effectiveLen).toFixed(2));
      cursor = tEnd;
      return {
        ...s,
        order,
        sourceEndTime: clampedEnd,
        timelineStartTime: tStart,
        timelineEndTime: tEnd
      };
    });
    return { scenes: nextScenes, actualDuration: Number(cursor.toFixed(2)) };
  };

  const applyEdit = (updater: (current: StoryboardData) => StoryboardData) => {
    if (!draft) return;
    setUndoStack(prev => [...prev.slice(-19), draft]);
    setRedoStack([]);
    const next = updater(draft);
    const recalc = recalculateLocalTimeline(next.scenes);
    setDraft({ ...next, scenes: recalc.scenes, actualDuration: recalc.actualDuration });
    setHasUnsavedChanges(true);
  };

  const handleUndo = () => {
    if (!draft || undoStack.length === 0) return;
    const previous = undoStack[undoStack.length - 1];
    setRedoStack(r => [...r, draft]);
    setUndoStack(u => u.slice(0, -1));
    setDraft(previous);
    setHasUnsavedChanges(true);
  };

  const handleRedo = () => {
    if (!draft || redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setUndoStack(u => [...u, draft]);
    setRedoStack(r => r.slice(0, -1));
    setDraft(next);
    setHasUnsavedChanges(true);
  };

  const moveScene = (fromIdx: number, toIdx: number) => {
    if (!draft || toIdx < 0 || toIdx >= draft.scenes.length || fromIdx === toIdx) return;
    applyEdit(curr => {
      const arr = [...curr.scenes];
      const [moved] = arr.splice(fromIdx, 1);
      arr.splice(toIdx, 0, moved);
      return { ...curr, scenes: arr };
    });
    setSelectedSceneIdx(toIdx);
  };

  const copyExportToClipboard = async () => {
    if (!exportModal) return;
    try {
      await navigator.clipboard.writeText(exportModal.content);
      setCopiedExport(true);
      dispatch(addToast({ type: 'success', message: 'Production plan copied to clipboard' }));
      setTimeout(() => setCopiedExport(false), 2000);
    } catch {
      dispatch(addToast({ type: 'error', message: 'Clipboard copy not supported in this context' }));
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-[1480px] mx-auto space-y-5">
        <div className="h-20 rounded-2xl panel-card animate-pulse" />
        <div className="grid lg:grid-cols-12 gap-5">
          <div className="lg:col-span-8 h-[460px] rounded-2xl panel-card animate-pulse" />
          <div className="lg:col-span-4 h-[460px] rounded-2xl panel-card animate-pulse" />
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="max-w-3xl mx-auto py-16 text-center panel-card rounded-2xl p-8 space-y-4">
        <AlertCircle className="w-11 h-11 text-rose-600 dark:text-rose-400 mx-auto" />
        <h2 className="font-display text-2xl font-bold text-ink">Could Not Load Storyboard</h2>
        <p className="text-base text-ink-secondary">
          The requested storyboard may have been deleted or could not be reached.
        </p>
        <div className="flex items-center justify-center gap-3 pt-1">
          <button
            type="button"
            onClick={() => refetch()}
            className="px-5 py-2.5 min-h-[44px] rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-sm font-semibold transition-colors"
          >
            Retry
          </button>
          <Link to="/app/search" className="inline-flex items-center justify-center px-5 py-2.5 min-h-[44px] rounded-xl subtle-surface text-sm font-semibold text-ink hover:bg-hoverSurface transition-colors">
            Back to AI Search
          </Link>
        </div>
      </div>
    );
  }

  if (!draft) {
    return (
      <div className="max-w-3xl mx-auto py-16 text-center panel-card rounded-2xl p-8 space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-[#3B82F6]/15 border border-[#3B82F6]/30 flex items-center justify-center mx-auto">
          <Film className="w-7 h-7 text-[#3B82F6]" />
        </div>
        <div>
          <h2 className="font-display text-2xl font-bold text-ink">No Storyboard Selected</h2>
          <p className="text-base text-ink-secondary mt-1.5 max-w-md mx-auto">
            Generate an autonomous storyboard cut from natural language in AI Search Studio or the Command Center.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <Link
            to="/app/search"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 min-h-[46px] rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-sm sm:text-base font-semibold shadow-lg shadow-blue-600/25 transition-colors"
          >
            <Sparkles className="w-4 h-4" />
            Go to AI Search Studio
          </Link>
          <Link
            to="/app/dashboard"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 min-h-[46px] rounded-xl subtle-surface hover:bg-hoverSurface text-sm sm:text-base font-semibold text-ink transition-colors"
          >
            Command Center
          </Link>
        </div>
      </div>
    );
  }

  const activeScene = draft.scenes[selectedSceneIdx] || draft.scenes[0];
  const activeSceneDur = activeScene ? Math.max(0.5, activeScene.timelineEndTime - activeScene.timelineStartTime) : 1;

  return (
    <div className="max-w-[1480px] mx-auto space-y-5 pb-8">
      {/* Studio Toolbar Header */}
      <div className="p-4 sm:p-5 rounded-2xl panel-card flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-2.5 min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <select
              aria-label="Select active storyboard"
              value={draft.id}
              onChange={e => navigate(`/app/storyboard/${e.target.value}`)}
              className="w-full sm:w-auto sm:max-w-[300px] px-4 py-2.5 min-h-[44px] rounded-xl input-surface text-sm sm:text-base font-semibold"
            >
              {(allStoryboards || []).map((sb: { id: string; title: string; actualDuration: number }) => (
                <option key={sb.id} value={sb.id}>
                  {sb.title} ({sb.actualDuration}s)
                </option>
              ))}
            </select>
            <Link
              to="/app/search"
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 min-h-[42px] rounded-xl bg-[#3B82F6]/15 border border-[#3B82F6]/30 hover:bg-[#3B82F6]/25 text-xs sm:text-sm font-semibold text-blue-700 dark:text-blue-300 whitespace-nowrap transition-colors"
            >
              <Plus className="w-4 h-4" /> New Cut
            </Link>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm">
            <span className="font-mono px-3 py-0.5 rounded-lg bg-cyan-500/10 border border-cyan-500/25 text-cyan-700 dark:text-cyan-300 font-semibold">
              {draft.actualDuration}s / {draft.targetDuration}s target
            </span>
            <span className="px-3 py-0.5 rounded-lg subtle-surface capitalize font-semibold text-ink">
              {draft.mood}
            </span>
            <span className="px-2.5 py-0.5 rounded-lg subtle-surface font-mono text-ink-muted">v{draft.version}</span>
            {hasUnsavedChanges ? (
              <span className="px-2.5 py-0.5 rounded-lg bg-amber-500/10 border border-amber-500/25 text-amber-700 dark:text-amber-300 text-xs font-semibold">
                Autosaving edits...
              </span>
            ) : (
              <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold">Saved</span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {/* Aspect Ratio Switcher */}
          <div className="flex items-center p-1 rounded-xl subtle-surface shrink-0">
            {(['16:9', '9:16', '1:1', '4:5'] as AspectRatio[]).map(ar => (
              <button
                key={ar}
                type="button"
                onClick={() => applyEdit(curr => ({ ...curr, aspectRatio: ar }))}
                className={`px-3 py-2 min-h-[38px] rounded-lg text-xs sm:text-sm font-mono font-semibold transition-colors whitespace-nowrap ${
                  draft.aspectRatio === ar
                    ? 'bg-[#2563EB] text-white shadow-sm shadow-blue-600/25'
                    : 'text-ink-muted hover:text-blue-600 dark:hover:text-blue-300'
                }`}
              >
                {ar}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={handleUndo}
            disabled={undoStack.length === 0}
            className="w-10 h-10 flex items-center justify-center rounded-xl subtle-surface disabled:opacity-35 hover:border-[#3B82F6]/50 text-ink transition-colors shrink-0"
            title="Undo"
            aria-label="Undo edit"
          >
            <Undo2 className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleRedo}
            disabled={redoStack.length === 0}
            className="w-10 h-10 flex items-center justify-center rounded-xl subtle-surface disabled:opacity-35 hover:border-[#3B82F6]/50 text-ink transition-colors shrink-0"
            title="Redo"
            aria-label="Redo edit"
          >
            <Redo2 className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => saveMutation.mutate(draft)}
            disabled={saveMutation.isPending}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 min-h-[44px] rounded-xl subtle-surface hover:border-[#3B82F6]/50 hover:bg-hoverSurface text-xs sm:text-sm font-semibold text-ink transition-colors whitespace-nowrap shrink-0"
          >
            {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save
          </button>

          <button
            type="button"
            onClick={() => exportPlanMutation.mutate('json')}
            disabled={exportPlanMutation.isPending}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 min-h-[44px] rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs sm:text-sm font-semibold shadow-lg shadow-blue-600/25 whitespace-nowrap shrink-0 transition-colors"
          >
            <Download className="w-4 h-4" />
            Export Plan
          </button>

          <button
            type="button"
            onClick={() => exportPlanMutation.mutate('edl')}
            disabled={exportPlanMutation.isPending}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 min-h-[44px] rounded-xl border border-cyan-500/30 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap shrink-0"
          >
            EDL
          </button>
        </div>
      </div>

      {/* Main Editor Grid: Preview + Timeline on Left (8 cols), Scene Properties on Right (4 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        <div className="lg:col-span-8 space-y-5">
          {/* Video Cinema Preview Stage */}
          <div className="p-4 sm:p-5 rounded-2xl panel-card space-y-4">
            {activeScene && (
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="px-2.5 py-0.5 rounded-md bg-[#3B82F6]/15 text-blue-700 dark:text-blue-300 border border-[#3B82F6]/30 font-mono font-bold text-xs">
                    SCENE {selectedSceneIdx + 1} / {draft.scenes.length}
                  </span>
                  <span className="font-bold text-ink truncate">{activeScene.sourceFilename}</span>
                </div>
                <div className="flex items-center gap-2">
                  {activeScene.isDemoData && (
                    <span className="px-2.5 py-0.5 rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/25 text-xs font-bold">
                      DEMO DATA PREVIEW
                    </span>
                  )}
                  <span className="font-mono text-xs sm:text-sm font-semibold text-ink-muted">{draft.aspectRatio}</span>
                </div>
              </div>
            )}

            {/* Cinema Reference Stage — stays dark so video frames look crisp in both themes */}
            <div className="media-overlay rounded-xl bg-[#090B10] p-3.5 sm:p-6 flex flex-col items-center justify-center gap-3 min-h-[220px] sm:min-h-[340px] border border-borderSubtle">
              {activeScene && (
                <div
                  className={`w-full ${ASPECT_RATIO_CLASSES[draft.aspectRatio]} relative rounded-xl overflow-hidden bg-black border border-white/15 shadow-2xl mx-auto flex items-center justify-center`}
                >
                  {activeScene.sourceType === 'local_upload' && activeScene.playbackUrl ? (
                    <video
                      ref={videoRef}
                      src={activeScene.playbackUrl}
                      controls
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <img
                      src={activeScene.thumbnailUrl}
                      alt={activeScene.sourceFilename}
                      className="w-full h-full object-contain transition-transform duration-700"
                      style={{
                        transform: isPlayingSequence
                          ? `scale(${1 + (sceneElapsed / activeSceneDur) * 0.04})`
                          : 'scale(1)'
                      }}
                    />
                  )}

                  {/* Playback Progress Strip */}
                  <div className="absolute bottom-0 inset-x-0 h-1 bg-white/15">
                    <div
                      className="h-full bg-gradient-to-r from-[#2563EB] to-[#06B6D4] transition-all duration-100"
                      style={{ width: `${Math.min(100, (sceneElapsed / activeSceneDur) * 100)}%` }}
                    />
                  </div>
                </div>
              )}

              {activeScene?.caption && (
                <div className="text-center max-w-2xl">
                  <span className="inline-block px-4 py-2 rounded-lg bg-[#161C27] border border-white/15 text-[#F8FAFC] text-sm sm:text-base font-medium">
                    "{activeScene.caption}"
                  </span>
                </div>
              )}
            </div>

            {/* Transport Controls */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedSceneIdx(i => Math.max(0, i - 1));
                    setSceneElapsed(0);
                  }}
                  disabled={selectedSceneIdx === 0}
                  aria-label="Previous scene"
                  className="w-11 h-11 flex items-center justify-center rounded-xl subtle-surface disabled:opacity-35 hover:border-[#3B82F6]/50 text-ink transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSceneElapsed(0);
                    setIsPlayingSequence(p => !p);
                  }}
                  className="inline-flex items-center justify-center gap-2 px-4 sm:px-6 py-3 min-h-[46px] rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-sm sm:text-base font-semibold shadow-lg shadow-blue-600/25 transition-colors"
                >
                  {isPlayingSequence ? <Pause className="w-4 h-4 shrink-0" /> : <Play className="w-4 h-4 shrink-0" />}
                  {isPlayingSequence ? (
                    'Pause Sequence'
                  ) : (
                    <>
                      <span className="sm:hidden">Play Sequence</span>
                      <span className="hidden sm:inline">Play Storyboard Sequence</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedSceneIdx(i => Math.min(draft.scenes.length - 1, i + 1));
                    setSceneElapsed(0);
                  }}
                  disabled={selectedSceneIdx >= draft.scenes.length - 1}
                  aria-label="Next scene"
                  className="w-11 h-11 flex items-center justify-center rounded-xl subtle-surface disabled:opacity-35 hover:border-[#3B82F6]/50 text-ink transition-colors"
                >
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>

              <span className="font-mono text-xs sm:text-sm font-semibold text-ink-muted">
                Timeline: {activeScene?.timelineStartTime.toFixed(1)}s – {activeScene?.timelineEndTime.toFixed(1)}s
              </span>
            </div>
          </div>

          {/* Interactive Timeline Track */}
          <div className="p-5 rounded-2xl panel-card space-y-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display font-bold text-base sm:text-lg text-ink">
                Interactive Storyboard Timeline (Drag clips to reorder)
              </h2>
              <div className="flex items-center gap-3">
                <span className="text-sm font-mono text-ink-muted font-medium">
                  {draft.scenes.length} Scene{draft.scenes.length === 1 ? '' : 's'}
                </span>
                <button
                  type="button"
                  onClick={() => setShowAddClipModal(true)}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2 min-h-[40px] rounded-xl bg-[#3B82F6]/15 hover:bg-[#3B82F6]/25 border border-[#3B82F6]/30 text-blue-700 dark:text-blue-300 text-sm font-semibold transition-colors"
                >
                  <Plus className="w-4 h-4" /> Add Clip
                </button>
              </div>
            </div>

            <div className="flex gap-3 overflow-x-auto pb-2">
              {draft.scenes.map((scene, idx) => {
                const dur = Number((scene.timelineEndTime - scene.timelineStartTime).toFixed(1));
                const isSelected = idx === selectedSceneIdx;
                return (
                  <div
                    key={scene.id}
                    draggable
                    onDragStart={() => setDraggedIdx(idx)}
                    onDragOver={e => e.preventDefault()}
                    onDrop={() => {
                      if (draggedIdx !== null) {
                        moveScene(draggedIdx, idx);
                        setDraggedIdx(null);
                      }
                    }}
                    onClick={() => {
                      setSelectedSceneIdx(idx);
                      setSceneElapsed(0);
                    }}
                    style={{ minWidth: `${Math.max(180, dur * 22)}px` }}
                    className={`p-3 rounded-xl border cursor-pointer transition-all flex flex-col justify-between shrink-0 gap-2 ${
                      isSelected
                        ? 'bg-[#3B82F6]/15 border-[#3B82F6] ring-2 ring-[#3B82F6]/30 shadow-sm'
                        : 'bg-surface border-borderSubtle hover:border-[#3B82F6]/45'
                    }`}
                  >
                    {scene.thumbnailUrl && (
                      <div className="h-16 rounded-lg overflow-hidden bg-[#090B10] relative">
                        <img
                          src={scene.thumbnailUrl}
                          alt={scene.sourceFilename}
                          className="w-full h-full object-cover"
                        />
                        <span className="media-overlay absolute bottom-1 right-1 px-2 py-0.5 rounded bg-[#090B10]/85 font-mono text-xs">
                          {dur}s
                        </span>
                        {scene.locked && (
                          <span className="absolute top-1 right-1 p-1 rounded bg-amber-400 text-[#090B10]">
                            <Lock className="w-3 h-3" />
                          </span>
                        )}
                      </div>
                    )}

                    <div className="min-w-0">
                      <div className="flex items-center justify-between text-xs font-mono mb-0.5">
                        <span className="text-blue-700 dark:text-blue-300 font-bold">S{idx + 1}</span>
                        <span className="uppercase text-ink-muted font-semibold">{scene.transition}</span>
                      </div>
                      <p className="text-sm font-bold text-ink truncate">{scene.sourceFilename}</p>
                      <p className="text-xs text-ink-muted truncate mt-0.5">
                        {scene.caption || scene.description}
                      </p>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-borderSubtle text-xs text-ink-muted">
                      <span className="font-mono font-medium">
                        {scene.timelineStartTime.toFixed(1)}s–{scene.timelineEndTime.toFixed(1)}s
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={e => {
                            e.stopPropagation();
                            moveScene(idx, idx - 1);
                          }}
                          disabled={idx === 0}
                          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-hoverSurface hover:text-blue-600 dark:hover:text-blue-300 disabled:opacity-25 transition-colors"
                          aria-label="Move left"
                        >
                          <ArrowLeft className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={e => {
                            e.stopPropagation();
                            moveScene(idx, idx + 1);
                          }}
                          disabled={idx === draft.scenes.length - 1}
                          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-hoverSurface hover:text-blue-600 dark:hover:text-blue-300 disabled:opacity-25 transition-colors"
                          aria-label="Move right"
                        >
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Music & Creative Concept */}
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="p-5 sm:p-6 rounded-2xl panel-card space-y-3.5">
              <h3 className="font-display font-bold text-base sm:text-lg text-ink flex items-center gap-2">
                <Music className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                Background Audio Suggestions
              </h3>
              {draft.musicSuggestions.length === 0 ? (
                <p className="text-sm text-ink-muted">No background music suggestions recorded.</p>
              ) : (
                draft.musicSuggestions.map((m, i) => (
                  <div key={i} className="p-3.5 rounded-xl subtle-surface text-sm space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-ink">{m.title}</span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="px-2.5 py-0.5 rounded-full bg-[#3B82F6]/15 border border-[#3B82F6]/30 text-blue-700 dark:text-blue-300 text-xs font-semibold capitalize">
                          {m.mood}
                        </span>
                        <span className="font-mono text-cyan-700 dark:text-cyan-400 text-xs font-bold">{m.tempo}</span>
                      </div>
                    </div>
                    <p className="text-ink-secondary leading-relaxed">{m.notes}</p>
                  </div>
                ))
              )}
            </div>

            <div className="p-5 sm:p-6 rounded-2xl panel-card space-y-3">
              <h3 className="font-display font-bold text-base sm:text-lg text-ink">Creative Concept & Editing Notes</h3>
              <p className="text-sm text-ink-secondary leading-relaxed">{draft.creativeConcept}</p>
              <textarea
                rows={3}
                aria-label="Producer editing notes"
                value={draft.editingNotes}
                onChange={e => applyEdit(curr => ({ ...curr, editingNotes: e.target.value }))}
                placeholder="Add pacing, color grade, or sound mixing notes..."
                className="w-full px-3.5 py-2.5 rounded-xl input-surface text-sm resize-none"
              />
            </div>
          </div>

          {/* Production Shot List Summary */}
          <div className="p-5 sm:p-6 rounded-2xl panel-card space-y-3.5 overflow-x-auto">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-display font-bold text-base sm:text-lg text-ink">Verified Production Shot List</h3>
              <span className="text-xs font-mono text-ink-muted">
                Shortcuts: Space (Play) • ←/→ (Scene) • ⌘S (Save)
              </span>
            </div>
            <table className="w-full text-left text-sm min-w-[560px]">
              <thead className="border-b border-borderSubtle text-ink-muted">
                <tr>
                  <th className="py-2.5 pr-3 font-semibold">#</th>
                  <th className="py-2.5 pr-3 font-semibold">Timeline</th>
                  <th className="py-2.5 pr-3 font-semibold">Source Clip</th>
                  <th className="py-2.5 pr-3 font-semibold">Source Trim</th>
                  <th className="py-2.5 pr-3 font-semibold">Transition</th>
                  <th className="py-2.5 font-semibold">Caption</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-borderSubtle">
                {draft.scenes.map((s, idx) => (
                  <tr
                    key={s.id}
                    onClick={() => setSelectedSceneIdx(idx)}
                    className={`cursor-pointer transition-colors ${
                      idx === selectedSceneIdx ? 'bg-[#3B82F6]/15' : 'hover:bg-hoverSurface/60'
                    }`}
                  >
                    <td className="py-3 pr-3 font-mono font-bold text-blue-700 dark:text-blue-300">{idx + 1}</td>
                    <td className="py-3 pr-3 font-mono font-semibold text-cyan-700 dark:text-cyan-400">
                      {s.timelineStartTime.toFixed(1)}s–{s.timelineEndTime.toFixed(1)}s
                    </td>
                    <td className="py-3 pr-3 font-semibold text-ink">
                      {s.sourceFilename}{' '}
                      {s.isDemoData && (
                        <span className="text-xs px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/25 text-amber-700 dark:text-amber-300 font-bold ml-1">
                          DEMO
                        </span>
                      )}
                    </td>
                    <td className="py-3 pr-3 font-mono text-ink-secondary">
                      {s.sourceStartTime.toFixed(1)}s–{s.sourceEndTime.toFixed(1)}s
                    </td>
                    <td className="py-3 pr-3 uppercase text-xs font-mono text-ink-muted">{s.transition}</td>
                    <td className="py-3 truncate max-w-[180px] text-ink-secondary">{s.caption}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Properties Inspector Panel (4 cols) */}
        <aside className="lg:col-span-4 space-y-5 lg:sticky lg:top-24">
          {activeScene && (
            <div className="p-5 sm:p-6 rounded-2xl panel-card space-y-4">
              <div className="flex items-start justify-between gap-2 border-b border-borderSubtle pb-3.5">
                <div className="min-w-0">
                  <h2 className="font-display font-bold text-base sm:text-lg text-ink">
                    Scene {selectedSceneIdx + 1} Properties
                  </h2>
                  <p className="text-xs sm:text-sm font-mono text-ink-muted truncate mt-0.5">{activeScene.sourceFilename}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() =>
                      applyEdit(curr => ({
                        ...curr,
                        scenes: curr.scenes.map((s, i) =>
                          i === selectedSceneIdx ? { ...s, locked: !s.locked } : s
                        )
                      }))
                    }
                    className={`w-10 h-10 flex items-center justify-center rounded-xl border text-xs transition-colors ${
                      activeScene.locked
                        ? 'bg-amber-500/10 border-amber-500/25 text-amber-700 dark:text-amber-300'
                        : 'subtle-surface text-ink-secondary hover:border-[#3B82F6]/50'
                    }`}
                    title={activeScene.locked ? 'Unlock scene' : 'Lock scene'}
                    aria-label={activeScene.locked ? 'Unlock scene' : 'Lock scene'}
                  >
                    {activeScene.locked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                  </button>
                  <button
                    type="button"
                    disabled={draft.scenes.length <= 1 || activeScene.locked}
                    onClick={() => {
                      applyEdit(curr => ({
                        ...curr,
                        scenes: curr.scenes.filter((_, i) => i !== selectedSceneIdx)
                      }));
                      setSelectedSceneIdx(idx => Math.max(0, idx - 1));
                    }}
                    className="w-10 h-10 flex items-center justify-center rounded-xl border border-rose-500/25 bg-rose-500/10 hover:bg-rose-500/20 disabled:opacity-35 text-rose-700 dark:text-rose-300 text-xs transition-colors"
                    title="Remove scene from timeline"
                    aria-label="Remove scene"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="text-sm space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-ink-secondary font-semibold">Scene Evidence</span>
                  <span className="px-2.5 py-0.5 rounded-md bg-[#3B82F6]/15 border border-[#3B82F6]/30 text-blue-700 dark:text-blue-300 text-xs font-semibold">
                    {EVIDENCE_LABELS[activeScene.evidenceSource] || activeScene.evidenceSource}
                  </span>
                </div>
                <p className="subtle-surface p-3.5 rounded-xl leading-relaxed text-ink-secondary">{activeScene.description}</p>
              </div>

              {/* Source In/Out Trim Controls */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between text-xs sm:text-sm">
                  <span className="text-ink-secondary font-semibold">Clip Trim Range</span>
                  <span className="font-mono font-bold text-cyan-700 dark:text-cyan-400">
                    {(activeScene.sourceEndTime - activeScene.sourceStartTime).toFixed(1)}s cut /{' '}
                    {activeScene.sourceDuration}s src
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-ink-muted mb-1.5">Source In (s)</label>
                    <input
                      type="number"
                      step="0.5"
                      min={0}
                      max={Math.max(0, activeScene.sourceEndTime - 0.5)}
                      value={activeScene.sourceStartTime}
                      onChange={e => {
                        const val = Math.max(0, Math.min(Number(e.target.value), activeScene.sourceEndTime - 0.5));
                        applyEdit(curr => ({
                          ...curr,
                          scenes: curr.scenes.map((s, i) =>
                            i === selectedSceneIdx ? { ...s, sourceStartTime: Number(val.toFixed(2)) } : s
                          )
                        }));
                      }}
                      className="w-full px-3.5 py-2.5 min-h-[44px] rounded-xl input-surface text-sm font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-ink-muted mb-1.5">Source Out (s)</label>
                    <input
                      type="number"
                      step="0.5"
                      min={activeScene.sourceStartTime + 0.5}
                      max={activeScene.sourceDuration}
                      value={activeScene.sourceEndTime}
                      onChange={e => {
                        const val = Math.min(
                          activeScene.sourceDuration,
                          Math.max(Number(e.target.value), activeScene.sourceStartTime + 0.5)
                        );
                        applyEdit(curr => ({
                          ...curr,
                          scenes: curr.scenes.map((s, i) =>
                            i === selectedSceneIdx ? { ...s, sourceEndTime: Number(val.toFixed(2)) } : s
                          )
                        }));
                      }}
                      className="w-full px-3.5 py-2.5 min-h-[44px] rounded-xl input-surface text-sm font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Caption Editor */}
              <div>
                <label className="block text-sm font-semibold text-ink-secondary mb-1.5">On-Screen Caption</label>
                <input
                  type="text"
                  value={activeScene.caption}
                  onChange={e =>
                    applyEdit(curr => ({
                      ...curr,
                      scenes: curr.scenes.map((s, i) =>
                        i === selectedSceneIdx ? { ...s, caption: e.target.value } : s
                      )
                    }))
                  }
                  className="w-full px-3.5 py-2.5 min-h-[44px] rounded-xl input-surface text-sm"
                />
              </div>

              {/* Transition Selector */}
              <div>
                <label className="block text-sm font-semibold text-ink-secondary mb-1.5">Transition</label>
                <select
                  value={activeScene.transition}
                  onChange={e =>
                    applyEdit(curr => ({
                      ...curr,
                      scenes: curr.scenes.map((s, i) =>
                        i === selectedSceneIdx ? { ...s, transition: e.target.value as TransitionType } : s
                      )
                    }))
                  }
                  className="w-full px-3.5 py-2.5 min-h-[44px] rounded-xl input-surface text-sm"
                >
                  <option value="cut">Hard Cut</option>
                  <option value="fade_in">Fade In</option>
                  <option value="fade_out">Fade Out</option>
                  <option value="crossfade">Smooth Crossfade</option>
                  <option value="dissolve">Dissolve</option>
                  <option value="wipe">Directional Wipe</option>
                </select>
              </div>

              {/* Single-Scene AI Regeneration */}
              <div className="pt-3.5 border-t border-borderSubtle space-y-3">
                <label className="block text-sm font-bold text-blue-700 dark:text-blue-300">Regenerate Only This Scene</label>
                <input
                  type="text"
                  value={regenPrompt}
                  onChange={e => setRegenPrompt(e.target.value)}
                  placeholder="Optional clue (e.g., dog splashing water)..."
                  className="w-full px-3.5 py-2.5 min-h-[44px] rounded-xl input-surface text-sm"
                />
                <button
                  type="button"
                  onClick={() =>
                    regenSceneMutation.mutate({
                      sceneId: activeScene.id,
                      instruction: regenPrompt.trim() || undefined
                    })
                  }
                  disabled={activeScene.locked || regenSceneMutation.isPending}
                  className="w-full py-3 min-h-[46px] rounded-xl bg-[#3B82F6]/15 hover:bg-[#3B82F6]/25 disabled:opacity-45 border border-[#3B82F6]/40 text-blue-700 dark:text-blue-200 text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors"
                >
                  {regenSceneMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4" />
                  )}
                  {activeScene.locked ? 'Scene Locked' : 'Swap With Alternative Shot'}
                </button>
              </div>

              <div className="pt-1">
                <Link
                  to={`/app/content?storyboardId=${draft.id}`}
                  className="flex items-center justify-center w-full py-3 min-h-[46px] rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/25 text-center text-cyan-700 dark:text-cyan-300 text-sm font-semibold transition-colors"
                >
                  Generate Titles & Social Copy →
                </Link>
              </div>
            </div>
          )}
        </aside>
      </div>

      {/* Add Clip Modal */}
      {showAddClipModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-card border border-borderSubtle overflow-hidden flex flex-col max-h-[85vh] shadow-elevated">
            <div className="px-6 py-4 border-b border-borderSubtle flex items-center justify-between">
              <h3 className="font-display font-bold text-lg text-ink">Append Clip from Media Library</h3>
              <button
                type="button"
                onClick={() => setShowAddClipModal(false)}
                className="w-10 h-10 flex items-center justify-center rounded-xl text-ink-muted hover:text-ink hover:bg-hoverSurface transition-colors"
                aria-label="Close add clip modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 border-b border-borderSubtle">
              <div className="relative">
                <Search className="w-4 h-4 text-ink-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={clipSearchQuery}
                  onChange={e => setClipSearchQuery(e.target.value)}
                  placeholder="Filter clips by filename or tag..."
                  className="w-full pl-10 pr-4 py-3 min-h-[46px] rounded-xl input-surface text-sm"
                />
              </div>
            </div>
            <div className="p-4 overflow-y-auto grid sm:grid-cols-2 gap-3">
              {clipsLoading ? (
                [1, 2, 3, 4].map(i => <div key={i} className="h-16 rounded-xl subtle-surface animate-pulse" />)
              ) : !libraryClips || libraryClips.length === 0 ? (
                <p className="sm:col-span-2 text-center py-8 text-sm text-ink-muted">
                  No matching clips found in your library.
                </p>
              ) : (
                libraryClips.map(
                  (clip: {
                    id: string;
                    filename: string;
                    sourceType: 'ugreen_nas' | 'local_upload' | 'demo';
                    mediaType: 'video' | 'image' | 'audio';
                    isDemoData: boolean;
                    duration: number;
                    thumbnailUrl: string;
                    playbackUrl: string;
                    metadata?: { summary?: string };
                  }) => {
                    const realDur = clip.mediaType === 'image' ? 6 : Math.max(2, clip.duration || 10);
                    const clipLen = Math.min(5, realDur);
                    return (
                      <button
                        key={clip.id}
                        type="button"
                        onClick={() => {
                          const newScene: StoryboardScene = {
                            id: `scene_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                            order: draft.scenes.length,
                            mediaAssetId: clip.id,
                            sourceFilename: clip.filename,
                            sourceType: clip.sourceType,
                            isDemoData: clip.isDemoData,
                            sourceDuration: realDur,
                            sourceStartTime: 0,
                            sourceEndTime: clipLen,
                            timelineStartTime: draft.actualDuration,
                            timelineEndTime: draft.actualDuration + clipLen,
                            description: clip.metadata?.summary || clip.filename,
                            caption: clip.filename.replace(/\.[^.]+$/, ''),
                            transition: 'crossfade',
                            thumbnailUrl: clip.thumbnailUrl,
                            playbackUrl: clip.playbackUrl,
                            evidenceSource: 'metadata'
                          };
                          applyEdit(curr => ({ ...curr, scenes: [...curr.scenes, newScene] }));
                          setSelectedSceneIdx(draft.scenes.length);
                          setShowAddClipModal(false);
                        }}
                        className="flex items-center gap-3 p-3 min-h-[64px] rounded-xl bg-surface border border-borderSubtle hover:border-[#3B82F6]/50 hover:bg-hoverSurface/60 text-left transition-colors"
                      >
                        <img src={clip.thumbnailUrl} alt={clip.filename} className="w-16 h-10 rounded object-cover shrink-0 bg-[#090B10]" />
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-ink truncate">{clip.filename}</p>
                          <p className="text-xs text-ink-muted font-mono">
                            {realDur}s • {clip.isDemoData ? 'DEMO DATA' : clip.sourceType}
                          </p>
                        </div>
                      </button>
                    );
                  }
                )
              )}
            </div>
          </div>
        </div>
      )}

      {/* Export Plan Modal */}
      {exportModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-card border border-borderSubtle overflow-hidden flex flex-col max-h-[85vh] shadow-elevated">
            <div className="px-6 py-4 border-b border-borderSubtle flex items-center justify-between gap-3">
              <div>
                <h3 className="font-display font-bold text-lg text-ink">
                  Exported Production Plan ({exportModal.format.toUpperCase()})
                </h3>
                <p className="text-xs sm:text-sm text-amber-700 dark:text-amber-300 font-medium mt-0.5">{exportModal.note}</p>
              </div>
              <button
                type="button"
                onClick={() => setExportModal(null)}
                aria-label="Close export modal"
                className="w-10 h-10 flex items-center justify-center rounded-xl text-ink-muted hover:text-ink hover:bg-hoverSurface transition-colors shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <pre className="p-5 overflow-auto text-xs sm:text-sm font-mono text-cyan-800 dark:text-cyan-300 bg-surface flex-1">
              {exportModal.content}
            </pre>
            <div className="px-6 py-3.5 border-t border-borderSubtle flex flex-wrap items-center justify-end gap-3 bg-card">
              <button
                type="button"
                onClick={copyExportToClipboard}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 min-h-[44px] rounded-xl bg-surface border border-borderSubtle hover:border-[#3B82F6]/50 hover:bg-hoverSurface text-sm font-semibold text-ink transition-colors"
              >
                {copiedExport ? <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> : <Copy className="w-4 h-4" />}
                {copiedExport ? 'Copied' : 'Copy Plan'}
              </button>
              <button
                type="button"
                onClick={() => {
                  const blob = new Blob([exportModal.content], { type: 'text/plain' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = exportModal.filename;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="px-5 py-2.5 min-h-[44px] rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-sm font-semibold shadow-lg shadow-blue-600/25 transition-colors"
              >
                Download {exportModal.filename}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
