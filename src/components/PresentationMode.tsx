'use client';

import { useState } from 'react';

const sections = [
  { id: 'overview', label: 'Overview' },
  { id: 'workflow', label: 'Workflow' },
  { id: 'reliability', label: 'Reliability' },
  { id: 'examples', label: 'Examples' },
] as const;

type Section = (typeof sections)[number]['id'];

const workflow = [
  ['01', 'Choose a source', 'Select a sample schedule or paste your own timetable text.'],
  ['02', 'Read the rows', 'Parse each row into a class, time, day, room, and source reference.'],
  ['03', 'Check overlaps', 'Compare time intervals and keep both sessions visible when they overlap.'],
  ['04', 'Review the result', 'Inspect parsed sessions and any rows that need attention.'],
  ['05', 'Compare changes', 'See which calendar entries are new, changed, or unchanged.'],
  ['06', 'Approve the update', 'Confirm the proposed changes before they are written.'],
  ['07', 'Write calendar events', 'Save approved entries to the local calendar adapter.'],
  ['08', 'Verify and export', 'Read the saved entries back, then download an iCalendar file.'],
];

const reliability = [
  {
    index: '01',
    title: 'Stable event identity',
    body: 'Course, session type, weekday, and session index form a repeatable event ID. A separate content hash detects changes such as a new room or time.',
    note: 'Deterministic IDs are for matching events; they are not cryptographic hashes.',
  },
  {
    index: '02',
    title: 'Visible overlaps',
    body: 'The clash detector compares start and end intervals. Conflicting sessions remain in the schedule and include the exact overlap window.',
    note: 'You can review the conflict before approving calendar changes.',
  },
  {
    index: '03',
    title: 'Independent read-back',
    body: 'After approval, the verifier compares saved calendar fields with the proposed event details and reports the result per event.',
    note: 'Calendar writes use the local demo adapter in this project.',
  },
];

const examples = [
  ['TC1', 'Weekly schedule', 'Parse a regular timetable and check its rooms and times.'],
  ['TC2', 'Elective overlap', 'Keep conflicting elective and core sessions visible for review.'],
  ['TC3', 'Schedule revision', 'Compare a revised timetable with existing calendar entries.'],
  ['TC4', 'Unreadable rows', 'Retain rows that could not be parsed with a reason for review.'],
];

export default function PresentationMode() {
  const [activeSection, setActiveSection] = useState<Section>('overview');

  return (
    <section className="overview-page" aria-labelledby="overview-title">
      <header className="overview-heading">
        <p className="eyebrow">Weekline · Guide</p>
        <h1 id="overview-title">A clearer path from timetable to calendar</h1>
        <p className="overview-lede">
          See how schedule text is parsed, checked, reviewed, and exported. The examples use the same workflow as the schedule page.
        </p>
      </header>

      <nav className="overview-tabs" aria-label="Guide sections">
        {sections.map((section) => (
          <button
            key={section.id}
            id={'guide-tab-' + section.id}
            type="button"
            aria-pressed={activeSection === section.id}
            className={activeSection === section.id ? 'overview-tab is-active' : 'overview-tab'}
            onClick={() => setActiveSection(section.id)}
          >
            {section.label}
          </button>
        ))}
      </nav>

      <div id="guide-panel" className="overview-panel" role="region" aria-label={sections.find((section) => section.id === activeSection)?.label}>
        {activeSection === 'overview' && (
          <div className="overview-columns">
            <article className="overview-story overview-story-muted">
              <p className="eyebrow">The friction</p>
              <h2>Schedules are easy to misread and tedious to maintain.</h2>
              <ul className="overview-list">
                <li>Class details are often spread across dense tables and notices.</li>
                <li>Manual entry makes it hard to spot elective and lab conflicts.</li>
                <li>Room or time changes can leave calendar entries out of date.</li>
              </ul>
            </article>
            <article className="overview-story overview-story-accent">
              <p className="eyebrow">The approach</p>
              <h2>Keep each step visible, and let you decide what gets saved.</h2>
              <ul className="overview-list">
                <li>Review extracted events and source rows before committing.</li>
                <li>See conflicts and proposed changes alongside the schedule.</li>
                <li>Approve calendar updates, verify the saved result, and export.</li>
              </ul>
            </article>
          </div>
        )}

        {activeSection === 'workflow' && (
          <div className="guide-section">
            <div className="guide-section-heading">
              <p className="eyebrow">The workflow</p>
              <h2>Eight steps, with a review before anything is saved</h2>
            </div>
            <ol className="workflow-grid">
              {workflow.map(([number, title, body]) => (
                <li className="workflow-card" key={number}>
                  <span className="workflow-number">{number}</span>
                  <h3>{title}</h3>
                  <p>{body}</p>
                </li>
              ))}
            </ol>
          </div>
        )}

        {activeSection === 'reliability' && (
          <div className="guide-section">
            <div className="guide-section-heading">
              <p className="eyebrow">Reliability</p>
              <h2>Small checks that make schedule changes easier to trust</h2>
            </div>
            <div className="reliability-grid">
              {reliability.map((item) => (
                <article className="reliability-card" key={item.index}>
                  <span className="workflow-number">{item.index}</span>
                  <h3>{item.title}</h3>
                  <p>{item.body}</p>
                  <p className="reliability-note">{item.note}</p>
                </article>
              ))}
            </div>
          </div>
        )}

        {activeSection === 'examples' && (
          <div className="guide-section">
            <div className="guide-section-heading">
              <p className="eyebrow">Included examples</p>
              <h2>Four useful cases to explore</h2>
            </div>
            <div className="example-list">
              {examples.map(([id, title, body]) => (
                <article className="example-row" key={id}>
                  <span className="example-id">{id}</span>
                  <div><h3>{title}</h3><p>{body}</p></div>
                </article>
              ))}
              <p className="example-footnote">Run a case from Scenarios to see its current result. This guide does not assume that a scenario has passed.</p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
