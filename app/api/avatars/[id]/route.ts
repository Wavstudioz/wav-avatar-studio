import { deleteJson, readJson, saveJson } from '@/lib/store';
import { route } from '@/lib/http';
import type { Avatar } from '@/lib/types';

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = route(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  const existing = await readJson<Avatar>(`avatars/${id}.json`);
  if (!existing) return Response.json({ error: 'Avatar not found' }, { status: 404 });
  const patch = (await req.json()) as Partial<Avatar>;
  const avatar: Avatar = { ...existing, ...patch, id: existing.id, createdAt: existing.createdAt };
  await saveJson(`avatars/${id}.json`, avatar);
  return { avatar };
});

export const DELETE = route(async (_req: Request, { params }: Ctx) => {
  const { id } = await params;
  await deleteJson(`avatars/${id}.json`);
  return { ok: true };
});
