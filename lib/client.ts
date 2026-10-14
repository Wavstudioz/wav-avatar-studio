'use client';

export async function api<T>(path: string, body?: unknown, method?: string): Promise<T> {
  const res = await fetch(path, {
    method: method ?? (body === undefined ? 'GET' : 'POST'),
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: 'no-store',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? `Request failed (${res.status})`);
  return data as T;
}

export async function uploadFile(file: Blob, name: string): Promise<string> {
  const { uploadPresigned } = await import('@vercel/blob/client');
  const safe = name.replace(/[^\w.-]+/g, '_');
  const blob = await uploadPresigned(`uploads/${safe}`, file, {
    access: 'public',
    handleUploadUrl: '/api/upload',
    contentType: file.type || undefined,
  });
  return blob.url;
}

export function audioDuration(url: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const a = new Audio();
    a.preload = 'metadata';
    a.onloadedmetadata = () => {
      if (Number.isFinite(a.duration)) return resolve(a.duration);
      // Some recordings report Infinity until seeked.
      a.currentTime = 1e7;
      a.ontimeupdate = () => {
        a.ontimeupdate = null;
        resolve(a.duration);
      };
    };
    a.onerror = () => reject(new Error('Could not read audio length'));
    a.src = url;
  });
}

export const money = (n: number) => `$${n.toFixed(2)}`;
