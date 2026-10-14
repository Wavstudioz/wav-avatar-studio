const EL = 'https://api.elevenlabs.io/v1';

function apiKey() {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) throw new Error('ELEVENLABS_API_KEY is not set');
  return key;
}

async function check(res: Response) {
  if (res.ok) return;
  const text = await res.text();
  let msg = text.slice(0, 300);
  try {
    const d = JSON.parse(text);
    msg = d?.detail?.message ?? (typeof d?.detail === 'string' ? d.detail : msg);
  } catch {
    // keep raw text
  }
  throw new Error(`ElevenLabs ${res.status}: ${msg}`);
}

export interface SampleFile {
  data: ArrayBuffer;
  filename: string;
  type: string;
}

/** Instant Voice Clone from one or more samples. Returns the new voice_id. */
export async function cloneVoice(name: string, samples: SampleFile[], description?: string) {
  const fd = new FormData();
  fd.append('name', name);
  if (description) fd.append('description', description);
  fd.append('remove_background_noise', 'true');
  for (const s of samples) fd.append('files', new Blob([s.data], { type: s.type }), s.filename);
  const res = await fetch(`${EL}/voices/add`, { method: 'POST', headers: { 'xi-api-key': apiKey() }, body: fd });
  await check(res);
  const data = await res.json();
  return data.voice_id as string;
}

export interface VoicePreview {
  generatedVoiceId: string;
  audioBase64: string;
  mediaType: string;
}

/** Voice Design: describe a voice in words, get previews back. */
export async function designVoice(description: string): Promise<VoicePreview[]> {
  const res = await fetch(`${EL}/text-to-voice/design`, {
    method: 'POST',
    headers: { 'xi-api-key': apiKey(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ voice_description: description, auto_generate_text: true }),
  });
  await check(res);
  const data = await res.json();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data.previews ?? []).map((p: any) => ({
    generatedVoiceId: p.generated_voice_id,
    audioBase64: p.audio_base_64,
    mediaType: p.media_type ?? 'audio/mpeg',
  }));
}

/** Turn a design preview into a permanent voice. */
export async function saveDesignedVoice(name: string, description: string, generatedVoiceId: string) {
  const res = await fetch(`${EL}/text-to-voice`, {
    method: 'POST',
    headers: { 'xi-api-key': apiKey(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ voice_name: name, voice_description: description, generated_voice_id: generatedVoiceId }),
  });
  await check(res);
  const data = await res.json();
  return data.voice_id as string;
}

export async function listVoices(): Promise<{ voiceId: string; name: string; category?: string; previewUrl?: string }[]> {
  const res = await fetch(`${EL}/voices`, { headers: { 'xi-api-key': apiKey() }, cache: 'no-store' });
  await check(res);
  const data = await res.json();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data.voices ?? []).map((v: any) => ({
    voiceId: v.voice_id,
    name: v.name,
    category: v.category,
    previewUrl: v.preview_url,
  }));
}

/** Text to speech. Returns MP3 bytes. */
export async function speak(voiceId: string, text: string) {
  const res = await fetch(`${EL}/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`, {
    method: 'POST',
    headers: { 'xi-api-key': apiKey(), 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
    body: JSON.stringify({ text, model_id: process.env.ELEVEN_TTS_MODEL || 'eleven_v3' }),
  });
  await check(res);
  return res.arrayBuffer();
}
