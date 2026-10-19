'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Run, RunStatus } from '@/lib/types';

interface RunHistoryProps {
  onSelectRun?: (run: HistoryRun) => void | Promise<void>;
  activeRunId?: string;
  onNavigate?: (tab: 'pipeline' | 'scenarios' | 'presentation' | 'history') => void;
}

type HistoryFilter = 'all' | 'completed' | 'attention' | 'failed';
type HistoryRun = Omit<Run, 'sourceSnapshot' | 'extractedEvents' | 'clashes' | 'unparsedRows'> & {
  sessionCount: number;
  clashCount: number;
  unparsedCount: number;
};

const statusLabels: Record<RunStatus, string> = {
  collecting: 'Collecting',
  extracting: 'Extracting',
  completed: 'Completed',
  verifying: 'Verifying',
  executing: 'Saving',
  reviewing: 'Review needed',
  approving: 'Approval pending',
  failed: 'Failed',
};

const sourceLabels = {
  mock: 'Sample',
  text: 'Pasted text',
  url: 'Public URL',
  pdf: 'PDF upload',
} as const;

function formatRunDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Date unavailable';
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

export default function RunHistory({ onSelectRun, activeRunId, onNavigate }: RunHistoryProps) {
  const [runs, setRuns] = useState<HistoryRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<HistoryFilter>('all');
  const [visibleCount, setVisibleCount] = useState(12);

  const loadRuns = useCallback(async (signal?: AbortSignal): Promise<HistoryRun[]> => {
    const response = await fetch('/api/run', { cache: 'no-store', signal });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Could not load schedule history.');
    return Array.isArray(data.runs) ? data.runs as HistoryRun[] : [];
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void loadRuns(controller.signal)
      .then((result) => setRuns(result))
      .catch((cause: unknown) => {
        if (!(cause instanceof Error) || cause.name !== 'AbortError') {
          setError(cause instanceof Error ? cause.message : 'Could not load schedule history.');
        }
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [loadRuns]);

  const refreshRuns = async () => {
    setLoading(true);
    setError(null);
    try {
      setRuns(await loadRuns());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load schedule history.');
    } finally {
      setLoading(false);
    }
  };

  const filteredRuns = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return runs.filter((run) => {
      const matchesStatus = filter === 'all'
        || (filter === 'completed' && run.status === 'completed')
        || (filter === 'failed' && run.status === 'failed')
        || (filter === 'attention' && run.status !== 'completed' && run.status !== 'failed');
      if (!matchesStatus) return false;
      if (!needle) return true;
      const searchable = [
        run.scenarioId,
        run.id,
        run.input.section,
        run.input.sourceRef,
        run.input.sourceEvidence?.sourceName,
        run.status,
      ].filter(Boolean).join(' ').toLocaleLowerCase();
      return searchable.includes(needle);
    });
  }, [filter, query, runs]);

  const completedCount = runs.filter((run) => run.status === 'completed').length;
  const failedCount = runs.filter((run) => run.status === 'failed').length;
  const attentionCount = runs.length - completedCount - failedCount;

  return (
    <section className="history-page" aria-labelledby="history-title" aria-busy={loading}>
      <header className="history-heading">
        <div>
          <p className="eyebrow">Your workspace</p>
          <h1 id="history-title">Review history</h1>
          <p>Return to a saved timetable review, inspect its evidence, or continue its approval.</p>
        </div>
        <button className="history-refresh" type="button" onClick={() => void refreshRuns()} disabled={loading}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 7v5h-5M4 17v-5h5m10-3a7 7 0 0 0-12-2L4 9m16 6-3 2a7 7 0 0 1-12-2" /></svg>
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </header>

      {runs.length > 0 && (
        <>
          <div className="history-overview" aria-label="Review totals">
            <div><strong>{runs.length}</strong><span>Total reviews</span></div>
            <div><strong>{completedCount}</strong><span>Verified complete</span></div>
            <div><strong>{attentionCount}</strong><span>In progress</span></div>
            <div><strong>{failedCount}</strong><span>Needs attention</span></div>
          </div>

          <div className="history-tools">
            <label className="history-search-wrap">
              <span className="sr-only">Search saved reviews</span>
              <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.3" /><path d="m15.5 15.5 4.2 4.2" /></svg>
              <input
                type="search"
                value={query}
                onChange={(event) => { setQuery(event.target.value); setVisibleCount(12); }}
                placeholder="Search source, cohort, or run ID"
              />
            </label>
            <label className="history-filter-wrap">
              <span className="sr-only">Filter by review status</span>
              <select value={filter} onChange={(event) => { setFilter(event.target.value as HistoryFilter); setVisibleCount(12); }}>
                <option value="all">All reviews</option>
                <option value="attention">In progress</option>
                <option value="completed">Verified complete</option>
                <option value="failed">Needs attention</option>
              </select>
            </label>
            <span className="history-result-count" aria-live="polite">{filteredRuns.length} shown</span>
          </div>
        </>
      )}

      {error && (
        <div className="history-error" role="alert">
          <p>{error}</p>
          <button type="button" onClick={() => void refreshRuns()}>Try again</button>
        </div>
      )}

      {loading && runs.length === 0 ? (
        <div className="history-empty" role="status">
          <span className="history-loader" aria-hidden="true" />
          <h2>Loading your reviews</h2>
          <p>Saved schedules will show here.</p>
        </div>
      ) : !loading && !error && runs.length === 0 ? (
        <div className="history-empty history-empty-card">
          <div className="history-empty-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24"><path d="M7 3.75h7l4.25 4.5v12H7a2 2 0 0 1-2-2v-12a2 2 0 0 1 2-2Z" /><path d="M14 4v5h4M8.5 13h7M8.5 16.5h7" /></svg>
          </div>
          <p className="eyebrow">No saved reviews yet</p>
          <h2>Your schedule history will appear here.</h2>
          <p>Start with a sample or paste a timetable. After the first review, its sessions and verification will be available here.</p>
          {onNavigate && (
            <div className="history-actions">
              <button className="history-primary" type="button" onClick={() => onNavigate('pipeline')}>Open schedule</button>
              <button className="history-secondary" type="button" onClick={() => onNavigate('scenarios')}>Browse examples</button>
            </div>
          )}
        </div>
      ) : runs.length > 0 && filteredRuns.length === 0 ? (
        <div className="history-no-matches">
          <h2>No reviews match those filters.</h2>
          <p>Try another search term or show all reviews.</p>
          <button type="button" className="history-secondary" onClick={() => { setQuery(''); setFilter('all'); }}>Clear filters</button>
        </div>
      ) : runs.length > 0 ? (
        <>
          <div className="history-list" aria-label="Saved schedule reviews">
            {filteredRuns.slice(0, visibleCount).map((run) => {
              const isActive = run.id === activeRunId;
              const verified = run.verificationReport;
              const clashes = run.clashCount;
              const eventCount = run.sessionCount;
              const status = statusLabels[run.status] ?? run.status;
              const sourceName = run.input.sourceEvidence?.sourceName || run.input.sourceRef || 'Untitled schedule';
              const completion = verified
                ? `${verified.verified} / ${verified.totalEvents}`
                : run.status === 'completed' ? 'Complete' : 'Pending';

              return (
                <button
                  className={isActive ? 'history-run is-active' : 'history-run'}
                  type="button"
                  key={run.id}
                  onClick={() => void onSelectRun?.(run)}
                  disabled={!onSelectRun}
                  aria-current={isActive ? 'true' : undefined}
                >
                  <div className="history-run-top">
                    <div className="history-run-title">
                      <span className="history-run-kind">{run.scenarioId || sourceName}</span>
                      <span className={'history-status status-' + run.status}>{status}</span>
                    </div>
                    <time className="history-date" dateTime={run.createdAt}>{formatRunDate(run.createdAt)}</time>
                  </div>
                  <div className="history-run-subtitle">
                    <span>{sourceLabels[run.input.sourceType] ?? 'Schedule source'}</span>
                    <span aria-hidden="true">·</span>
                    <span>Cohort {run.input.section || 'All'}</span>
                    <span aria-hidden="true">·</span>
                    <span>{run.id}</span>
                  </div>
                  <div className="history-metadata">
                    <span><small>Sessions</small><strong>{eventCount}</strong></span>
                    <span><small>Overlaps</small><strong className={clashes ? 'has-clashes' : ''}>{clashes}</strong></span>
                    <span><small>Unparsed</small><strong className={run.unparsedCount ? 'has-clashes' : ''}>{run.unparsedCount}</strong></span>
                    <span><small>Read-back</small><strong>{completion}</strong></span>
                    <span className="history-source">
                      <small>Source</small>
                      <strong title={run.input.sourceEvidence?.sourceUrl ?? sourceName}>{sourceName}</strong>
                      {run.input.sourceEvidence && <small>Retrieved {formatRunDate(run.input.sourceEvidence.fetchedAt)} · {run.input.sourceEvidence.contentType}</small>}
                    </span>
                  </div>
                  <span className="history-open-hint">Open review <span aria-hidden="true">→</span></span>
                </button>
              );
            })}
          </div>
          {filteredRuns.length > visibleCount && (
            <button className="history-load-more" type="button" onClick={() => setVisibleCount((count) => count + 12)}>
              Show {Math.min(12, filteredRuns.length - visibleCount)} more reviews
            </button>
          )}
        </>
      ) : null}
    </section>
  );
}
