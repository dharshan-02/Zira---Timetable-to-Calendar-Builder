import { NextRequest, NextResponse } from 'next/server';
import { fetchPublicUrl, SourceError } from '@/lib/publicSource';

export const maxDuration = 30;

const MAX_SOURCE_BYTES = 12 * 1024 * 1024;

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') ?? '';
    const fetchedAt = new Date().toISOString();

    if (contentType.includes('multipart/form-data')) {
      const form = await request.formData();
      const file = form.get('file');
      if (!(file instanceof File)) {
        return NextResponse.json({ error: 'Choose a PDF file first.' }, { status: 400 });
      }
      if (file.size > MAX_SOURCE_BYTES) {
        return NextResponse.json({ error: 'PDF files must be 12 MB or smaller.' }, { status: 413 });
      }
      if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
        return NextResponse.json({ error: 'This upload endpoint accepts PDF files only.' }, { status: 415 });
      }

      const bytes = new Uint8Array(await file.arrayBuffer());
      const extracted = await extractPdfText(bytes);
      return NextResponse.json({
        ...extracted,
        sourceUrl: null,
        sourceName: file.name,
        contentType: 'application/pdf',
        fetchedAt,
      });
    }

    const body = await request.json();
    const inputUrl = typeof body.url === 'string' ? body.url.trim() : '';
    if (!inputUrl) {
      return NextResponse.json({ error: 'Enter a public timetable page or PDF URL.' }, { status: 400 });
    }

    const { response, resolvedUrl } = await fetchPublicUrl(inputUrl);
    const responseType = (response.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
    if (response.status < 200 || response.status >= 300) {
      return NextResponse.json({ error: `The source returned HTTP ${response.status}.` }, { status: 502 });
    }

    const bytes = response.body;
    let extracted: { content: string; title: string; warning?: string };
    if (responseType === 'application/pdf' || resolvedUrl.pathname.toLowerCase().endsWith('.pdf')) {
      extracted = await extractPdfText(bytes);
    } else if (responseType === 'text/html' || responseType === 'application/xhtml+xml') {
      extracted = htmlToTimetableText(new TextDecoder().decode(bytes));
    } else if (responseType.startsWith('text/') || responseType === 'application/csv') {
      extracted = { content: new TextDecoder().decode(bytes), title: resolvedUrl.hostname };
    } else {
      return NextResponse.json({ error: `Unsupported source format: ${responseType || 'unknown'}. Use a public HTML page, PDF, or text file.` }, { status: 415 });
    }

    if (!extracted.content.trim()) {
      return NextResponse.json({ error: 'No selectable timetable text was found. Image-only scans need OCR or manual review.' }, { status: 422 });
    }

    return NextResponse.json({
      ...extracted,
      sourceUrl: resolvedUrl.toString(),
      sourceName: resolvedUrl.hostname,
      contentType: responseType || 'text/plain',
      fetchedAt,
    });
  } catch (error) {
    const status = error instanceof SourceError ? error.status : 500;
    const message = error instanceof Error ? error.message : 'Source could not be read.';
    return NextResponse.json({ error: message }, { status });
  }
}

async function extractPdfText(data: Uint8Array) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  // Set an absolute file URL so PDF.js can load its dynamically imported
  // worker from the standalone server's traced node_modules directory.
  const { createRequire } = await import('node:module');
  const { pathToFileURL } = await import('node:url');
  const require = createRequire(import.meta.url);
  pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(
    require.resolve('pdfjs-dist/legacy/build/pdf.worker.mjs'),
  ).href;
  let pdf: Awaited<ReturnType<typeof pdfjs.getDocument>>['promise'] extends Promise<infer T> ? T : never;
  try {
    pdf = await pdfjs.getDocument({ data, useSystemFonts: true }).promise;
  } catch (error) {
    console.error('PDF text extraction failed:', error);
    throw new SourceError('This PDF could not be decoded. It may be damaged or encrypted.', 422);
  }
  const pageRows: string[] = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber);
    const text = await page.getTextContent();
    const rows = new Map<number, Array<{ x: number; text: string }>>();
    for (const item of text.items) {
      if (!('str' in item) || !item.str.trim()) continue;
      const x = item.transform[4];
      const y = Math.round(item.transform[5] * 2) / 2;
      const row = rows.get(y) ?? [];
      row.push({ x, text: item.str.trim() });
      rows.set(y, row);
    }
    const ordered = Array.from(rows.entries()).sort((a, b) => b[0] - a[0]);
    for (const [, cells] of ordered) {
      cells.sort((a, b) => a.x - b.x);
      pageRows.push(cells.map((cell) => cell.text).join(' | '));
    }
  }
  const content = pageRows.join('\n');
  if (!content.trim()) throw new SourceError('This PDF has no selectable text. Image-only scans need OCR or manual review.', 422);
  return { content, title: 'Uploaded PDF' };
}

function htmlToTimetableText(html: string) {
  const title = decodeHtml(html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? 'Public timetable page').trim();
  const tableRows = Array.from(html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)).map((match) => {
    const cells = Array.from(match[1].matchAll(/<t[hd]\b[^>]*>([\s\S]*?)<\/t[hd]>/gi))
      .map((cell) => cleanHtmlText(cell[1]))
      .filter(Boolean);
    return cells.join(' | ');
  }).filter(Boolean);

  if (tableRows.length) return { content: tableRows.join('\n'), title };
  const body = html.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)?.[1] ?? html;
  const content = cleanHtmlText(body.replace(/<\/(?:p|div|li|h[1-6]|br|section|article)>/gi, '\n'));
  return { content, title };
}

function cleanHtmlText(value: string) {
  return decodeHtml(value
    .replace(/<!--([\s\S]*?)-->/g, ' ')
    .replace(/<(script|style|noscript|svg)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[\t\r\f\v ]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n'))
    .split('\n').map((line) => line.trim()).filter(Boolean).join('\n');
}

function decodeHtml(value: string) {
  return value
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_, code: string) => String.fromCodePoint(parseInt(code, 16)));
}
