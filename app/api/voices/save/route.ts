import { saveDesignedVoice } from '@/lib/eleven';
import { saveBytes } from '@/lib/store';
import { route, need } from '@/lib/http';

export const maxDuration = 60;

export const POST = route(async (req: Request) => {
  const { name, description, generatedVoiceId, previewBase64, mediaType } = (await req.json()) as {
    name?: string;
    description?: string;
    generatedVoiceId?: string;
    previewBase64?: string;
    mediaType?: string;
  };
  const voiceName = need(name?.trim(), 'Name the voice');
  const voiceId = await saveDesignedVoice(
    voiceName,
    need(description?.trim(), 'Missing voice description'),
    need(generatedVoiceId, 'Pick a preview first'),
  );
  let previewUrl: string | undefined;
  if (previewBase64) {
    previewUrl = await saveBytes('voices/preview.mp3', Buffer.from(previewBase64, 'base64'), mediaType ?? 'audio/mpeg');
  }
  return { voiceId, voiceName, previewUrl };
});
