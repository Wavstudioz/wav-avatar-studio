import { speak } from '@/lib/eleven';
import { saveBytes } from '@/lib/store';
import { route, need } from '@/lib/http';

export const maxDuration = 120;

export const POST = route(async (req: Request) => {
  const { voiceId, text } = (await req.json()) as { voiceId?: string; text?: string };
  const audio = await speak(need(voiceId, 'This avatar has no voice'), need(text?.trim(), 'Write the dialogue first'));
  const url = await saveBytes('dialogue/line.mp3', audio, 'audio/mpeg');
  return { url };
});
