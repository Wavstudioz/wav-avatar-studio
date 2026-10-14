const BASE = 'https://api.empiriolabs.ai/v1';

export const SEEDANCE_MODEL = process.env.SEEDANCE_MODEL || 'seedance-2-5';
const IMAGE_MODEL = process.env.IMAGE_MODEL || 'seedream-5-0-flash';

function apiKey() {
  const key = process.env.EMPIRIOLABS_API_KEY?.trim();
  if (!key) throw new Error('EMPIRIOLABS_API_KEY is not set');
  return key;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function call(path: string, init: RequestInit = {}): Promise<any> {
  const res = await fetch(BASE + path, {
    ...init,
    cache: 'no-store',
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
  const text = await res.text();
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const d = data as any;
    const msg = d?.error?.message ?? d?.message ?? text.slice(0, 300);
    throw new Error(`EmpirioLabs ${res.status}: ${msg}`);
  }
  return data;
}

export async function submitVideo(body: Record<string, unknown>): Promise<{ job_id: string; status: string }> {
  const data = await call('/videos/generations', { method: 'POST', body: JSON.stringify(body) });
  if (!data?.job_id) throw new Error('EmpirioLabs did not return a job id');
  return data;
}

export interface JobState {
  status: 'processing' | 'completed' | 'failed' | 'cancelled';
  progress?: number;
  videoUrl?: string;
  lastFrameUrl?: string;
  draftTaskId?: string;
  error?: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function deepFind(obj: any, key: string, depth = 0): unknown {
  if (!obj || typeof obj !== 'object' || depth > 6) return undefined;
  if (key in obj && obj[key]) return obj[key];
  for (const v of Object.values(obj)) {
    const found = deepFind(v, key, depth + 1);
    if (found) return found;
  }
  return undefined;
}

export async function getJob(jobId: string): Promise<JobState> {
  const job = await call(`/jobs/${encodeURIComponent(jobId)}`);
  const items: { url?: string; type?: string }[] = job?.result?.data ?? [];
  const urls = items.map((i) => i.url).filter((u): u is string => !!u);
  const videoUrl =
    urls.find((u) => /\.(mp4|mov)(\?|$)/i.test(u)) ??
    items.find((i) => i.type?.startsWith('video'))?.url ??
    urls[0];
  const lastFrameUrl =
    urls.find((u) => /\.(png|jpe?g|webp)(\?|$)/i.test(u)) ?? (deepFind(job, 'last_frame_url') as string | undefined);
  return {
    status: job.status,
    progress: typeof job.progress === 'number' ? job.progress : undefined,
    videoUrl,
    lastFrameUrl,
    draftTaskId: deepFind(job, 'draft_task_id') as string | undefined,
    error: job?.error?.message ?? (job.status === 'failed' ? 'Generation failed' : undefined),
  };
}

/** Text (+ optional reference images) to a single portrait. Returns a URL from EmpirioLabs (copy it, it is signed). */
export async function generateImage(prompt: string, refs: string[] = [], aspect = '3:4') {
  const data = await call('/images/generations', {
    method: 'POST',
    body: JSON.stringify({
      model: IMAGE_MODEL,
      prompt,
      aspect_ratio: aspect,
      sync: true,
      ...(refs.length ? { images: refs } : {}),
    }),
  });
  const url: string | undefined = data?.data?.[0]?.url ?? data?.result?.data?.[0]?.url;
  if (!url) throw new Error('The image model returned no image (it may have been blocked by the safety check)');
  return url;
}
