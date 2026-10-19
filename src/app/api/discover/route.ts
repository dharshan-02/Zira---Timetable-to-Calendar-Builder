import { load } from 'cheerio';
import { NextRequest, NextResponse } from 'next/server';
import { fetchPublicUrl, SourceError } from '@/lib/publicSource';
import { createHash } from 'node:crypto';

export const maxDuration = 30;

const DISCOVERY_TERMS = /timetable|time-table|schedule|exam|semester|course|class|lecture|calendar|pdf/i;

/** Finds relevant same-site links on a public timetable portal page. */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const pageUrl = typeof body.url === 'string' ? body.url.trim() : '';
    if (!pageUrl) return NextResponse.json({ error: 'Enter a public college timetable or exam portal URL.' }, { status: 400 });

    const { response, resolvedUrl } = await fetchPublicUrl(pageUrl);
    if (response.status < 200 || response.status >= 300) {
      return NextResponse.json({ error: `The portal returned HTTP ${response.status}.` }, { status: 502 });
    }
    const contentType = (response.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
    if (contentType !== 'text/html' && contentType !== 'application/xhtml+xml') {
      return NextResponse.json({ error: 'Source discovery needs a public HTML portal page. For a PDF, choose Upload or enter its direct URL.' }, { status: 415 });
    }

    const $ = load(new TextDecoder().decode(response.body));
    const candidates = new Map<string, { id: string; url: string; title: string; kind: 'class' | 'exam' | 'mixed'; score: number; reason: string }>();
    $('a[href]').each((_, element) => {
      const href = $(element).attr('href')?.trim();
      const label = $(element).text().replace(/\s+/g, ' ').trim();
      if (!href) return;
      let target: URL;
      try {
        target = new URL(href, resolvedUrl);
      } catch {
        return;
      }
      if (!['http:', 'https:'].includes(target.protocol) || target.origin !== resolvedUrl.origin || target.username || target.password) return;
      target.hash = '';
      if (target.pathname === resolvedUrl.pathname && target.search === resolvedUrl.search) return;

      const context = $(element).closest('li, p, article, section').text().replace(/\s+/g, ' ').trim().slice(0, 240);
      const haystack = `${label} ${target.pathname} ${context}`;
      if (!DISCOVERY_TERMS.test(haystack)) return;
      const kind = /exam/i.test(haystack) ? 'exam' : /class|lecture|course|semester/i.test(haystack) ? 'class' : 'mixed';
      const score = (/timetable|time-table|schedule/i.test(haystack) ? 3 : 0) +
        (/exam/i.test(haystack) ? 2 : 0) +
        (/\.pdf(?:$|[?#])/i.test(target.href) ? 1 : 0) +
        (label && label.toLowerCase() !== 'download' ? 1 : 0);
      const canonicalUrl = target.toString();
      const title = !label || label.toLowerCase() === 'download' ? target.pathname.split('/').filter(Boolean).at(-1) || target.hostname : label;
      const reason = kind === 'exam'
        ? 'Link text or path identifies an exam source.'
        : kind === 'class'
          ? 'Link text or path identifies a class timetable source.'
          : 'Link text or path matches timetable-related terms; review before fetching.';
      candidates.set(canonicalUrl, {
        id: createHash('sha256').update(canonicalUrl).digest('hex').slice(0, 16),
        url: canonicalUrl,
        title,
        kind,
        score,
        reason,
      });
    });

    const ordered = Array.from(candidates.values())
      .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title))
      .slice(0, 20);
    return NextResponse.json({
      sourcePageUrl: resolvedUrl.toString(),
      retrievedAt: new Date().toISOString(),
      candidates: ordered,
      warning: ordered.length ? undefined : 'No timetable links matched. Enter a direct public PDF or page URL instead.',
    });
  } catch (error) {
    const status = error instanceof SourceError ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Source discovery failed.' }, { status });
  }
}
