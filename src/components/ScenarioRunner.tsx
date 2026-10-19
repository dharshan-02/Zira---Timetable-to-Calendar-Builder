'use client';

import React, { useState, useEffect } from 'react';
import { ScenarioDefinition, ScenarioResult } from '@/lib/types';

export default function ScenarioRunner() {
  const [scenarios, setScenarios] = useState<ScenarioDefinition[]>([]);
  const [results, setResults] = useState<Record<string, ScenarioResult>>({});
  const [runningId, setRunningId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>('TC1');
  const [runningAll, setRunningAll] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    void fetch('/api/scenarios', { signal: controller.signal })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Could not load scenarios.');
        if (data.scenarios) setScenarios(data.scenarios);
        if (Array.isArray(data.results)) {
          const map: Record<string, ScenarioResult> = {};
          data.results.forEach((result: ScenarioResult) => { map[result.scenarioId] = result; });
          setResults(map);
        }
      })
      .catch((error: unknown) => {
        if (error instanceof Error && error.name !== 'AbortError') console.error('Failed to load scenarios:', error);
      });
    return () => controller.abort();
  }, []);

  const runScenario = async (scenarioId: string) => {
    setRunningId(scenarioId);
    try {
      const res = await fetch('/api/scenarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenarioId }),
      });
      const data = await res.json();
      if (data.result) {
        setResults((prev) => ({ ...prev, [scenarioId]: data.result }));
        setExpandedId(scenarioId);
      }
    } catch (err) {
      console.error(`Failed to execute ${scenarioId}:`, err);
    } finally {
      setRunningId(null);
    }
  };

  const runAllScenarios = async () => {
    setRunningAll(true);
    for (const sc of scenarios) {
      await runScenario(sc.id);
    }
    setRunningAll(false);
  };

  const getPassBadge = (passed?: boolean) => {
    if (passed === undefined) {
      return (
        <span className="px-3 py-1 text-xs rounded-full bg-slate-900 text-slate-400 font-bold border border-slate-700">
          NOT EXECUTED
        </span>
      );
    }
    return passed ? (
      <span className="px-3.5 py-1 text-xs rounded-full bg-emerald-950 text-emerald-300 font-extrabold border border-emerald-500/60 flex items-center gap-1.5 shadow-lg shadow-emerald-500/20">
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
        PASSED (100% VERIFIED)
      </span>
    ) : (
      <span className="px-3.5 py-1 text-xs rounded-full bg-red-950 text-red-300 font-extrabold border border-red-500/60 shadow-lg shadow-red-500/20">
        FAILED / DIFFERENCE
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-zinc-900/70 border border-zinc-800 p-5 rounded-xl flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 text-[11px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-400 rounded border border-emerald-500/20">
              Sample schedule checks
            </span>
            <span className="text-xs text-slate-400 font-medium">Evaluation Benchmarks</span>
          </div>
          <h2 className="text-xl font-black text-white mt-1.5 tracking-tight">
            Try a few common schedule cases
          </h2>
          <p className="text-xs text-slate-300 max-w-2xl mt-1 leading-relaxed">
            Run the examples against the same schedule workflow. Each result shows what was detected and which calendar details were checked.
          </p>
        </div>

        <button
          onClick={runAllScenarios}
          disabled={runningAll || runningId !== null}
          className="launch-button w-auto py-3 px-7 text-xs font-black uppercase tracking-wider"
        >
          {runningAll ? (
            <>
              <span className="spinner" />
              Running All Scenarios...
            </>
          ) : (
            <>
              <span>⚡</span> Run All 4 Scenarios
            </>
          )}
        </button>
      </div>

      {/* Scenario Cards */}
      <div className="grid grid-cols-1 gap-4">
        {scenarios.map((sc) => {
          const res = results[sc.id];
          const isExpanded = expandedId === sc.id;
          const isRunning = runningId === sc.id;

          return (
            <div
              key={sc.id}
              className={`hud-card p-5 transition-all duration-200 overflow-hidden ${
                res?.passed
                  ? 'border-emerald-500/30 bg-slate-950/80 shadow-md'
                  : 'border-slate-800 bg-slate-950/90'
              }`}
            >
              {/* Header */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3.5">
                  <div className="w-8 h-8 rounded-md bg-zinc-800 border border-zinc-700 flex items-center justify-center font-semibold text-xs text-emerald-400 font-mono">
                    {sc.id}
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-base flex items-center gap-2">
                      {sc.name}
                    </h3>
                    <p className="text-xs text-slate-400 max-w-2xl mt-0.5">{sc.description}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {getPassBadge(res?.passed)}

                  <button
                    onClick={() => runScenario(sc.id)}
                    disabled={isRunning || runningAll}
                    className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg border border-slate-700 transition disabled:opacity-50 flex items-center gap-1.5 shadow"
                  >
                    {isRunning ? (
                      <>
                        <span className="w-3.5 h-3.5 border-2 border-slate-400 border-t-white rounded-full animate-spin" />
                        Running...
                      </>
                    ) : (
                      <>▶ Run {sc.id}</>
                    )}
                  </button>

                  <button
                    onClick={() => setExpandedId(isExpanded ? null : sc.id)}
                    className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition text-xs font-bold"
                    title={isExpanded ? 'Collapse' : 'Expand'}
                  >
                    {isExpanded ? '▲' : '▼'}
                  </button>
                </div>
              </div>

              {/* Expanded details: Expected vs Actual comparison & evidence */}
              {isExpanded && (
                <div className="pt-4 border-t border-slate-800 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Expected Result */}
                    <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-xl">
                      <div className="text-[11px] font-semibold uppercase tracking-wider text-emerald-400 mb-2 flex items-center gap-1.5">
                        <span>🎯</span> Mandatory Expected Result
                      </div>
                      <p className="text-xs text-slate-300 leading-relaxed font-mono whitespace-pre-wrap">
                        {sc.expectedResult}
                      </p>
                    </div>

                    {/* Actual Result */}
                    <div className={`scenario-actual p-4 rounded-xl border ${res ? (res.passed ? 'scenario-actual-success' : 'scenario-actual-failure') : 'scenario-actual-pending'}`}>
                      <div className="scenario-actual-heading text-[11px] font-black uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <span>📊</span> Actual Result
                      </div>
                      {res ? (
                        <p className="scenario-actual-copy text-xs leading-relaxed font-mono whitespace-pre-wrap">
                          {res.actual}
                        </p>
                      ) : (
                        <p className="scenario-actual-copy scenario-actual-hint text-xs italic">
                          Click &quot;Run {sc.id}&quot; to execute this scenario against the pipeline and record results.
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Concrete Evidence Drawer */}
                  {res?.evidence && (
                    <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4">
                      <div className="flex items-center justify-between text-xs text-slate-400 font-bold mb-2">
                        <span>Inspectable Trace Payload (Truthful Evidence)</span>
                        <span className="font-mono text-[10px] text-slate-500">
                          Timestamp: {res.timestamp ? new Date(res.timestamp).toLocaleTimeString() : 'N/A'}
                        </span>
                      </div>
                      <pre className="text-xs text-emerald-300 font-mono bg-zinc-950 p-3 rounded-lg overflow-x-auto max-h-56 scrollbar-thin leading-relaxed">
                        {res.evidence}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
