import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 30;

const MAX_SOURCE_BYTES = 12 * 1024 * 1024;
const MAX_REDIRECTS = 3;

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
    if (!response.ok) {
      return NextResponse.json({ error: `The source returned HTTP ${response.status}.` }, { status: 502 });
    }

    const bytes = await readLimitedBody(response, MAX_SOURCE_BYTES);
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

async function fetchPublicUrl(input: string) {
  let current: URL;
  try {
    current = new URL(input);
  } catch {
    throw new SourceError('Enter a valid public URL, including https://.', 400);
  }

  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects++) {
    await assertPublicHost(current);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12_000);
    let response: Response;
    try {
      response = await fetch(current, {
        redirect: 'manual',
        signal: controller.signal,
        headers: { Accept: 'text/html, application/xhtml+xml, application/pdf, text/plain, text/csv;q=0.9' },
      });
    } catch (error) {
      if (controller.signal.aborted) throw new SourceError('The source took too long to respond.', 504);
      throw new SourceError(error instanceof Error ? `Could not fetch source: ${error.message}` : 'Could not fetch source.', 502);
    } finally {
      clearTimeout(timeout);
    }

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location) throw new SourceError('The source redirected without a destination.', 502);
      if (redirects === MAX_REDIRECTS) throw new SourceError('The source redirected too many times.', 502);
      current = new URL(location, current);
      continue;
    }
    return { response, resolvedUrl: current };
  }
  throw new SourceError('The source could not be reached.', 502);
}

async function assertPublicHost(url: URL) {
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new SourceError('Only HTTP and HTTPS sources are supported.', 400);
  }
  if (url.username || url.password) throw new SourceError('URLs containing credentials are not allowed.', 400);

  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (!hostname || hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.local') || hostname.endsWith('.internal')) {
    throw new SourceError('Private and local network sources are not allowed.', 400);
  }

  const addresses = isIP(hostname)
    ? [{ address: hostname }]
    : await lookup(hostname, { all: true, verbatim: true }).catch(() => []);
  if (!addresses.length || addresses.some(({ address }) => !isPublicAddress(address))) {
    throw new SourceError('This URL does not resolve to a public internet address.', 400);
  }
}

function isPublicAddress(address: string) {
  if (isIP(address) === 4) {
    const octets = address.split('.').map(Number);
    const [a, b, c] = octets;
    if (a === 0 || a === 10 || a === 127 || a >= 224) return false;
    if (a === 100 && b >= 64 && b <= 127) return false;
    if (a === 169 && b === 254) return false;
    if (a === 172 && b >= 16 && b <= 31) return false;
    if (a === 192 && (b === 168 || (b === 0 && (c === 0 || c === 2)))) return false;
    if (a === 198 && (b === 18 || b === 19 || b === 51)) return false;
    if (a === 203 && b === 0 && c === 113) return false;
    return true;
  }
  const normalized = address.toLowerCase();
  if (normalized.startsWith('::ffff:')) return isPublicAddress(normalized.slice(7));
  if (normalized === '::' || normalized === '::1') return false;
  if (/^(fc|fd|fe[89ab])/.test(normalized)) return false;
  if (/^(64:ff9b|2002:)/.test(normalized)) return false;
  if (/^(2001:db8|2001:0db8)/.test(normalized)) return false;
  return isIP(normalized) === 6;
}

async function readLimitedBody(response: Response, limit: number) {
  const length = Number(response.headers.get('content-length'));
  if (Number.isFinite(length) && length > limit) throw new SourceError('The source is larger than the 12 MB limit.', 413);
  if (!response.body) throw new SourceError('The source did not contain a response body.', 502);

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel();
      throw new SourceError('The source is larger than the 12 MB limit.', 413);
    }
    chunks.push(value);
  }
  const result = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result;
}

async function extractPdfText(data: Uint8Array) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  let pdf: Awaited<ReturnType<typeof pdfjs.getDocument>>['promise'] extends Promise<infer T> ? T : never;
  try {
    pdf = await pdfjs.getDocument({ data, useSystemFonts: true }).promise;
  } catch {
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

class SourceError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}
