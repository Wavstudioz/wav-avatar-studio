import { listJson } from '@/lib/store';
import { route } from '@/lib/http';
import type { Job } from '@/lib/types';

export const dynamic = 'force-dynamic';

export const GET = route(async () => {
  const jobs = await listJson<Job>('jobs/');
  jobs.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return { jobs };
});
