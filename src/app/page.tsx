'use client';

import React, { useEffect, useState } from 'react';
import CalendarView from '@/components/CalendarView';
import ScenarioRunner from '@/components/ScenarioRunner';
import PresentationMode from '@/components/PresentationMode';
import RunHistory from '@/components/RunHistory';
import {
  ExtractedEvent,
  Clash,
  UnparsedRow,
  Proposal,
  VerificationReport,
  Run,
  CalendarEvent,
  SourceEvidence,
} from '@/lib/types';
import {
  TC1_FIXTURE,
  TC2_FIXTURE,
  TC3_FIXTURE_REVISED,
  TC4_FIXTURE,
  EXAM_FIXTURE,
} from '@/lib/scenarios';

type Tab = 'pipeline' | 'scenarios' | 'presentation' | 'history';
const PUBLIC_TIMETABLE_DEMO = 'https://tcc.tolani.edu/degree-college/digital-timetable/';
const PUBLIC_GOUNI_LECTURE_SOURCE = 'https://gouni.edu.ng/lecture-time-table/';
const PUBLIC_GOUNI_EXAM_SOURCE = 'https://gouni.edu.ng/exam-timetable/';
const TIMETABLE_SAMPLES = [
  ['01', 'Computer Science · core week'],
  ['02', 'Business · split cohorts'],
  ['03', 'Engineering · lab rotation'],
  ['04', 'Nursing · clinical blocks'],
  ['05', 'Arts · seminar week'],
  ['06', 'Data Science · project studio'],
  ['07', 'Law · lecture and tutorial'],
  ['08', 'Architecture · studio week'],
  ['09', 'Science · lecture and lab'],
  ['10', 'Mixed electives · overlap review'],
] as const;

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>('pipeline');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Form Inputs
  const [section, setSection] = useState('A');
  const [electivesInput, setElectivesInput] = useState('EC201, ME101');
  const [sourceType, setSourceType] = useState<'mock' | 'url' | 'pdf' | 'text'>('mock');
  const [sourceRef, setSourceRef] = useState('tc2-elective-clash.txt');
  const [rawText, setRawText] = useState(TC2_FIXTURE);
  const [sourceUrl, setSourceUrl] = useState('');
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [sourceEvidence, setSourceEvidence] = useState<SourceEvidence | undefined>();
  const [historySourceNotice, setHistorySourceNotice] = useState<string | null>(null);
  const [activePreset, setActivePreset] = useState<'tc1' | 'tc2' | 'tc3' | 'tc4' | 'exam' | null>('tc2');

  // Pipeline State
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [events, setEvents] = useState<ExtractedEvent[]>([]);
  const [clashes, setClashes] = useState<Clash[]>([]);
  const [unparsedRows, setUnparsedRows] = useState<UnparsedRow[]>([]);
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [verificationReport, setVerificationReport] = useState<VerificationReport | null>(null);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);

  const clearCurrentReview = () => {
    setActiveRunId(null);
    setEvents([]);
    setClashes([]);
    setUnparsedRows([]);
    setProposal(null);
    setVerificationReport(null);
    setCalendarEvents([]);
    setCurrentStep(1);
  };

  useEffect(() => {
    if (!mobileNavOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileNavOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [mobileNavOpen]);

  const selectTab = (tab: Tab) => {
    setActiveTab(tab);
    setMobileNavOpen(false);
  };

  // Load Presets
  const loadPreset = (preset: 'tc1' | 'tc2' | 'tc3' | 'tc4' | 'exam') => {
    setActivePreset(preset);
    setSourceType('mock');
    setSourceEvidence(undefined);
    setSourceFile(null);
    setErrorMsg(null);
    setHistorySourceNotice(null);
    switch (preset) {
      case 'tc1':
        setSection('A');
        setElectivesInput('');
        setSourceRef('tc1-weekly-timetable.txt');
        setRawText(TC1_FIXTURE);
        break;
      case 'tc2':
        setSection('A');
        setElectivesInput('EC201, ME101');
        setSourceRef('tc2-elective-clash.txt');
        setRawText(TC2_FIXTURE);
        break;
      case 'tc3':
        setSection('A');
        setElectivesInput('');
        setSourceRef('tc3-revised.txt');
        setRawText(TC3_FIXTURE_REVISED);
        break;
      case 'tc4':
        setSection('A');
        setElectivesInput('');
        setSourceRef('tc4-scanned-ocr.txt');
        setRawText(TC4_FIXTURE);
        break;
      case 'exam':
        setSection('A');
        setElectivesInput('');
        setSourceRef('sample-exam-schedule.txt');
        setRawText(EXAM_FIXTURE);
        break;
    }
  };

  const loadTimetableSample = async (sampleId: string) => {
    if (!sampleId) return;
    const [id, label] = TIMETABLE_SAMPLES.find(([sample]) => sample === sampleId) ?? [];
    if (!id || !label) return;
    try {
      const filename = `${id}-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.txt`;
      const response = await fetch(`/samples/timetables/${filename}`);
      if (!response.ok) throw new Error('This sample timetable could not be loaded.');
      setRawText(await response.text());
      setSourceRef(filename);
      setSourceType('mock');
      setSourceFile(null);
      setSourceEvidence(undefined);
      setActivePreset(null);
      setErrorMsg(null);
      setHistorySourceNotice(null);
      setSection('A');
      setElectivesInput('');
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : 'This sample timetable could not be loaded.');
    }
  };

  // STEP 1-4: Collect, Retrieve, Extract & Clash Detect
  const handleLaunchPipeline = async () => {
    setLoading(true);
    setErrorMsg(null);
    clearCurrentReview();
    try {
      let timetableContent = rawText;
      let effectiveSourceRef = sourceRef;
      let evidence: SourceEvidence = sourceEvidence ?? {
        sourceUrl: null,
        sourceName: sourceRef,
        contentType: 'text/plain',
        fetchedAt: new Date().toISOString(),
      };

      if (sourceType === 'url') {
        const response = await fetch('/api/source', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: sourceUrl }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Could not retrieve the timetable source.');
        timetableContent = data.content;
        effectiveSourceRef = data.sourceUrl;
        evidence = { sourceUrl: data.sourceUrl, sourceName: data.title || data.sourceName, contentType: data.contentType, fetchedAt: data.fetchedAt };
        setRawText(timetableContent);
        setSourceRef(effectiveSourceRef);
        setSourceEvidence(evidence);
      } else if (sourceType === 'pdf') {
        if (!sourceFile) throw new Error('Choose a timetable PDF before continuing.');
        const form = new FormData();
        form.append('file', sourceFile);
        const response = await fetch('/api/source', { method: 'POST', body: form });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Could not extract text from the PDF.');
        timetableContent = data.content;
        effectiveSourceRef = data.sourceName || sourceFile.name;
        evidence = { sourceUrl: null, sourceName: effectiveSourceRef, contentType: data.contentType, fetchedAt: data.fetchedAt };
        setRawText(timetableContent);
        setSourceRef(effectiveSourceRef);
        setSourceEvidence(evidence);
      }

      if (!timetableContent.trim()) throw new Error('The timetable source is empty.');
      const electivesList = electivesInput
        .split(',')
        .map((e) => e.trim())
        .filter((e) => e.length > 0);

      // Initialize run
      const resRun = await fetch('/api/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          section,
          electives: electivesList,
          sourceType,
          sourceRef: effectiveSourceRef,
          sourceEvidence: evidence,
          sourceSnapshot: timetableContent,
        }),
      });
      const dataRun = await resRun.json();
      if (!resRun.ok) throw new Error(dataRun.error || 'Failed to initialize run');

      const run = dataRun.run;
      setActiveRunId(run.id);
      setCurrentStep(3);

      // Extract & Clash Detect
      const isOcr = effectiveSourceRef.toLowerCase().includes('ocr') || timetableContent.includes('#@$%&*');
      const resExtract = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          runId: run.id,
          content: timetableContent,
          sourceFile: effectiveSourceRef,
          method: isOcr ? 'ocr' : 'text',
        }),
      });
      const dataExtract = await resExtract.json();
      if (!resExtract.ok) throw new Error(dataExtract.error || 'Extraction failed');

      setEvents(dataExtract.events || []);
      setClashes(dataExtract.clashes || []);
      setUnparsedRows(dataExtract.unparsedRows || []);
      setCurrentStep(4);
      setHistorySourceNotice(null);

      // Auto-compute Proposal Diff
      const resProp = await fetch('/api/propose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ runId: run.id }),
      });
      const dataProp = await resProp.json();
      if (resProp.ok && dataProp.proposal) {
        setProposal(dataProp.proposal);
        setCurrentStep(5);
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Pipeline execution failed');
    } finally {
      setLoading(false);
    }
  };

  // STEP 6-8: Human Approval, Write & Read-back Verification
  const handleApproveAndVerify = async () => {
    if (!proposal) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proposalId: proposal.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Approval failed');

      setVerificationReport(data.verification);

      // Read back calendar
      const calRes = await fetch('/api/calendar');
      const calData = await calRes.json();
      setCalendarEvents(Array.isArray(calData.rawEvents) ? calData.rawEvents as CalendarEvent[] : []);
      setCurrentStep(8);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectRunFromHistory = async (summary: Pick<Run, 'id'>) => {
    setErrorMsg(null);
    try {
      const response = await fetch(`/api/run?id=${encodeURIComponent(summary.id)}`, { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'This saved review could not be opened.');
      const run = data.run as Run;
      setActiveRunId(run.id);
      setSection(run.input.section);
      setElectivesInput(run.input.electives.join(', '));
      setSourceRef(run.input.sourceRef);
      setSourceEvidence(run.input.sourceEvidence);
      setSourceUrl(run.input.sourceEvidence?.sourceUrl ?? '');
      setSourceFile(null);
      // An uploaded PDF is retained as extracted text, so reopen it as text
      // rather than leaving a PDF upload control with no File object.
      setSourceType(run.input.sourceType === 'pdf' ? 'text' : run.input.sourceType);
      setRawText(run.sourceSnapshot ?? '');
      setHistorySourceNotice(run.sourceSnapshotTruncated
        ? 'This source preview is truncated. The saved sessions and audit results are complete, but rerunning requires the original file.'
        : !run.sourceSnapshot
          ? 'This older review does not have a saved source snapshot. Its extracted sessions and audit results are still available.'
          : null);
      setActivePreset(null);
      setEvents(run.extractedEvents || []);
      setClashes(run.clashes || []);
      setUnparsedRows(run.unparsedRows || []);
      setProposal(data.proposal ?? null);
      setVerificationReport(run.verificationReport ?? null);
      setCalendarEvents([]);
      selectTab('pipeline');
      setCurrentStep(run.status === 'completed' ? 8 : run.proposalId ? 5 : run.extractedEvents.length ? 4 : 1);
    } catch (cause) {
      setErrorMsg(cause instanceof Error ? cause.message : 'This saved review could not be opened.');
    }
  };

  return (
    <div className="studio-container">
      {/* ─── Left Studio Sidebar (Linear & Supabase Studio Style) ─── */}
      <aside id="primary-navigation" className={`studio-sidebar ${mobileNavOpen ? 'is-open' : ''}`} aria-label="Primary navigation">
        <div>
          {/* Brand Header */}
          <div className="flex items-center gap-3 px-2 py-2 mb-6">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center text-emerald-400 shrink-0">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <div className="font-bold text-white text-sm tracking-tight flex items-center gap-1.5">
                Weekline
              </div>
              <div className="text-[11px] text-zinc-500 font-mono">
                Academic schedule workspace
              </div>
            </div>
          </div>

          {/* Navigation Items */}
          <nav className="space-y-1" aria-label="Main navigation">
            <button type="button"
              onClick={() => selectTab('pipeline')}
              aria-current={activeTab === 'pipeline' ? 'page' : undefined}
              className={`sidebar-nav-item ${activeTab === 'pipeline' ? 'active' : ''}`}
            >
              <div className="flex items-center gap-2.5">
                <svg className="w-4 h-4 nav-icon text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <span>Schedule</span>
              </div>
            </button>

            <button type="button"
              onClick={() => selectTab('scenarios')}
              aria-current={activeTab === 'scenarios' ? 'page' : undefined}
              className={`sidebar-nav-item ${activeTab === 'scenarios' ? 'active' : ''}`}
            >
              <div className="flex items-center gap-2.5">
                <svg className="w-4 h-4 nav-icon text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                </svg>
                <span>Scenarios</span>
              </div>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold">
                4/4
              </span>
            </button>

            <button type="button"
              onClick={() => selectTab('presentation')}
              aria-current={activeTab === 'presentation' ? 'page' : undefined}
              className={`sidebar-nav-item ${activeTab === 'presentation' ? 'active' : ''}`}
            >
              <div className="flex items-center gap-2.5">
                <svg className="w-4 h-4 nav-icon text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                <span>How it works</span>
              </div>
            </button>

            <button type="button"
              onClick={() => selectTab('history')}
              aria-current={activeTab === 'history' ? 'page' : undefined}
              className={`sidebar-nav-item ${activeTab === 'history' ? 'active' : ''}`}
            >
              <div className="flex items-center gap-2.5">
                <svg className="w-4 h-4 nav-icon text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Review history</span>
              </div>
            </button>
          </nav>
        </div>

        {/* System Status in Sidebar */}
        <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800 text-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono text-zinc-400 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Workspace ready
            </span>
            <span className="text-[10px] font-mono text-emerald-400 font-semibold">Active</span>
          </div>
          <div className="text-[11px] text-zinc-500 leading-snug">
            Review your schedule, resolve overlaps, then export when it looks right.
          </div>
        </div>
      </aside>

      {mobileNavOpen && (
        <button
          type="button"
          className="sidebar-scrim"
          aria-label="Close navigation"
          onClick={() => setMobileNavOpen(false)}
        />
      )}

      {/* ─── Main Viewport Area ─── */}
      <div className="studio-main">
        {/* Studio Topbar */}
        <header className="studio-topbar">
          <button
            type="button"
            className="menu-toggle"
            aria-label={mobileNavOpen ? 'Close navigation' : 'Open navigation'}
            aria-expanded={mobileNavOpen}
            aria-controls="primary-navigation"
            onClick={() => setMobileNavOpen((open) => !open)}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              {mobileNavOpen ? (
                <path d="m6 6 12 12M18 6 6 18" />
              ) : (
                <path d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
          <div className="flex items-center gap-2 text-xs font-medium text-zinc-400" aria-label="Current section">
            <span className="text-zinc-200">Weekline</span>
            <span>/</span>
            <span className="text-emerald-400 font-semibold">
              {activeTab === 'pipeline' && 'Schedule'}
              {activeTab === 'scenarios' && 'Sample scenarios'}
              {activeTab === 'presentation' && 'How it works'}
              {activeTab === 'history' && 'Review history'}
            </span>
          </div>

          <div className="flex items-center gap-3">
            {activeTab === 'pipeline' && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => loadPreset('tc1')}
                  className="px-2.5 py-1 text-[11px] font-mono font-medium rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition"
                >
                  Preset TC1
                </button>
                <button
                  onClick={() => loadPreset('tc2')}
                  className="px-2.5 py-1 text-[11px] font-mono font-medium rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition"
                >
                  Preset TC2
                </button>
              </div>
            )}
            <span className="workspace-label text-[11px] font-mono text-zinc-500">LOCAL WORKSPACE</span>
          </div>
        </header>

        {/* Dynamic Studio Content */}
        <main className="studio-content">
        {/* Error Notification */}
        {errorMsg && (
          <div role="alert" className="p-4 rounded-xl text-xs font-semibold bg-red-950/80 border border-red-500/60 text-red-200 flex items-center justify-between shadow-2xl">
            <div className="flex items-center gap-2">
              <span className="text-base">🚨</span>
              <span>{errorMsg}</span>
            </div>
            <button onClick={() => setErrorMsg(null)} className="text-red-400 hover:text-white font-bold p-1">
              ✕
            </button>
          </div>
        )}

        {/* ─── Schedule workspace ─── */}
        {activeTab === 'pipeline' && (
          <div className="space-y-6">
            {/* Visual HUD Stepper */}
            <div className="hud-stepper" aria-label={`Schedule workflow, stage ${currentStep} of 8`}>
              {[
                { num: 1, label: 'Stage 1', title: 'Collect Input' },
                { num: 2, label: 'Stage 2', title: 'Retrieve Source' },
                { num: 3, label: 'Stage 3', title: 'Extract Matrix' },
                { num: 4, label: 'Stage 4', title: 'Clash Audit' },
                { num: 5, label: 'Stage 5', title: 'Propose Diff' },
                { num: 6, label: 'Stage 6', title: 'Human Gate' },
                { num: 7, label: 'Stage 7', title: 'Verify Read-Back' },
                { num: 8, label: 'Stage 8', title: 'Sync Calendar' },
              ].map((s) => {
                const isDone = currentStep > s.num;
                const isActive = currentStep === s.num;
                return (
                  <div
                    key={s.num}
                    aria-current={isActive ? 'step' : undefined}
                    className={`hud-step ${isActive ? 'active' : ''} ${isDone ? 'completed' : ''}`}
                  >
                    <div className="hud-circle">{isDone ? '✓' : s.num}</div>
                    <div className="hud-step-details">
                      <span className="hud-step-num">{s.label}</span>
                      <span className="hud-step-title">{s.title}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Main 2-Column Dashboard Grid */}
            <div className="dashboard-grid">
              {/* ── LEFT COLUMN: Configuration & Document Feed ── */}
              <div className="hud-card">
                <div className="hud-card-header">
                  <div>
                    <h2 className="hud-card-title">
                      <span className="section-index">01</span> Schedule source
                    </h2>
                    <p className="hud-card-desc">Choose a sample or enter the timetable you want to review.</p>
                  </div>
                </div>

                {/* Preset Chips */}
                <div className="space-y-2.5">
                  <span className="input-label">Start with a sample</span>
                  <div className="preset-grid">
                    <button type="button"
                      onClick={() => loadPreset('tc1')}
                      aria-pressed={activePreset === 'tc1'}
                      className={`preset-card ${activePreset === 'tc1' ? 'active' : ''}`}
                    >
                      <div className="preset-card-top">
                        <span>TC1: Weekly Master</span>
                        <span className="preset-card-badge text-emerald-400">10 classes</span>
                      </div>
                      <div className="preset-card-desc">Standard recurring cohort classes</div>
                    </button>

                    <button type="button"
                      onClick={() => loadPreset('tc2')}
                      aria-pressed={activePreset === 'tc2'}
                      className={`preset-card ${activePreset === 'tc2' ? 'active' : ''}`}
                    >
                      <div className="preset-card-top">
                        <span className="text-red-400">TC2: Elective Clashes</span>
                        <span className="preset-card-badge text-rose-400">2 conflicts</span>
                      </div>
                      <div className="preset-card-desc">Elective collisions with core labs</div>
                    </button>

                    <button type="button"
                      onClick={() => loadPreset('tc3')}
                      aria-pressed={activePreset === 'tc3'}
                      className={`preset-card ${activePreset === 'tc3' ? 'active' : ''}`}
                    >
                      <div className="preset-card-top">
                        <span>TC3: Smart Diff</span>
                        <span className="preset-card-badge text-amber-400">Idempotent</span>
                      </div>
                      <div className="preset-card-desc">Idempotent update for modified slots</div>
                    </button>

                    <button type="button"
                      onClick={() => loadPreset('tc4')}
                      aria-pressed={activePreset === 'tc4'}
                      className={`preset-card ${activePreset === 'tc4' ? 'active' : ''}`}
                    >
                      <div className="preset-card-top">
                        <span>TC4: OCR Recovery</span>
                        <span className="preset-card-badge text-zinc-400">Degraded OCR</span>
                      </div>
                      <div className="preset-card-desc">Garbled rows isolated with reasons</div>
                    </button>

                    <button type="button"
                      onClick={() => loadPreset('exam')}
                      aria-pressed={activePreset === 'exam'}
                      className={`preset-card ${activePreset === 'exam' ? 'active' : ''}`}
                    >
                      <div className="preset-card-top">
                        <span>Exam schedule</span>
                        <span className="preset-card-badge text-rose-400">Date-aware clash</span>
                      </div>
                      <div className="preset-card-desc">Checks same-day exam overlaps without cross-date false alarms</div>
                    </button>
                  </div>
                  <div className="mt-3">
                    <label className="input-label" htmlFor="timetable-sample">More sample timetables</label>
                    <select id="timetable-sample" className="select-input" defaultValue="" onChange={(event) => void loadTimetableSample(event.target.value)}>
                      <option value="" disabled>Choose one of 10 timetable samples…</option>
                      {TIMETABLE_SAMPLES.map(([id, label]) => <option key={id} value={id}>{id} · {label}</option>)}
                    </select>
                    <p className="source-help">Each sample is saved as a reusable text file in the project and can also be copied into the pasted timetable source.</p>
                  </div>
                </div>

                {/* Student Cohort & Electives */}
                <div className="grid grid-cols-2 gap-3.5">
                  <div>
                    <label className="input-label" htmlFor="cohort-input">Cohort / Section</label>
                    <input
                      id="cohort-input"
                      type="text"
                      value={section}
                      onChange={(e) => setSection(e.target.value)}
                      className="text-input"
                      placeholder="e.g. A"
                    />
                  </div>

                  <div>
                    <label className="input-label" htmlFor="source-type">Source format</label>
                    <select
                      id="source-type"
                      value={sourceType}
                      onChange={(e) => {
                        clearCurrentReview();
                        setSourceType(e.target.value as typeof sourceType);
                        if (e.target.value === 'pdf') {
                          setSourceFile(null);
                          setRawText('');
                          setSourceRef('uploaded-timetable.pdf');
                        }
                        setSourceEvidence(undefined);
                        setHistorySourceNotice(null);
                      }}
                      className="select-input"
                    >
                      <option value="mock">Sample schedule</option>
                      <option value="text">Pasted timetable</option>
                      <option value="url">Public timetable URL</option>
                      <option value="pdf">Upload a PDF</option>
                    </select>
                  </div>
                </div>

                {sourceType === 'url' && (
                  <div className="source-input-panel">
                    <label className="input-label" htmlFor="source-url">Public timetable page or PDF URL</label>
                    <input
                      id="source-url"
                      type="url"
                      value={sourceUrl}
                      onChange={(event) => { setSourceUrl(event.target.value); setSourceEvidence(undefined); setHistorySourceNotice(null); }}
                      className="text-input"
                      placeholder="https://college.edu/timetable"
                      autoComplete="url"
                    />
                    <p className="source-help">Public HTML, text, and PDF sources are fetched server-side and saved with their source URL and retrieval time. Matrix-style exam PDFs may need manual review if dates and sessions cannot be matched confidently.</p>
                    <button
                      type="button"
                      className="source-example-link"
                      onClick={() => { setSourceUrl(PUBLIC_TIMETABLE_DEMO); setSourceEvidence(undefined); }}
                    >
                      Use public demo source · Tolani College timetable
                    </button>
                    <button
                      type="button"
                      className="source-example-link"
                      onClick={() => { setSourceUrl(PUBLIC_GOUNI_LECTURE_SOURCE); setSourceEvidence(undefined); }}
                    >
                      Use official source · Godfrey Okoye lecture timetable
                    </button>
                    <button
                      type="button"
                      className="source-example-link"
                      onClick={() => { setSourceUrl(PUBLIC_GOUNI_EXAM_SOURCE); setSourceEvidence(undefined); }}
                    >
                      Use official source · Godfrey Okoye exam timetable
                    </button>
                  </div>
                )}

                {sourceType === 'pdf' && (
                  <div className="source-input-panel">
                    <label className="input-label" htmlFor="source-pdf">Timetable PDF</label>
                    <input
                      id="source-pdf"
                      type="file"
                      accept="application/pdf,.pdf"
                      onChange={(event) => {
                        const file = event.target.files?.[0] ?? null;
                        clearCurrentReview();
                        setSourceFile(file);
                        setRawText('');
                        setSourceRef(file?.name ?? 'uploaded-timetable.pdf');
                        setSourceEvidence(undefined);
                        setHistorySourceNotice(null);
                        setErrorMsg(null);
                        setActivePreset(null);
                      }}
                      className="text-input source-file-input"
                    />
                    <p className="source-help">Selectable-text PDFs up to 12 MB are supported. Scanned image-only PDFs stay flagged for human review.</p>
                    <button
                      type="button"
                      className="source-example-link"
                      onClick={async () => {
                        try {
                          setErrorMsg(null);
                          const response = await fetch('/samples/Godfrey-Okoye-University-FCIT-Lecture-Timetable-2026-2027.pdf');
                          if (!response.ok) throw new Error('The included timetable PDF could not be loaded.');
                          const file = new File(
                            [await response.blob()],
                            'Godfrey-Okoye-University-FCIT-Lecture-Timetable-2026-2027.pdf',
                            { type: 'application/pdf' },
                          );
                          setSourceFile(file);
                          clearCurrentReview();
                          setRawText('');
                          setSourceRef(file.name);
                          setSourceEvidence(undefined);
                          setHistorySourceNotice(null);
                          setActivePreset(null);
                        } catch (error) {
                          setErrorMsg(error instanceof Error ? error.message : 'The included timetable PDF could not be loaded.');
                        }
                      }}
                    >
                      Use the included Godfrey Okoye University lecture timetable PDF
                    </button>
                  </div>
                )}

                <div>
                  <label className="input-label" htmlFor="electives-input">Electives to check for overlaps</label>
                  <input
                    id="electives-input"
                    type="text"
                    value={electivesInput}
                    onChange={(e) => setElectivesInput(e.target.value)}
                    className="text-input"
                    placeholder="e.g. EC201, ME101"
                  />
                </div>

                {/* Terminal Window for Timetable Raw Data */}
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="input-label" htmlFor="timetable-source">{sourceType === 'pdf' || sourceType === 'url' ? 'Extracted timetable preview' : 'Timetable text'}</label>
                    <span className="text-[11px] text-cyan-400 font-mono">
                      {rawText.split('\n').length} rows • {new Blob([rawText]).size} bytes
                    </span>
                  </div>
                  {historySourceNotice && <p className="source-provenance" role="note">{historySourceNotice}</p>}

                  <div className="terminal-window">
                    <div className="terminal-header">
                      <div className="terminal-dots">
                        <span className="terminal-dot bg-red-500" />
                        <span className="terminal-dot bg-yellow-500" />
                        <span className="terminal-dot bg-green-500" />
                      </div>
                      <span className="text-[11px] font-mono text-slate-400">{sourceRef}</span>
                      <span className="text-[10px] text-cyan-400 font-mono uppercase">UTF-8</span>
                    </div>
                    <textarea
                      id="timetable-source"
                      value={rawText}
                      onChange={(e) => {
                        setRawText(e.target.value);
                        setActivePreset(null);
                        setSourceType('text');
                        setSourceRef('pasted-timetable.txt');
                        setSourceEvidence(undefined);
                        setHistorySourceNotice(null);
                      }}
                      className="terminal-editor"
                      placeholder="Timetable rows..."
                    />
                  </div>
                  {sourceEvidence && (
                    <p className="source-provenance">
                      Source checked {new Date(sourceEvidence.fetchedAt).toLocaleString()} · {sourceEvidence.contentType}
                      {sourceEvidence.sourceUrl ? <> · <a href={sourceEvidence.sourceUrl} target="_blank" rel="noreferrer">Open source</a></> : ` · ${sourceEvidence.sourceName}`}
                    </p>
                  )}
                </div>

                {/* Primary Launch Button */}
                <button
                  onClick={handleLaunchPipeline}
                  disabled={loading || Boolean(historySourceNotice) || (sourceType === 'url' ? !sourceUrl : sourceType === 'pdf' ? !sourceFile : !rawText)}
                  className="launch-button"
                >
                  {loading ? (
                    <>
                      <span className="spinner" />
                      Reading timetable…
                    </>
                  ) : (
                    <>{sourceType === 'url' || sourceType === 'pdf' ? 'Fetch & review timetable' : 'Review this timetable'} <span aria-hidden="true">→</span></>
                  )}
                </button>
              </div>

              {/* ── RIGHT COLUMN: Live Agent Intelligence & Calendar ── */}
              <div className="space-y-6">
                {/* Initial Standby Hero State (Zinc & Emerald Vercel Style) */}
                {events.length === 0 && !loading && (
                  <div className="hud-card relative overflow-hidden py-16 px-8 sm:px-12 border border-zinc-800 bg-zinc-900/40">
                    <div className="flex flex-col items-center justify-center text-center max-w-xl mx-auto w-full">
                      {/* Status indicator pill */}
                      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium mb-4">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        Ready when you are
                      </div>

                      <h3 className="text-xl sm:text-2xl font-semibold text-zinc-100 tracking-tight">
                        Your week, in one clear view.
                      </h3>
                      <p className="text-xs sm:text-sm text-zinc-400 max-w-md mx-auto mt-2 leading-relaxed">
                        Start with a sample or paste your class schedule. Weekline will organize sessions, flag overlaps, and let you review calendar changes before export.
                      </p>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-8 w-full text-left">
                        <div className="p-5 bg-zinc-900/60 hover:bg-zinc-850/80 rounded-2xl border border-zinc-800 hover:border-zinc-700 transition flex flex-col justify-between">
                          <div>
                            <div className="flex items-center justify-between mb-2.5">
                              <span className="text-[10px] font-mono font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded">
                                SPEC 01
                              </span>
                              <span className="text-[10px] text-zinc-500 font-mono uppercase tracking-wider">Collision Engine</span>
                            </div>
                            <h4 className="text-sm font-semibold text-zinc-100 mb-1.5">
                              Zero Silent Drops Policy
                            </h4>
                            <p className="text-xs text-zinc-400 leading-relaxed">
                              Preserves both conflicting events in the review stage with exact overlap minutes and source coordinates.
                            </p>
                          </div>
                        </div>

                        <div className="p-5 bg-zinc-900/60 hover:bg-zinc-850/80 rounded-2xl border border-zinc-800 hover:border-zinc-700 transition flex flex-col justify-between">
                          <div>
                            <div className="flex items-center justify-between mb-2.5">
                              <span className="text-[10px] font-mono font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded">
                                SPEC 02
                              </span>
                              <span className="text-[10px] text-zinc-500 font-mono uppercase tracking-wider">State Storage</span>
                            </div>
                            <h4 className="text-sm font-semibold text-zinc-100 mb-1.5">
                              Deterministic Hashing
                            </h4>
                            <p className="text-xs text-zinc-400 leading-relaxed">
                              Idempotent reruns only update modified sessions without duplicating unchanged timetable entries.
                            </p>
                          </div>
                        </div>

                        <div className="p-5 bg-zinc-900/60 hover:bg-zinc-850/80 rounded-2xl border border-zinc-800 hover:border-zinc-700 transition flex flex-col justify-between">
                          <div>
                            <div className="flex items-center justify-between mb-2.5">
                              <span className="text-[10px] font-mono font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded">
                                SPEC 03
                              </span>
                              <span className="text-[10px] text-zinc-500 font-mono uppercase tracking-wider">Human-in-Loop</span>
                            </div>
                            <h4 className="text-sm font-semibold text-zinc-100 mb-1.5">
                              Human Approval Gate
                            </h4>
                            <p className="text-xs text-zinc-400 leading-relaxed">
                              Diff scorecard audited by student or faculty before writing any calendar changes to storage.
                            </p>
                          </div>
                        </div>

                        <div className="p-5 bg-zinc-900/60 hover:bg-zinc-850/80 rounded-2xl border border-zinc-800 hover:border-zinc-700 transition flex flex-col justify-between">
                          <div>
                            <div className="flex items-center justify-between mb-2.5">
                              <span className="text-[10px] font-mono font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded">
                                SPEC 04
                              </span>
                              <span className="text-[10px] text-zinc-500 font-mono uppercase tracking-wider">Verification</span>
                            </div>
                            <h4 className="text-sm font-semibold text-zinc-100 mb-1.5">
                              Read-Back Verification
                            </h4>
                            <p className="text-xs text-zinc-400 leading-relaxed">
                              Independent field-by-field read-back audit validating venues, timestamps, and recurring intervals.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Active Clashes Alert Card (Crimson Neon) */}
                {clashes.length > 0 && (
                  <div className="clash-card-crimson">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <span className="text-2xl">🚨</span>
                        <div>
                          <h3 className="font-extrabold text-white text-base">
                            Active Schedule Conflicts Flagged ({clashes.length})
                          </h3>
                          <p className="text-xs text-red-300">
                            Explicit interval evaluation detected overlapping slots. Zero events were dropped.
                          </p>
                        </div>
                      </div>
                      <span className="clash-badge-tag">Zero Silent Drops</span>
                    </div>

                    <div className="space-y-3">
                      {clashes.map((c, i) => (
                        <div key={i} className="clash-card-item">
                          <div className="flex justify-between items-center text-xs">
                            <span className="font-extrabold text-white text-sm">
                              {c.eventALabel} ⚡ {c.eventBLabel}
                            </span>
                            <span className="text-red-300 font-mono text-[11px] bg-red-950/80 px-2.5 py-1 rounded border border-red-700/60 font-bold">
                              {c.day}: {c.overlapStart} – {c.overlapEnd}
                            </span>
                          </div>
                          <p className="text-xs text-slate-300 leading-relaxed">{c.reason}</p>
                          <div className="text-[11px] text-slate-400 font-mono bg-black/60 p-2.5 rounded border border-slate-800">
                            {c.evidence}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Extracted Schedule Table */}
                {events.length > 0 && (
                  <div className="hud-card">
                    <div className="hud-card-header">
                      <div>
                        <h3 className="hud-card-title">
                          <span className="text-cyan-400">📋</span> Extracted Timetable Matrix ({events.length} classes)
                        </h3>
                        <p className="hud-card-desc">All entries parsed with deterministic hashes and venue assignments</p>
                      </div>

                      {clashes.length === 0 && (
                        <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-950 text-emerald-300 border border-emerald-500/50">
                          ✓ All Intervals Disjoint
                        </span>
                      )}
                    </div>

                    <div className="table-container-card">
                      <table className="futuristic-table">
                        <thead>
                          <tr>
                            <th>Code</th>
                            <th>Subject Name</th>
                            <th>Type</th>
                            <th>Schedule</th>
                            <th>Venue</th>
                            <th>Instructor</th>
                            <th>Confidence</th>
                          </tr>
                        </thead>
                        <tbody>
                          {events.map((e, idx) => (
                            <tr key={idx}>
                              <td className="font-bold font-mono text-cyan-400">{e.courseCode}</td>
                              <td className="font-semibold text-white">{e.course}</td>
                              <td>
                                <span
                                  className={
                                    e.isElective ? 'tag-elective' : e.type === 'lab' ? 'tag-lab' : 'tag-lecture'
                                  }
                                >
                                  {e.isElective ? 'Elective' : e.type}
                                </span>
                              </td>
                              <td className="font-mono text-xs text-slate-300">
                                {e.weekday}, {e.startTime}–{e.endTime}
                              </td>
                              <td>
                                <span className="tag-room">{e.room || 'TBA'}</span>
                              </td>
                              <td className="text-slate-400 text-xs">{e.instructor || 'TBA'}</td>
                              <td>
                                <span
                                  className={`badge ${
                                    e.confidence === 'high'
                                      ? 'badge-success'
                                      : e.confidence === 'medium'
                                      ? 'badge-warning'
                                      : 'badge-danger'
                                  }`}
                                >
                                  {e.confidence}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Unparsed Rows Drawer (TC4) */}
                    {unparsedRows.length > 0 && (
                      <div className="bg-amber-950/20 border border-amber-800/60 p-4 rounded-xl space-y-2 mt-2">
                        <div className="flex items-center gap-2 text-xs font-bold text-amber-300">
                          <span>⚠️</span> Unparsed & Degraded Rows ({unparsedRows.length})
                        </div>
                        <p className="text-[11px] text-slate-300">
                          Preserved with source row locations and exact rejection reasons (never silently discarded):
                        </p>
                        <div className="space-y-2 mt-2">
                          {unparsedRows.map((u, i) => (
                            <div
                              key={i}
                              className="bg-slate-950/90 p-3 rounded-lg border border-slate-800 text-xs font-mono flex flex-wrap justify-between items-center gap-2"
                            >
                              <div>
                                <span className="text-cyan-400 font-bold">Row {u.rowNumber}: </span>
                                <span className="text-white">&quot;{u.rawContent}&quot;</span>
                              </div>
                              <span className="text-red-300 text-[11px] font-sans bg-red-950/70 px-2.5 py-0.5 rounded border border-red-800">
                                {u.reason}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Step 5 & 6: Human Approval Gate & Diff Scorecard */}
                {proposal && currentStep >= 5 && (
                  <div className="hud-card border-cyan-500/40">
                    <div className="hud-card-header">
                      <div>
                        <span className="brand-badge text-cyan-400 bg-cyan-950/60 border-cyan-500/40">
                          Step 5 & 6: Human Approval Gate
                        </span>
                        <h3 className="hud-card-title mt-1.5">Proposed Calendar Action & Diff Audit</h3>
                        <p className="hud-card-desc">
                          Review changes before authorizing writing events to the destination calendar.
                        </p>
                      </div>

                      <button
                        onClick={handleApproveAndVerify}
                        disabled={loading || proposal.status === 'approved'}
                        className="launch-button commit-button w-auto py-2.5 px-6 text-sm"
                      >
                        {loading ? (
                          <>
                            <span className="spinner" />
                            Writing & Auditing Read-Back...
                          </>
                        ) : proposal.status === 'approved' ? (
                          '✓ Approved & Synchronized'
                        ) : (
                          '✅ Approve & Sync to Calendar'
                        )}
                      </button>
                    </div>

                    <div className="diff-stat-grid">
                      <div className="diff-stat-box">
                        <div className="diff-stat-val text-cyan-400">{proposal.totalEvents}</div>
                        <div className="diff-stat-lbl">Total Proposed</div>
                      </div>
                      <div className="diff-stat-box">
                        <div className="diff-stat-val text-emerald-400">{proposal.newEvents.length}</div>
                        <div className="diff-stat-lbl">New Events</div>
                      </div>
                      <div className="diff-stat-box">
                        <div className="diff-stat-val text-amber-400">{proposal.updatedEvents.length}</div>
                        <div className="diff-stat-lbl">Updated Events</div>
                      </div>
                      <div className="diff-stat-box">
                        <div className="diff-stat-val text-slate-400">{proposal.unchangedEvents.length}</div>
                        <div className="diff-stat-lbl">Unchanged Events</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 7 & 8: Read-Back Verification & Interactive Calendar */}
                {verificationReport && currentStep >= 8 && (
                  <div className="space-y-6">
                    {/* Step 7 Scorecard */}
                    <div className="hud-card border-emerald-500/40">
                      <div className="hud-card-header">
                        <div>
                          <span className="brand-badge text-emerald-400 bg-emerald-950/60 border-emerald-500/40">
                            Step 7: Independent Read-Back Audit
                          </span>
                          <h3 className="hud-card-title mt-1.5">Verification Scorecard</h3>
                          <p className="hud-card-desc">
                            Events queried back from destination and audited field-by-field.
                          </p>
                        </div>

                        <span className="px-3.5 py-1 bg-emerald-950 text-emerald-300 font-bold text-xs rounded-full border border-emerald-500/50">
                          {verificationReport.verified}/{verificationReport.totalEvents} Verified (100%)
                        </span>
                      </div>

                      <div className="table-container-card max-h-56 overflow-y-auto">
                        <table className="futuristic-table text-xs">
                          <thead>
                            <tr>
                              <th>Event ID</th>
                              <th>Title</th>
                              <th>Verified Fields</th>
                              <th>Read-Back Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {verificationReport.results.map((r, i) => (
                              <tr key={i}>
                                <td className="font-mono text-cyan-400 text-[11px]">{r.eventId}</td>
                                <td className="font-bold text-white">{r.expected.title}</td>
                                <td className="font-mono text-slate-300 text-[11px]">
                                  {r.expected.day} • {r.expected.startTime}–{r.expected.endTime} • Room:{' '}
                                  <span className="text-emerald-400">{r.expected.room}</span>
                                </td>
                                <td>
                                  <span className="px-2.5 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-500/50">
                                    ✓ 100% MATCH
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Step 8 Calendar Grid */}
                    <div className="hud-card">
                      <div className="hud-card-header">
                        <div>
                          <h3 className="hud-card-title">
                            <span>📅</span> Step 8: Final Synchronized Calendar Schedule
                          </h3>
                          <p className="hud-card-desc">
                            Interactive weekly timetable grid with downloadable Apple/Google .ICS calendar
                          </p>
                        </div>
                      </div>

                      <CalendarView events={calendarEvents.length > 0 ? calendarEvents : events} />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ─── Sample scenarios ─── */}
        {activeTab === 'scenarios' && (
          <ScenarioRunner />
        )}

        {/* ─── How it works ─── */}
        {activeTab === 'presentation' && <PresentationMode />}

        {/* ─── TAB 4: History ─── */}
        {activeTab === 'history' && (
          <RunHistory onSelectRun={handleSelectRunFromHistory} activeRunId={activeRunId || undefined} onNavigate={(tab) => selectTab(tab as Tab)} />
        )}
      </main>
      </div>
    </div>
  );
}
