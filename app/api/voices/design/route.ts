import { designVoice } from '@/lib/eleven';
import { route, need } from '@/lib/http';

export const maxDuration = 120;

export const POST = route(async (req: Request) => {
  const { description } = (await req.json()) as { description?: string };
  const text = need(description?.trim(), 'Describe the voice');
  if (text.length < 20) throw new Error('Describe the voice in a bit more detail (20+ characters)');
  const previews = await designVoice(text);
  return { previews };
});
