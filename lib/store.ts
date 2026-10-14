import { put, list, del } from '@vercel/blob';

// Everything (media + JSON records) lives in Vercel Blob so the video API can reach it by public URL.

function bust(url: string, uploadedAt: Date | string) {
  return `${url}${url.includes('?') ? '&' : '?'}v=${new Date(uploadedAt).getTime()}`;
}

export async function saveJson(pathname: string, data: unknown) {
  await put(pathname, JSON.stringify(data), {
    access: 'public',
    contentType: 'application/json',
    addRandomSuffix: false,
    allowOverwrite: true,
    cacheControlMaxAge: 60,
  });
}

export async function listJson<T>(prefix: string): Promise<T[]> {
  const out: T[] = [];
  let cursor: string | undefined;
  do {
    const page = await list({ prefix, cursor, limit: 1000 });
    const items = await Promise.all(
      page.blobs
        .filter((b) => b.pathname.endsWith('.json'))
        .map(async (b) => {
          const res = await fetch(bust(b.url, b.uploadedAt), { cache: 'no-store' });
          return res.ok ? ((await res.json()) as T) : null;
        }),
    );
    for (const item of items) if (item) out.push(item);
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  return out;
}

async function findBlob(pathname: string) {
  const page = await list({ prefix: pathname, limit: 10 });
  return page.blobs.find((b) => b.pathname === pathname) ?? null;
}

export async function readJson<T>(pathname: string): Promise<T | null> {
  const blob = await findBlob(pathname);
  if (!blob) return null;
  const res = await fetch(bust(blob.url, blob.uploadedAt), { cache: 'no-store' });
  return res.ok ? ((await res.json()) as T) : null;
}

export async function deleteJson(pathname: string) {
  const blob = await findBlob(pathname);
  if (blob) await del(blob.url);
}

export async function saveBytes(pathname: string, data: ArrayBuffer | Buffer, contentType: string) {
  const body = Buffer.isBuffer(data) ? data : Buffer.from(data as ArrayBuffer);
  const blob = await put(pathname, body, { access: 'public', contentType, addRandomSuffix: true });
  return blob.url;
}

/** Copy a remote (often short-lived, signed) URL into our own Blob store. */
export async function copyRemote(url: string, pathname: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not download ${url} (${res.status})`);
  const type = res.headers.get('content-type') ?? 'application/octet-stream';
  return saveBytes(pathname, await res.arrayBuffer(), type);
}
