'use client';

import { useEffect, useMemo, useState } from 'react';
import { api, audioDuration, money, uploadFile } from '@/lib/client';
import { CAMERA_MOVES, RATES, type Avatar, type Job } from '@/lib/types';

type Mode = 'talk' | 'shot';
type Res = '480p' | '720p' | '1080p';

const ASPECTS = ['16:9', '9:16', '1:1', '4:3', '3:4', '21:9'];

export default function StudioPanel({
  avatars,
  onQueued,
  firstFrame,
  clearFirstFrame,
  goToAvatars,
}: {
  avatars: Avatar[];
  onQueued: (job: Job) => void;
  firstFrame?: string;
  clearFirstFrame: () => void;
  goToAvatars: () => void;
}) {
  const [mode, setMode] = useState<Mode>('talk');
  const [cast, setCast] = useState<string[]>([]);
  const [speakerId, setSpeakerId] = useState<string | null>(null);

  const [dialogue, setDialogue] = useState('');
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioLen, setAudioLen] = useState<number | null>(null);

  const [scene, setScene] = useState('');
  const [camera, setCamera] = useState<string>('Slow push in');
  const [aspect, setAspect] = useState('16:9');
  const [resolution, setResolution] = useState<Res>('720p');
  const [duration, setDuration] = useState(8);
  const [draft, setDraft] = useState(true);
  const [ambient, setAmbient] = useState(true);
  const [frameUrl, setFrameUrl] = useState<string | undefined>(firstFrame);

  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (firstFrame) {
      setFrameUrl(firstFrame);
      setMode('shot');
      setCast([]);
    }
  }, [firstFrame]);

  const speaker = useMemo(
    () => avatars.find((a) => a.id === speakerId) ?? avatars.find((a) => a.id === cast[0]),
    [avatars, speakerId, cast],
  );

  const toggleCast = (id: string) => {
    setCast((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));
    if (mode === 'talk') setSpeakerId(id);
    setAudioUrl(null);
  };

  const run = async (label: string, fn: () => Promise<void>) => {
    setBusy(label);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const acceptAudio = async (url: string) => {
    const len = await audioDuration(url);
    setAudioUrl(url);
    setAudioLen(len);
    setDuration(Math.min(30, Math.max(4, Math.ceil(len + 1))));
  };

  const voiceIt = () =>
    run('voice', async () => {
      const { url } = await api<{ url: string }>('/api/tts', { voiceId: speaker?.voiceId, text: dialogue });
      await acceptAudio(url);
    });

  const uploadLine = (file?: File) =>
    file &&
    run('voice', async () => {
      await acceptAudio(await uploadFile(file, file.name));
    });

  const generate = () =>
    run('generate', async () => {
      const castIds = mode === 'talk' && speaker && !cast.includes(speaker.id) ? [speaker.id, ...cast] : cast;
      const { job } = await api<{ job: Job }>('/api/generate', {
        kind: mode,
        avatarIds: frameUrl && mode === 'shot' ? [] : castIds,
        speakerId: speaker?.id,
        dialogue: mode === 'talk' ? dialogue : undefined,
        audioUrl: mode === 'talk' ? audioUrl : undefined,
        scene,
        camera,
        aspect,
        resolution,
        duration,
        draft,
        ambient,
        firstFrameUrl: mode === 'shot' ? frameUrl : undefined,
      });
      onQueued(job);
    });

  const effectiveRes: Res = draft ? '480p' : resolution;
  const cost = duration * RATES[effectiveRes];
  const audioTooShort = audioLen !== null && audioLen < 2;
  const audioTooLong = audioLen !== null && audioLen > 30;

  const canGenerate =
    !busy &&
    (mode === 'talk'
      ? !!speaker && !!audioUrl && !audioTooShort && !audioTooLong
      : !!scene.trim() || cast.length > 0 || !!frameUrl);

  if (avatars.length === 0 && mode === 'talk') {
    return (
      <div className="empty">
        Talking shots need an avatar with a voice.
        <br />
        <button className="btn primary" style={{ marginTop: 14 }} onClick={goToAvatars}>
          Create an avatar
        </button>{' '}
        <button className="btn" style={{ marginTop: 14 }} onClick={() => setMode('shot')}>
          Make a scene shot instead
        </button>
      </div>
    );
  }

  return (
    <div className="grid2">
      <section className="card">
        <div className="row tight" style={{ justifyContent: 'space-between' }}>
          <div className="seg">
            <button className={mode === 'talk' ? 'on' : ''} onClick={() => setMode('talk')}>
              Talking avatar
            </button>
            <button className={mode === 'shot' ? 'on' : ''} onClick={() => setMode('shot')}>
              Scene shot
            </button>
          </div>
        </div>

        {mode === 'shot' && frameUrl ? (
          <>
            <h3>First frame</h3>
            <div className="thumbs">
              <div className="thumb" style={{ width: 160, height: 90 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={frameUrl} alt="" />
                <button
                  className="x"
                  onClick={() => {
                    setFrameUrl(undefined);
                    clearFirstFrame();
                  }}
                >
                  ×
                </button>
              </div>
            </div>
            <p className="hint">Continuing from this frame. Avatars are ignored while a first frame is set.</p>
          </>
        ) : (
          <>
            <h3>{mode === 'talk' ? 'Who’s talking (tap to pick, others join the scene)' : 'Cast (optional)'}</h3>
            {avatars.length === 0 ? (
              <p className="hint">No avatars yet — this will be a pure text-to-video shot.</p>
            ) : (
              <div className="pick">
                {avatars.map((a) => (
                  <button
                    key={a.id}
                    className={`${cast.includes(a.id) ? 'on' : ''} ${mode === 'talk' && speaker?.id === a.id ? 'speaker' : ''}`}
                    onClick={() => toggleCast(a.id)}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={a.imageUrls[0]} alt="" />
                    <span>
                      {a.name}
                      {mode === 'talk' && speaker?.id === a.id ? ' 🎙' : ''}
                    </span>
                  </button>
                ))}
              </div>
            )}
            {mode === 'shot' && (
              <label className="f">
                <span>Or start from a first frame</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) =>
                    e.target.files?.[0] &&
                    run('frame', async () => setFrameUrl(await uploadFile(e.target.files![0], e.target.files![0].name)))
                  }
                />
              </label>
            )}
          </>
        )}

        {mode === 'talk' && (
          <>
            <h3>Dialogue</h3>
            <textarea
              value={dialogue}
              onChange={(e) => {
                setDialogue(e.target.value);
                setAudioUrl(null);
                setAudioLen(null);
              }}
              placeholder="You don't hire a crew like this for a thirty-second spot. You hire us because the thirty seconds matter."
            />
            <div className="row tight" style={{ marginTop: 10 }}>
              <button
                className="btn"
                disabled={!speaker?.voiceId || !dialogue.trim() || !!busy}
                onClick={voiceIt}
                title={speaker && !speaker.voiceId ? `${speaker.name} has no voice — upload a line instead` : ''}
              >
                {busy === 'voice' ? 'Voicing…' : audioUrl ? 'Re-voice' : `Voice it${speaker ? ` as ${speaker.name}` : ''}`}
              </button>
              <label className="btn ghost">
                Upload a line
                <input type="file" accept="audio/*" hidden onChange={(e) => uploadLine(e.target.files?.[0])} />
              </label>
            </div>
            {audioUrl && (
              <div style={{ marginTop: 10 }}>
                <audio controls src={audioUrl} />
                <p className="hint">
                  {audioLen?.toFixed(1)}s of dialogue · clip length set to {duration}s
                </p>
              </div>
            )}
            {audioTooShort && <p className="warn">Seedance needs at least 2 seconds of audio. Add a few words.</p>}
            {audioTooLong && <p className="warn">Over 30 seconds. Split the line into two shots and extend.</p>}
          </>
        )}

        <h3>Scene</h3>
        <textarea
          value={scene}
          onChange={(e) => setScene(e.target.value)}
          placeholder={
            mode === 'talk'
              ? 'Medium close-up in a dim edit bay, monitors glowing behind her, shallow depth of field, 35mm film look'
              : 'Rain-slick Newark street at night, neon reflections, she walks toward camera and stops under a streetlight'
          }
        />

        {error && <div className="err">{error}</div>}
      </section>

      <section className="card">
        <h2>Shot settings</h2>

        <label className="f">
          <span>Camera move</span>
          <select value={camera} onChange={(e) => setCamera(e.target.value)}>
            {CAMERA_MOVES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>

        <label className="f">
          <span>Aspect ratio {mode === 'shot' && frameUrl ? '(follows the first frame)' : ''}</span>
          <div className="seg">
            {ASPECTS.map((a) => (
              <button key={a} className={aspect === a ? 'on' : ''} onClick={() => setAspect(a)} disabled={mode === 'shot' && !!frameUrl}>
                {a}
              </button>
            ))}
          </div>
        </label>

        <label className="f">
          <span>Length · {duration}s</span>
          <input type="range" min={4} max={30} value={duration} onChange={(e) => setDuration(+e.target.value)} />
        </label>

        <label className="check">
          <input type="checkbox" checked={draft} onChange={(e) => setDraft(e.target.checked)} />
          <span>
            <b style={{ color: 'var(--text)' }}>Draft first (recommended)</b> — 480p preview at the cheap rate. If you like it,
            render the exact same shot at 1080p from the Library.
          </span>
        </label>

        {!draft && (
          <label className="f">
            <span>Resolution</span>
            <div className="seg">
              {(['480p', '720p', '1080p'] as Res[]).map((r) => (
                <button key={r} className={resolution === r ? 'on' : ''} onClick={() => setResolution(r)}>
                  {r}
                </button>
              ))}
            </div>
          </label>
        )}

        {mode === 'shot' && (
          <label className="check">
            <input type="checkbox" checked={ambient} onChange={(e) => setAmbient(e.target.checked)} />
            Generate sound (ambience, effects, music)
          </label>
        )}

        <div className="cost">
          <span>
            Estimated · {duration}s at {effectiveRes}
          </span>
          <b>{money(cost)}</b>
        </div>

        <button className="btn primary big" disabled={!canGenerate} onClick={generate}>
          {busy === 'generate' ? 'Sending to Seedance…' : draft ? 'Generate draft' : 'Generate'}
        </button>
        <p className="hint" style={{ textAlign: 'center', marginTop: 10 }}>
          Renders take 1 to 15 minutes. You can leave this page; the Library picks them up.
        </p>
      </section>
    </div>
  );
}
