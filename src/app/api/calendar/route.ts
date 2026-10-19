// ─── /api/calendar — Get calendar events and ICS download ─────────────
import { NextRequest, NextResponse } from 'next/server';
import { readAllEvents, generateICS } from '@/lib/calendarAdapter';

export async function GET(req: NextRequest) {
  const format = req.nextUrl.searchParams.get('format');
  const events = readAllEvents();

  if (format === 'ics') {
    const ics = generateICS(events);
    return new NextResponse(ics, {
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': 'attachment; filename="timetable.ics"',
      },
    });
  }

  // Return as FullCalendar-compatible event objects
  const calendarEvents = events.map(e => {
    if (e.examDate) {
      return {
        id: e.id,
        title: e.title,
        start: `${e.examDate}T${e.startTime}:00`,
        end: `${e.examDate}T${e.endTime}:00`,
        extendedProps: {
          room: e.room,
          instructor: e.instructor,
          type: e.type,
          isElective: e.isElective,
        },
        color: getEventColor(e.type, e.isElective),
      };
    }

    // Weekly recurring — generate instances for FullCalendar
    const instances = generateWeeklyInstances(e);
    return instances;
  }).flat();

  return NextResponse.json({ events: calendarEvents, rawEvents: events });
}

function generateWeeklyInstances(event: ReturnType<typeof readAllEvents>[0]) {
  const dayIndex = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    .indexOf(event.day);
  if (dayIndex === -1) return [];

  const instances = [];
  const start = new Date(event.recurrenceStart);
  const end = new Date(event.recurrenceEnd);

  // Find first occurrence
  const current = new Date(start);
  const currentDay = current.getDay();
  let diff = dayIndex - currentDay;
  if (diff < 0) diff += 7;
  current.setDate(current.getDate() + diff);

  while (current <= end) {
    const dateStr = current.toISOString().split('T')[0];
    instances.push({
      id: `${event.id}-${dateStr}`,
      title: event.title,
      start: `${dateStr}T${event.startTime}:00`,
      end: `${dateStr}T${event.endTime}:00`,
      extendedProps: {
        room: event.room,
        instructor: event.instructor,
        type: event.type,
        isElective: event.isElective,
        sourceId: event.id,
      },
      color: getEventColor(event.type, event.isElective),
    });
    current.setDate(current.getDate() + 7);
  }

  return instances;
}

function getEventColor(type: string, isElective: boolean): string {
  if (isElective) return '#8b5cf6'; // purple for electives
  switch (type) {
    case 'lab': return '#ef4444';      // red
    case 'tutorial': return '#f59e0b'; // amber
    case 'exam': return '#dc2626';     // dark red
    default: return '#3b82f6';         // blue for lectures
  }
}
