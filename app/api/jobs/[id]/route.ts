import { getJob } from '@/lib/empirio';
import { copyRemote, deleteJson, readJson, saveJson } from '@/lib/store';
import { route } from '@/lib/http';
import type { Job } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

type Ctx = { params: Promise<{ id: string }> };

// Poll: refreshes a processing job from EmpirioLabs and keeps the result in our own storage.
export const GET = route(async (_req: Request, { params }: Ctx) => {
  const { id } = await params;
  const job = await readJson<Job>(`jobs/${id}.json`);
  if (!job) return Response.json({ error: 'Job not found' }, { status: 404 });
  if (job.status !== 'processing') return { job };

  const state = await getJob(job.jobId);
  const next: Job = { ...job, status: state.status, progress: state.progress, error: state.error };

  if (state.status === 'completed') {
    next.completedAt = new Date().toISOString();
    next.draftTaskId = state.draftTaskId;
    // Keep our own copy so links never expire.
    if (state.videoUrl) {
      try {
        next.videoUrl = await copyRemote(state.videoUrl, `renders/${job.id}.mp4`);
      } catch {
        next.videoUrl = state.videoUrl;
      }
    }
    if (state.lastFrameUrl) {
      try {
        next.lastFrameUrl = await copyRemote(state.lastFrameUrl, `renders/${job.id}-last.png`);
      } catch {
        next.lastFrameUrl = state.lastFrameUrl;
      }
    }
  }

  if (next.status !== 'processing' || next.progress !== job.progress) {
    await saveJson(`jobs/${id}.json`, next);
  }
  return { job: next };
});

export const DELETE = route(async (_req: Request, { params }: Ctx) => {
  const { id } = await params;
  await deleteJson(`jobs/${id}.json`);
  return { ok: true };
});
