import { cloneVoice, speak } from '@/lib/eleven';
import { saveBytes } from '@/lib/store';
import { route, need } from '@/lib/http';

export const maxDuration = 120;

export const POST = route(async (req: Request) => {
  const { name, sampleUrls, consent } = (await req.json()) as {
    name?: string;
    sampleUrls?: string[];
    consent?: boolean;
  };
  if (!consent) throw new Error('Confirm you have permission to clone this voice');
  const voiceName = need(name?.trim(), 'Name the voice');
  const urls = need(sampleUrls?.length ? sampleUrls : null, 'Add at least one voice sample');

  const samples = await Promise.all(
    urls.map(async (url, i) => {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Could not read sample ${i + 1}`);
      const type = res.headers.get('content-type') ?? 'audio/mpeg';
      const ext = type.split('/')[1]?.split(';')[0] ?? 'mp3';
      return { data: await res.arrayBuffer(), filename: `sample-${i + 1}.${ext}`, type };
    }),
  );

  const voiceId = await cloneVoice(voiceName, samples, 'Cloned in Wav Avatar Studio');
  const preview = await speak(voiceId, `Hey, this is ${voiceName}. Ready when you are.`);
  const previewUrl = await saveBytes('voices/preview.mp3', preview, 'audio/mpeg');
  return { voiceId, voiceName, previewUrl };
});
