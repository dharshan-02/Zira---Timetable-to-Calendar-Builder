'use client';

import React, { useState } from 'react';
import { ExtractedEvent, CalendarEvent } from '@/lib/types';

interface CalendarDisplayEvent {
  id: string;
  title?: string;
  courseCode?: string;
  course?: string;
  weekday?: string;
  day?: string;
  startTime: string;
  endTime: string;
  room?: string;
  instructor?: string;
  type?: string;
  isElective?: boolean;
  recurrenceStart?: string;
  recurrenceEnd?: string;
  examDate?: string;
  sourceExcerpt?: string;
  sourceRow?: number;
}

interface CalendarViewProps {
  events: ExtractedEvent[] | CalendarEvent[];
  icsDownloadUrl?: string;
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18];

export default function CalendarView({ events, icsDownloadUrl }: CalendarViewProps) {
  const [selectedEvent, setSelectedEvent] = useState<CalendarDisplayEvent | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const displayEvents = events.map(toDisplayEvent);

  const timeToMinutes = (timeStr: string) => {
    if (!timeStr) return 0;
    const [h, m] = timeStr.split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
  };

  const getDayEvents = (day: string) => {
    return displayEvents.filter((e) => {
      const d = e.weekday || e.day;
      return d && d.toLowerCase() === day.toLowerCase();
    });
  };

  const getEventBadgeClass = (type?: string, isElective?: boolean) => {
    if (isElective) return 'bg-purple-950/80 text-purple-300 border-purple-700/60';
    switch (type?.toLowerCase()) {
      case 'lab':
        return 'bg-rose-950/80 text-rose-300 border-rose-700/60';
      case 'tutorial':
        return 'bg-amber-950/80 text-amber-300 border-amber-700/60';
      case 'exam':
        return 'bg-red-950/90 text-red-200 border-red-600 font-bold';
      default:
        return 'bg-indigo-950/80 text-indigo-300 border-indigo-700/60';
    }
  };

  return (
    <div className="space-y-4">
      {/* Header controls */}
      <div className="calendar-toolbar flex flex-wrap items-center justify-between gap-3 p-4 bg-slate-900/70 border border-slate-800 rounded-2xl backdrop-blur-md">
        <div className="calendar-controls flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
          <div>
            <h3 className="font-semibold text-slate-100 text-sm tracking-wide">
              Live Calendar Adapter ({events.length} schedule entries)
            </h3>
            <p className="mt-1 text-[11px] text-slate-400">Downloads contain approved entries saved to the calendar.</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
            <button
              onClick={() => setViewMode('grid')}
              className={`px-3 py-1.5 rounded-lg font-medium transition ${
                viewMode === 'grid'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Weekly Grid
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 rounded-lg font-medium transition ${
                viewMode === 'list'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Agenda View
            </button>
          </div>

          <a href="/api/calendar?format=xlsx" className="calendar-export-link" aria-label="Download approved timetable as Excel spreadsheet">Excel .xlsx</a>
          <a href="/api/calendar?format=docx" className="calendar-export-link" aria-label="Download approved timetable as Word document">Word .docx</a>
          <a href="/api/calendar?format=pdf" className="calendar-export-link" aria-label="Download approved timetable as PDF">PDF</a>
          <a
            href={icsDownloadUrl || '/api/calendar?format=ics'}
            download="timetable.ics"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600/90 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl border border-emerald-500/40 shadow-sm transition"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            ICS
          </a>
        </div>
      </div>

      {/* Grid Mode */}
      {viewMode === 'grid' && (
        <div className="calendar-grid-scroll overflow-x-auto bg-slate-950/80 border border-slate-800/80 rounded-2xl p-4 shadow-inner">
          <div className="min-w-[850px]">
            {/* Days Header */}
            <div className="grid grid-cols-7 gap-2 pb-3 border-b border-slate-800 text-center text-xs font-semibold uppercase tracking-wider text-slate-400">
              <div className="text-slate-500 py-1">Time</div>
              {DAYS.map((d) => (
                <div key={d} className="bg-slate-900/60 py-1.5 rounded-lg border border-slate-800/60">
                  {d}
                </div>
              ))}
            </div>

            {/* Timetable Rows */}
            <div className="divide-y divide-slate-800/40 mt-1">
              {HOURS.map((hour) => {
                const hourFormatted = `${hour.toString().padStart(2, '0')}:00`;
                return (
                  <div key={hour} className="grid grid-cols-7 gap-2 min-h-[74px] py-1.5 items-stretch">
                    {/* Time Slot */}
                    <div className="text-right pr-2 text-[11px] text-slate-500 font-mono flex items-start pt-1 justify-end">
                      {hourFormatted}
                    </div>

                    {/* Days Slots */}
                    {DAYS.map((day) => {
                      const dayEvts = getDayEvents(day);
                      // Filter events that fall in this hour slot
                      const slotEvents = dayEvts.filter((e) => {
                        const startMin = timeToMinutes(e.startTime);
                        const slotStart = hour * 60;
                        const slotEnd = (hour + 1) * 60;
                        return startMin >= slotStart && startMin < slotEnd;
                      });

                      return (
                        <div
                          key={day}
                          className="bg-slate-900/30 border border-slate-800/40 rounded-xl p-1 relative flex flex-col gap-1 transition hover:bg-slate-900/50"
                        >
                          {slotEvents.map((evt, idx) => {
                            const code = evt.courseCode || evt.title?.split('—')[0]?.trim();
                            const room = evt.room || 'TBA';
                            const badgeCls = getEventBadgeClass(evt.type, evt.isElective);

                            return (
                              <button
                                key={idx}
                                onClick={() => setSelectedEvent(evt)}
                                className={`w-full text-left p-1.5 rounded-lg border text-xs leading-tight transition transform hover:-translate-y-0.5 shadow-sm ${badgeCls}`}
                              >
                                <div className="font-bold truncate">{code}</div>
                                <div className="text-[10px] opacity-80 truncate flex items-center justify-between">
                                  <span>{evt.startTime} - {evt.endTime}</span>
                                  <span className="font-mono bg-black/40 px-1 rounded text-[9px]">{room}</span>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* List / Agenda Mode */}
      {viewMode === 'list' && (
        <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 divide-y divide-slate-800/60 max-h-[500px] overflow-y-auto">
          {events.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-sm">No scheduled events found in calendar.</div>
          ) : (
            displayEvents.map((e, i: number) => {
              const code = e.courseCode || e.title?.split('—')[0]?.trim() || e.course;
              const name = e.course || e.title || code;
              const day = e.examDate ? `Exam · ${e.examDate}` : e.weekday || e.day;
              return (
                <div
                  key={i}
                  onClick={() => setSelectedEvent(e)}
                  className="agenda-event py-3 px-2 flex items-center justify-between hover:bg-slate-900/60 rounded-xl transition cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <span className={`px-2 py-1 text-[11px] font-semibold rounded-lg border ${getEventBadgeClass(e.type, e.isElective)}`}>
                      {e.type || 'class'}
                    </span>
                    <div>
                      <div className="font-semibold text-slate-200 text-sm">
                        {code} <span className="text-xs text-slate-400 font-normal">({name})</span>
                      </div>
                      <div className="agenda-meta text-xs text-slate-400 flex items-center gap-3 mt-0.5">
                        <span>🗓️ {day}</span>
                        <span>⏰ {e.startTime} - {e.endTime}</span>
                        <span>📍 {e.room || 'TBA'}</span>
                        {e.instructor && <span>👤 {e.instructor}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[11px] font-mono text-slate-500 bg-slate-900 px-2 py-1 rounded border border-slate-800">
                      ID: {e.id?.slice(0, 10)}...
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Event Details Modal */}
      {selectedEvent && (
        <div className="calendar-modal fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in">
          <div className="calendar-modal-card bg-slate-900 border border-slate-700/80 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold mb-1 border ${getEventBadgeClass(selectedEvent.type, selectedEvent.isElective)}`}>
                  {selectedEvent.isElective ? 'Elective Course' : selectedEvent.type?.toUpperCase()}
                </span>
                <h4 className="text-lg font-bold text-slate-100">
                  {selectedEvent.courseCode || selectedEvent.title}
                </h4>
                <p className="text-xs text-slate-400">{selectedEvent.course || selectedEvent.title}</p>
              </div>
              <button
                onClick={() => setSelectedEvent(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
              >
                ✕
              </button>
            </div>

            <div className="bg-slate-950/80 rounded-xl p-3 border border-slate-800 text-xs space-y-2">
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-400">Schedule:</span>
                <span className="font-semibold text-slate-200">{selectedEvent.examDate ? `Exam · ${selectedEvent.examDate}` : selectedEvent.weekday || selectedEvent.day}, {selectedEvent.startTime} - {selectedEvent.endTime}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-400">Assigned Venue:</span>
                <span className="font-semibold text-emerald-400 font-mono">{selectedEvent.room || 'TBA'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-400">Faculty/Instructor:</span>
                <span className="text-slate-200">{selectedEvent.instructor || 'TBA'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-400">Recurrence Interval:</span>
                <span className="text-slate-300 font-mono text-[11px]">
                  {selectedEvent.examDate ? 'One-time event' : `${selectedEvent.recurrenceStart || '2026-08-01'} to ${selectedEvent.recurrenceEnd || '2026-11-30'} (Weekly)`}
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-400">Deterministic ID:</span>
                <span className="text-indigo-400 font-mono text-[11px] truncate max-w-[200px]">
                  {selectedEvent.id}
                </span>
              </div>
            </div>

            {selectedEvent.sourceExcerpt && (
              <div className="text-[11px] text-slate-400 bg-slate-950/50 p-2.5 rounded-lg border border-slate-800/70">
                <div className="font-semibold text-slate-300 mb-1">Source Excerpt (Row {selectedEvent.sourceRow}):</div>
                <code className="text-[10px] text-slate-400 font-mono">{selectedEvent.sourceExcerpt}</code>
              </div>
            )}

            <button
              onClick={() => setSelectedEvent(null)}
              className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl transition"
            >
              Close Details
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function toDisplayEvent(event: ExtractedEvent | CalendarEvent): CalendarDisplayEvent {
  if ('weekday' in event) return event;
  const [courseCode, ...courseParts] = event.title.split(' — ');
  return {
    ...event,
    courseCode,
    course: courseParts.join(' — ') || event.title,
    weekday: event.day,
  };
}
