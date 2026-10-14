import { submitVideo, SEEDANCE_MODEL } from '@/lib/empirio';
import { readJson, saveJson } from '@/lib/store';
import { route, need } from '@/lib/http';
import { PORTRAIT_MODEL, PORTRAIT_RATES, RATES, type Avatar, type Engine, type Job, type JobKind } from '@/lib/types';

export const maxDuration = 60;

interface GenerateBody {
  kind: JobKind;
  // talk + shot
  avatarIds?: string[];
  speakerId?: string;
  dialogue?: string;
  audioUrl?: string;
  scene?: string;
  camera?: string;
  duration?: number;
  resolution?: '480p' | '720p' | '1080p';
  aspect?: string;
  draft?: boolean;
  ambient?: boolean;
  firstFrameUrl?: string;
  /** talk only: 'portrait' animates the avatar's real photo with Pixverse Avatar */
  engine?: Engine;
  /** seconds of dialogue audio, for the portrait cost estimate */
  audioSeconds?: number;
  // extend + final
  parentId?: string;
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const MAX_IMAGES_PER_AVATAR = 4;

export const POST = route(async (req: Request) => {
  const body = (await req.json()) as GenerateBody;
  const now = new Date().toISOString();

  let request: Record<string, unknown>;
  let job: Omit<Job, 'jobId' | 'status'>;

  if (body.kind === 'final' || body.kind === 'extend') {
    const parent = await readJson<Job>(`jobs/${need(body.parentId, 'Missing source clip')}.json`);
    if (!parent) throw new Error('Source clip not found');

    if (body.kind === 'final' && parent.params.engine === 'portrait') {
      // Portrait clips have no draft id: re-render the same photo + audio at 1080p.
      request = {
        model: PORTRAIT_MODEL,
        image: need(parent.params.image, 'Missing portrait for this clip'),
        audio: need(parent.audioUrl, 'Missing audio for this clip'),
        resolution: '1080p',
        ...(parent.prompt ? { prompt: parent.prompt } : {}),
      };
      job = {
        id: crypto.randomUUID(),
        kind: 'final',
        title: `${parent.title} · 1080p final`,
        avatarIds: parent.avatarIds,
        prompt: parent.prompt,
        dialogue: parent.dialogue,
        audioUrl: parent.audioUrl,
        params: { engine: 'portrait', image: parent.params.image, resolution: '1080p', duration: parent.params.duration },
        parentId: parent.id,
        estimatedCost: (parent.params.duration ?? 5) * PORTRAIT_RATES['1080p'],
        createdAt: now,
      };
    } else if (body.kind === 'final') {
      const draftTaskId = need(parent.draftTaskId, 'That clip is not a draft (no draft id came back)');
      request = { model: SEEDANCE_MODEL, draft_task_id: draftTaskId, return_last_frame: true };
      job = {
        id: crypto.randomUUID(),
        kind: 'final',
        title: `${parent.title} · 1080p final`,
        avatarIds: parent.avatarIds,
        prompt: parent.prompt,
        dialogue: parent.dialogue,
        params: { resolution: '1080p', duration: parent.params.duration },
        parentId: parent.id,
        estimatedCost: (parent.params.duration ?? 5) * RATES['1080p'],
        createdAt: now,
      };
    } else {
      const duration = clamp(Math.round(body.duration ?? 6), 4, 30);
      const prompt = body.scene?.trim() || 'Continue the shot naturally.';
      const resolution = (parent.params.resolution as string) ?? '720p';
      request = {
        model: SEEDANCE_MODEL,
        prompt,
        duration,
        extend_from: { job_id: parent.jobId },
        return_last_frame: true,
      };
      job = {
        id: crypto.randomUUID(),
        kind: 'extend',
        title: `${parent.title} · extended`,
        avatarIds: parent.avatarIds,
        prompt,
        params: { resolution, duration },
        parentId: parent.id,
        estimatedCost: duration * (RATES[resolution] ?? RATES['720p']),
        createdAt: now,
      };
    }
  } else if (body.kind === 'talk' && body.engine === 'portrait') {
    // Real-person talking portrait: Pixverse Avatar lip-syncs one photo to the line.
    const avatars = (
      await Promise.all((body.avatarIds ?? []).map((id) => readJson<Avatar>(`avatars/${id}.json`)))
    ).filter((a): a is Avatar => !!a);
    const speaker = need(avatars.find((a) => a.id === body.speakerId) ?? avatars[0], 'Pick who is talking');
    const image = speaker.imageUrls[0];
    const audioUrl = need(body.audioUrl, 'Voice the dialogue (or upload a line) first');
    const resolution = body.draft ? '540p' : (body.resolution ?? '720p');
    const duration = Math.max(1, Math.round(body.audioSeconds ?? body.duration ?? 6));
    const prompt = [body.scene?.trim(), 'Natural head movement and facial expression, precise lip sync.']
      .filter(Boolean)
      .join(' ');

    request = { model: PORTRAIT_MODEL, image, audio: audioUrl, resolution, prompt };
    job = {
      id: crypto.randomUUID(),
      kind: 'talk',
      title: `${speaker.name}: “${(body.dialogue ?? 'line').slice(0, 48)}${(body.dialogue?.length ?? 0) > 48 ? '…' : ''}”`,
      avatarIds: [speaker.id],
      prompt,
      dialogue: body.dialogue,
      audioUrl,
      params: { engine: 'portrait', image, resolution, duration, draft: !!body.draft },
      estimatedCost: duration * PORTRAIT_RATES[resolution],
      createdAt: now,
    };
  } else {
    const avatars = (
      await Promise.all((body.avatarIds ?? []).map((id) => readJson<Avatar>(`avatars/${id}.json`)))
    ).filter((a): a is Avatar => !!a);

    const images: string[] = [];
    const castLines: string[] = [];
    for (const a of avatars) {
      const refs = a.imageUrls.slice(0, MAX_IMAGES_PER_AVATAR);
      const tags = refs.map((url) => {
        images.push(url);
        return `@Image${images.length}`;
      });
      castLines.push(`${a.name} is the character shown in ${tags.join(', ')}${a.description ? ` (${a.description})` : ''}.`);
    }

    const parts: string[] = [];
    if (castLines.length) parts.push(castLines.join(' '));

    const audios: string[] = [];
    if (body.kind === 'talk') {
      const speaker = avatars.find((a) => a.id === body.speakerId) ?? avatars[0];
      need(speaker, 'Pick who is talking');
      audios.push(need(body.audioUrl, 'Voice the dialogue (or upload a line) first'));
      parts.push(
        `${speaker!.name} speaks directly in the voice, words and timing of @Audio1, with precise lip sync and natural facial expression. No other dialogue.`,
      );
    }
    if (body.scene?.trim()) parts.push(body.scene.trim());
    if (body.camera && body.camera !== 'None') parts.push(`Camera: ${body.camera}.`);

    const prompt = need(parts.join(' ').trim(), 'Describe the scene');
    const resolution = body.draft ? '480p' : (body.resolution ?? '720p');
    const duration = clamp(Math.round(body.duration ?? 6), 4, 30);
    const usingFirstFrame = body.kind === 'shot' && !!body.firstFrameUrl && images.length === 0;

    request = {
      model: SEEDANCE_MODEL,
      prompt,
      duration,
      resolution: body.resolution ?? '720p',
      aspect_ratio: usingFirstFrame ? 'adaptive' : (body.aspect ?? '16:9'),
      generate_audio: body.kind === 'talk' ? true : body.ambient !== false,
      draft: !!body.draft,
      return_last_frame: true,
      negative_prompt: 'distorted face, extra fingers, warped mouth, flicker, text artifacts',
      ...(usingFirstFrame
        ? { mode: 'i2v_first', image: body.firstFrameUrl }
        : images.length || audios.length
          ? { mode: 'reference', ...(images.length ? { images } : {}), ...(audios.length ? { audios } : {}) }
          : { mode: 't2v' }),
    };

    const title =
      body.kind === 'talk'
        ? `${avatars.find((a) => a.id === body.speakerId)?.name ?? avatars[0]?.name}: “${(body.dialogue ?? 'line').slice(0, 48)}${(body.dialogue?.length ?? 0) > 48 ? '…' : ''}”`
        : (body.scene?.trim().slice(0, 60) ?? 'Shot');

    job = {
      id: crypto.randomUUID(),
      kind: body.kind,
      title,
      avatarIds: avatars.map((a) => a.id),
      prompt,
      dialogue: body.dialogue,
      audioUrl: body.audioUrl,
      params: { engine: 'seedance', resolution, aspect_ratio: request.aspect_ratio as string, duration, draft: !!body.draft },
      estimatedCost: duration * RATES[resolution],
      createdAt: now,
    };
  }

  const submitted = await submitVideo(request);
  const record: Job = { ...job, jobId: submitted.job_id, status: 'processing' };
  await saveJson(`jobs/${record.id}.json`, record);
  return { job: record };
});
