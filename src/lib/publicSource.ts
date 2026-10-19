import { lookup } from 'node:dns/promises';
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { isIP } from 'node:net';
import type { LookupFunction } from 'node:net';

const MAX_SOURCE_BYTES = 12 * 1024 * 1024;
const MAX_REDIRECTS = 3;

export class SourceError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

export async function fetchPublicUrl(input: string) {
  let current: URL;
  try {
    current = new URL(input);
  } catch {
    throw new SourceError('Enter a valid public URL, including https://.', 400);
  }

  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects++) {
    const addresses = await resolvePublicAddresses(current);
    let response: Awaited<ReturnType<typeof requestPinnedUrl>> | undefined;
    let lastError: unknown;
    for (const address of addresses.slice(0, 2)) {
      try {
        response = await requestPinnedUrl(current, address);
        break;
      } catch (error) {
        lastError = error;
      }
    }
    if (!response) throw lastError instanceof Error ? lastError : new SourceError('Could not fetch source.', 502);

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

async function resolvePublicAddresses(url: URL) {
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new SourceError('Only HTTP and HTTPS sources are supported.', 400);
  }
  if (url.username || url.password) throw new SourceError('URLs containing credentials are not allowed.', 400);

  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (!hostname || hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.local') || hostname.endsWith('.internal')) {
    throw new SourceError('Private and local network sources are not allowed.', 400);
  }

  const resolved = isIP(hostname)
    ? [{ address: hostname }]
    : await lookup(hostname, { all: true, verbatim: true }).catch(() => []);
  if (!resolved.length || resolved.some(({ address }) => !isPublicAddress(address))) {
    throw new SourceError('This URL does not resolve to a public internet address.', 400);
  }
  return resolved.map(({ address }) => address).sort((a, b) => isIP(a) - isIP(b));
}

function requestPinnedUrl(url: URL, address: string): Promise<{ status: number; headers: Headers; body: Uint8Array }> {
  return new Promise((resolve, reject) => {
    const transport = url.protocol === 'https:' ? httpsRequest : httpRequest;
    const hostname = url.hostname.replace(/^\[|\]$/g, '');
    const lookupPinned: LookupFunction = (_: string, options, callback) => {
      const family = isIP(address);
      if (typeof options === 'object' && options.all) callback(null, [{ address, family }]);
      else callback(null, address, family);
    };
    const request = transport(url, {
      method: 'GET',
      headers: { Accept: 'text/html, application/xhtml+xml, application/pdf, text/plain, text/csv;q=0.9' },
      lookup: lookupPinned,
      ...(url.protocol === 'https:' && isIP(hostname) === 0 ? { servername: hostname } : {}),
    }, (response) => {
      const chunks: Buffer[] = [];
      let size = 0;
      const length = Number(response.headers['content-length']);
      if (Number.isFinite(length) && length > MAX_SOURCE_BYTES) {
        request.destroy(new SourceError('The source is larger than the 12 MB limit.', 413));
        return;
      }
      response.on('data', (chunk: Buffer | string) => {
        const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        size += bytes.length;
        if (size > MAX_SOURCE_BYTES) {
          request.destroy(new SourceError('The source is larger than the 12 MB limit.', 413));
          return;
        }
        chunks.push(bytes);
      });
      response.on('end', () => {
        clearTimeout(deadline);
        const headers = new Headers();
        for (const [key, value] of Object.entries(response.headers)) {
          if (typeof value === 'string') headers.set(key, value);
          else if (Array.isArray(value)) headers.set(key, value.join(', '));
        }
        resolve({ status: response.statusCode ?? 502, headers, body: new Uint8Array(Buffer.concat(chunks)) });
      });
      response.on('error', (error) => { clearTimeout(deadline); reject(error); });
    });
    const deadline = setTimeout(() => request.destroy(new SourceError('The source took too long to respond.', 504)), 12_000);
    request.setTimeout(12_000, () => request.destroy(new SourceError('The source took too long to respond.', 504)));
    request.on('error', (error) => {
      clearTimeout(deadline);
      reject(error instanceof SourceError ? error : new SourceError(`Could not fetch source: ${error.message}`, 502));
    });
    request.end();
  });
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
  if (isIP(normalized) !== 6) return false;

  const value = ipv6ToBigInt(normalized);
  if ((value >> BigInt(125)) !== BigInt(1)) return false;
  return ![
    ['2001::', 23],
    ['2002::', 16],
    ['3fff::', 20],
  ].some(([prefix, bits]) => ipv6PrefixMatches(value, prefix as string, bits as number));
}

function ipv6PrefixMatches(address: bigint, prefix: string, bits: number) {
  return (address >> BigInt(128 - bits)) === (ipv6ToBigInt(prefix) >> BigInt(128 - bits));
}

function ipv6ToBigInt(address: string): bigint {
  let input = address.toLowerCase();
  const ipv4Tail = input.match(/(?:^|:)(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (ipv4Tail) {
    const octets = ipv4Tail[1].split('.').map(Number);
    const high = ((octets[0] << 8) | octets[1]).toString(16);
    const low = ((octets[2] << 8) | octets[3]).toString(16);
    input = input.replace(ipv4Tail[0], `:${high}:${low}`);
  }

  const halves = input.split('::');
  const left = halves[0] ? halves[0].split(':') : [];
  const right = halves.length === 2 && halves[1] ? halves[1].split(':') : [];
  const groups = halves.length === 2
    ? [...left, ...Array(8 - left.length - right.length).fill('0'), ...right]
    : left;

  return groups.reduce((value, group) => (value << BigInt(16)) | BigInt(`0x${group || '0'}`), BigInt(0));
}
