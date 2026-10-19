// ─── /api/calendar — Get calendar events and ICS download ─────────────
import { NextRequest, NextResponse } from 'next/server';
import { readAllEvents, generateICS } from '@/lib/calendarAdapter';
import ExcelJS from 'exceljs';
import { Document, HeadingLevel, Packer, Paragraph, Table, TableCell, TableRow, TextRun, WidthType } from 'docx';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

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

  if (format === 'xlsx') {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Weekline';
    workbook.created = new Date();
    const sheet = workbook.addWorksheet('Approved timetable');
    sheet.columns = [
      { header: 'Course code', key: 'courseCode', width: 18 },
      { header: 'Course', key: 'course', width: 34 },
      { header: 'Type', key: 'type', width: 14 },
      { header: 'Day', key: 'day', width: 14 },
      { header: 'Date', key: 'date', width: 14 },
      { header: 'Start', key: 'startTime', width: 12 },
      { header: 'End', key: 'endTime', width: 12 },
      { header: 'Room', key: 'room', width: 18 },
      { header: 'Instructor', key: 'instructor', width: 24 },
      { header: 'Elective', key: 'isElective', width: 12 },
    ];
    for (const event of events) sheet.addRow({
      courseCode: event.title.split(' — ')[0], course: event.title.split(' — ').slice(1).join(' — '),
      type: event.type, day: event.day, date: event.examDate ?? '', startTime: event.startTime,
      endTime: event.endTime, room: event.room, instructor: event.instructor,
      isElective: event.isElective ? 'Yes' : 'No',
    });
    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF315B4C' } };
    const bytes = new Uint8Array(await workbook.xlsx.writeBuffer()).buffer;
    return download(bytes, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'weekline-timetable.xlsx');
  }

  if (format === 'docx') {
    const rows = [new TableRow({ children: ['Course code', 'Course', 'Type', 'Day / date', 'Time', 'Room', 'Instructor'].map((text) => new TableCell({ children: [new Paragraph({ children: [new TextRun({ text, bold: true })] })] })) })];
    for (const event of events) rows.push(new TableRow({ children: [
      event.title.split(' — ')[0], event.title.split(' — ').slice(1).join(' — '), event.type,
      event.examDate ? `Exam · ${event.examDate}` : event.day, `${event.startTime}–${event.endTime}`,
      event.room, event.instructor,
    ].map((text) => new TableCell({ children: [new Paragraph(String(text))] })) }));
    const document = new Document({ sections: [{ children: [
      new Paragraph({ text: 'Weekline timetable', heading: HeadingLevel.TITLE }),
      new Paragraph({ text: 'Approved calendar entries' }),
      new Paragraph({ text: `Exported ${new Date().toLocaleString()}` }),
      new Table({ rows, width: { size: 100, type: WidthType.PERCENTAGE } }),
    ] }] });
    return download(new Uint8Array(await Packer.toBuffer(document)).buffer, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'weekline-timetable.docx');
  }

  if (format === 'pdf') {
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    const pageSize: [number, number] = [612, 792];
    let page = pdf.addPage(pageSize);
    let y = 748;
    page.drawText('Weekline timetable', { x: 48, y, size: 20, font: bold, color: rgb(0.19, 0.36, 0.3) });
    y -= 24;
    page.drawText('Approved calendar entries', { x: 48, y, size: 10, font });
    y -= 30;
    const cols = [48, 124, 258, 330, 408, 480];
    const headings = ['Code', 'Course', 'Day/date', 'Time', 'Room', 'Type'];
    page.drawText(headings.join('     '), { x: 48, y, size: 9, font: bold });
    y -= 14;
    for (const event of events) {
      if (y < 54) { page = pdf.addPage(pageSize); y = 748; }
      const values = [event.title.split(' — ')[0], event.title.split(' — ').slice(1).join(' — '), event.examDate ?? event.day, `${event.startTime}-${event.endTime}`, event.room, event.type];
      const widths = [72, 128, 70, 72, 72, 60];
      values.forEach((value, index) => page.drawText(pdfSafe(value).slice(0, index === 1 ? 23 : 13), { x: cols[index], y, size: 8, font, maxWidth: widths[index] }));
      y -= 17;
    }
    return download(new Uint8Array(await pdf.save()).buffer, 'application/pdf', 'weekline-timetable.pdf');
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

function download(body: ArrayBuffer, contentType: string, filename: string) {
  return new NextResponse(body, { headers: {
    'Content-Type': contentType,
    'Content-Disposition': `attachment; filename="${filename}"`,
    'Cache-Control': 'no-store',
  } });
}

function pdfSafe(value: string) {
  return value.replace(/[—–]/g, '-').replace(/[^\x20-\x7E]/g, '?');
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
