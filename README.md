# Wav Avatar Studio

Private Higgsfield replacement for the .Wav crew. Build avatars with a generated look and a cloned or designed voice, then direct them in talking shots and scenes rendered by **ByteDance Seedance 2.5**. You pay the APIs per second of video. No subscription, no credits.

## What it does

**Avatars**
- **Look:** generate a fictional character with Seedream 5.0 Flash, then add more angles of the same face ("+ Another angle"). Or upload AI-generated images. The first image is the hero reference.
- **Voice**, four ways:
  - **Clone:** record in the browser or upload samples, and ElevenLabs Instant Voice Clone builds it. A permission checkbox is required.
  - **Generate:** describe a voice in words, audition 3 options, keep one (ElevenLabs Voice Design).
  - **ElevenLabs library:** reuse any voice already in your ElevenLabs account.
  - **No voice:** for B-roll characters.

**Studio**
- **Talking avatar:** pick the speaker (plus anyone else in the scene), write the line, hit **Voice it**. The line is spoken in the avatar's voice. Clip length snaps to the audio automatically. Seedance gets the avatar's look references plus the line as `@Audio1` and lip-syncs to it. You can also upload a pre-recorded line.
- **Scene shot:** text-to-video with your avatars as references, or start from a first frame.
- Camera move presets, 6 aspect ratios, 4 to 30 seconds, and a live cost estimate.
- **Draft first** (on by default): a 480p preview at about $0.21/sec. Then render the exact same shot (same seed, same references) at native 1080p from the Library.

**Library**
- Renders poll automatically and are copied into your own storage so links never expire.
- **Render 1080p** from any draft · **Extend** a clip 4 to 30 seconds · **Next shot from last frame** for continuity · Download.

## Setup (about 15 minutes)

1. **Get API keys**
   - EmpirioLabs (runs Seedance 2.5 and Seedream): https://platform.empiriolabs.ai/dashboard/api-keys. Load prepaid credits.
   - ElevenLabs: https://elevenlabs.io/app/settings/api-keys. **Starter plan or above** is needed for voice cloning.
2. **Deploy to Vercel**
   - Push this folder to a GitHub repo, then import it at vercel.com/new.
   - In the project, open **Storage**, create a **Blob** store with **Public** access, and connect it to the project. Vercel wires up the credentials automatically.
   - Under **Settings > Environment Variables**, add `EMPIRIOLABS_API_KEY`, `ELEVENLABS_API_KEY` and `APP_PASSWORD` (the crew password).
   - Redeploy.
3. Open the site, enter the password (any username), and build your first avatar.

**Run locally instead:** `cp .env.example .env.local`, fill in the keys, and add a `BLOB_READ_WRITE_TOKEN` from the store's settings (or run `vercel env pull`), then `npm install && npm run dev`. You still need the Blob store, because Seedance downloads your references from public URLs.

## Costs (EmpirioLabs list price, Oct 2026)

| Output | per second | 8-second shot |
|---|---|---|
| 480p (drafts) | $0.206 | $1.65 |
| 720p | $0.462 | $3.70 |
| 1080p | $1.137 | $9.10 |

Extending a clip also bills the source clip's seconds, at the lower video-input rate. ElevenLabs text-to-speech uses your plan's character quota. Portraits cost about $0.03 each.

## Know before you shoot

- **No real faces as references.** Seedance rejects uploads that contain real people. Avatars have to be generated characters. You *can* give a generated character a cloned real voice (with permission).
- **Dialogue audio must be 2 to 30 seconds.** For longer monologues, voice it in chunks: shot 1, then Extend or "Next shot from last frame".
- **Lip-sync quality:** Seedance 2.5 is new. If the model ever adds its own voice over yours, switch the talk prompt in `app/api/generate/route.ts` or set `generate_audio: false` for talk shots there and lay the ElevenLabs line in during edit. The line's MP3 is saved for each job.
- Renders take 1 to 15 minutes. Close the tab whenever; the Library resumes polling when you come back.

## Where things live

```
app/api/generate     builds the Seedance request (talk / shot / extend / final 1080p)
app/api/jobs/[id]    polls EmpirioLabs, copies finished video + last frame to Blob
app/api/voices/*     ElevenLabs clone, design, save, library
app/api/tts          speaks a line in an avatar's voice
app/api/portrait     generates avatar looks (Seedream 5.0 Flash)
app/components/*     Avatars, Studio, Library screens
lib/empirio.ts       EmpirioLabs client  (swap SEEDANCE_MODEL to try seedance-2-0-pro for 4K)
lib/eleven.ts        ElevenLabs client
middleware.ts        crew password lock
```
