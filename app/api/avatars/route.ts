import { listJson, saveJson } from '@/lib/store';
import { route, need } from '@/lib/http';
import type { Avatar } from '@/lib/types';

export const dynamic = 'force-dynamic';

export const GET = route(async () => {
  const avatars = await listJson<Avatar>('avatars/');
  avatars.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return { avatars };
});

export const POST = route(async (req: Request) => {
  const body = (await req.json()) as Partial<Avatar>;
  const avatar: Avatar = {
    id: crypto.randomUUID(),
    name: need(body.name?.trim(), 'Give the avatar a name'),
    description: body.description?.trim() || undefined,
    imageUrls: need(body.imageUrls?.length ? body.imageUrls : null, 'Add at least one look image'),
    voiceId: body.voiceId || undefined,
    voiceName: body.voiceName || undefined,
    voiceSource: body.voiceId ? (body.voiceSource ?? 'library') : 'none',
    previewAudioUrl: body.previewAudioUrl || undefined,
    createdAt: new Date().toISOString(),
  };
  await saveJson(`avatars/${avatar.id}.json`, avatar);
  return { avatar };
});
