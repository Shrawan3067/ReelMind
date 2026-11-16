import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useDispatch } from 'react-redux';
import { Activity, RefreshCw, CheckCircle2, AlertCircle, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import { api } from '../services/api';
import { addToast } from '../store/studioSlice';

interface JobItem {
  id: string;
  jobType: string;
  status: 'pending' | 'queued' | 'processing' | 'completed' | 'failed';
  progress: number;
  stage: string;
  attempts: number;
  maxAttempts: number;
  error?: string;
  logs: string[];
  createdAt: string;
  mediaAsset?: {
    filename: string;
    mediaType: string;
    sourceType: string;
  };
}

export function ProcessingCenterPage() {
  const [statusFilter, setStatusFilter] = useState('');
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const dispatch = useDispatch();

  const { data: jobs, isLoading } = useQuery({
    queryKey: ['jobs', statusFilter],
    queryFn: async () => {
      const res = await api.get('/jobs', { params: statusFilter ? { status: statusFilter } : {} });
      return res.data.data.jobs as JobItem[];
    },
    refetchInterval: 8000
  });

  const retryMutation = useMutation({
    mutationFn: async (jobId: string) => {
      await api.post(`/jobs/${jobId}/retry`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      dispatch(addToast({ type: 'info', message: 'Job re-queued for execution.' }));
    }
  });

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-ink">
            Processing Center
          </h1>
          <p className="text-base text-ink-secondary mt-1">
            Real-time asynchronous media analysis queue, FFprobe inspection logs, and failure recovery.
          </p>
        </div>

        <select
          aria-label="Filter jobs by status"
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="px-4 py-2.5 min-h-[44px] rounded-xl input-surface text-sm font-semibold"
        >
          <option value="">All Job States</option>
          <option value="processing">Processing</option>
          <option value="queued">Queued</option>
          <option value="completed">Completed</option>
          <option value="failed">Failed</option>
        </select>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-24 rounded-2xl panel-card animate-pulse" />
          ))}
        </div>
      ) : !jobs || jobs.length === 0 ? (
        <div className="p-14 text-center rounded-2xl panel-card border-dashed space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-[#3B82F6]/15 border border-[#3B82F6]/30 flex items-center justify-center mx-auto">
            <Activity className="w-6 h-6 text-[#3B82F6]" />
          </div>
          <h3 className="font-display font-bold text-lg text-ink">No Background Jobs Logged</h3>
          <p className="text-sm text-ink-muted max-w-md mx-auto">
            Upload a video, image, or audio file in the Media Library to watch live asynchronous pipeline processing.
          </p>
        </div>
      ) : (
        <div className="space-y-3.5">
          {jobs.map(job => {
            const isExpanded = expandedJobId === job.id;
            return (
              <div key={job.id} className="p-5 sm:p-6 rounded-2xl panel-card space-y-3.5">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    {job.status === 'completed' ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    ) : job.status === 'failed' ? (
                      <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0" />
                    ) : (
                      <Clock className="w-5 h-5 text-cyan-600 dark:text-cyan-400 animate-pulse shrink-0" />
                    )}
                    <div className="min-w-0">
                      <p className="text-base font-semibold text-ink truncate">
                        {job.mediaAsset?.filename || 'Media Asset'}
                      </p>
                      <p className="text-sm text-ink-muted">
                        {job.stage} • Attempt {job.attempts}/{job.maxAttempts}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="font-mono text-sm font-bold text-cyan-700 dark:text-cyan-400">{job.progress}%</span>
                    {job.status === 'failed' && (
                      <button
                        onClick={() => retryMutation.mutate(job.id)}
                        className="inline-flex items-center gap-2 px-4 py-2 min-h-[40px] rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20 text-sm font-semibold transition-colors"
                      >
                        <RefreshCw className="w-4 h-4" />
                        Retry
                      </button>
                    )}
                    <button
                      onClick={() => setExpandedJobId(isExpanded ? null : job.id)}
                      className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-hoverSurface text-ink-muted hover:text-ink transition-colors"
                      aria-label="Toggle logs"
                    >
                      {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="h-2.5 rounded-full bg-surface border border-borderSubtle overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${
                      job.status === 'failed'
                        ? 'bg-rose-500'
                        : job.status === 'completed'
                        ? 'bg-emerald-500'
                        : 'bg-gradient-to-r from-[#2563EB] to-[#06B6D4]'
                    }`}
                    style={{ width: `${job.progress}%` }}
                  />
                </div>

                {job.error && (
                  <p className="text-sm text-rose-700 dark:text-rose-300 bg-rose-500/10 p-3.5 rounded-xl border border-rose-500/25 font-medium">
                    Error: {job.error}
                  </p>
                )}

                {isExpanded && (
                  <pre className="p-4 rounded-xl bg-surface border border-borderSubtle text-xs sm:text-sm font-mono text-ink-secondary overflow-x-auto space-y-1">
                    {job.logs.join('\n')}
                  </pre>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
