import { generateImage } from '@/lib/empirio';
import { copyRemote } from '@/lib/store';
import { route, need } from '@/lib/http';

export const maxDuration = 120;

// Generate an avatar look. Pass refs to make another angle / outfit of the same character.
export const POST = route(async (req: Request) => {
  const { prompt, refs, aspect } = (await req.json()) as { prompt?: string; refs?: string[]; aspect?: string };
  const text = need(prompt?.trim(), 'Describe the look');
  const full = refs?.length
    ? `Same character as the reference image, identical face and identity. ${text}. Photorealistic, cinematic lighting, sharp focus on the face.`
    : `${text}. Photorealistic portrait of a fictional person, cinematic lighting, sharp focus on the face, plain background.`;
  const remote = await generateImage(full, refs ?? [], aspect ?? '3:4');
  const url = await copyRemote(remote, 'portraits/portrait.png');
  return { url };
});
