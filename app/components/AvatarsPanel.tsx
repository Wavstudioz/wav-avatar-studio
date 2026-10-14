'use client';

import { useState } from 'react';
import { api, uploadFile } from '@/lib/client';
import type { Avatar, VoiceSource } from '@/lib/types';
import Recorder from './Recorder';

interface VoiceResult {
  voiceId: string;
  voiceName: string;
  previewUrl?: string;
  source: VoiceSource;
}
interface Preview {
  generatedVoiceId: string;
  audioBase64: string;
  mediaType: string;
}
interface LibraryVoice {
  voiceId: string;
  name: string;
  category?: string;
  previewUrl?: string;
}

export default function AvatarsPanel({ avatars, reload }: { avatars: Avatar[]; reload: () => Promise<void> }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // identity
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  // look
  const [lookTab, setLookTab] = useState<'generate' | 'upload'>('generate');
  const [lookPrompt, setLookPrompt] = useState('');
  const [anglePrompt, setAnglePrompt] = useState('three-quarter profile, same outfit');
  const [images, setImages] = useState<string[]>([]);

  // voice
  const [voiceTab, setVoiceTab] = useState<VoiceSource>('clone');
  const [samples, setSamples] = useState<{ name: string; url: string }[]>([]);
  const [consent, setConsent] = useState(false);
  const [designDesc, setDesignDesc] = useState('');
  const [previews, setPreviews] = useState<Preview[]>([]);
  const [picked, setPicked] = useState<number | null>(null);
  const [library, setLibrary] = useState<LibraryVoice[] | null>(null);
  const [voice, setVoice] = useState<VoiceResult | null>(null);

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

  const reset = () => {
    setName('');
    setDescription('');
    setLookPrompt('');
    setImages([]);
    setSamples([]);
    setConsent(false);
    setDesignDesc('');
    setPreviews([]);
    setPicked(null);
    setVoice(null);
  };

  const generateLook = (fromRefs: boolean) =>
    run(fromRefs ? 'angle' : 'look', async () => {
      const prompt = fromRefs ? anglePrompt : lookPrompt;
      const { url } = await api<{ url: string }>('/api/portrait', {
        prompt,
        refs: fromRefs ? images.slice(0, 3) : undefined,
      });
      setImages((i) => (fromRefs ? [...i, url] : [url, ...i]));
    });

  const uploadImages = (files: FileList | null) =>
    files &&
    run('upload', async () => {
      const urls = await Promise.all([...files].map((f) => uploadFile(f, f.name)));
      setImages((i) => [...i, ...urls]);
    });

  const addSample = (blob: Blob, label: string) =>
    run('sample', async () => {
      const url = await uploadFile(blob, label);
      setSamples((s) => [...s, { name: label, url }]);
    });

  const cloneIt = () =>
    run('clone', async () => {
      const r = await api<{ voiceId: string; voiceName: string; previewUrl: string }>('/api/voices/clone', {
        name: name || 'Untitled voice',
        sampleUrls: samples.map((s) => s.url),
        consent,
      });
      setVoice({ ...r, source: 'clone' });
    });

  const designIt = () =>
    run('design', async () => {
      const { previews } = await api<{ previews: Preview[] }>('/api/voices/design', { description: designDesc });
      setPreviews(previews);
      setPicked(previews.length ? 0 : null);
    });

  const keepDesigned = () =>
    run('keep', async () => {
      const p = previews[picked!];
      const r = await api<{ voiceId: string; voiceName: string; previewUrl?: string }>('/api/voices/save', {
        name: name || 'Designed voice',
        description: designDesc,
        generatedVoiceId: p.generatedVoiceId,
        previewBase64: p.audioBase64,
        mediaType: p.mediaType,
      });
      setVoice({ ...r, source: 'design' });
    });

  const loadLibrary = () =>
    run('library', async () => {
      const { voices } = await api<{ voices: LibraryVoice[] }>('/api/voices/library');
      setLibrary(voices);
    });

  const save = () =>
    run('save', async () => {
      await api('/api/avatars', {
        name,
        description,
        imageUrls: images,
        voiceId: voice?.voiceId,
        voiceName: voice?.voiceName,
        voiceSource: voice?.source ?? 'none',
        previewAudioUrl: voice?.previewUrl,
      });
      reset();
      await reload();
    });

  const remove = (a: Avatar) =>
    confirm(`Delete ${a.name}? Their ElevenLabs voice stays in your ElevenLabs account.`) &&
    run('delete', async () => {
      await api(`/api/avatars/${a.id}`, undefined, 'DELETE');
      await reload();
    });

  return (
    <div className="grid2">
      <section className="card">
        <h2>New avatar</h2>
        <p className="hint">A look (face + wardrobe) and a voice. Both are reused in every shot.</p>

        <div className="row">
          <label className="f">
            <span>Name</span>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Detective Rae" />
          </label>
          <label className="f">
            <span>Character note (goes into prompts)</span>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="40s, calm, trench coat"
            />
          </label>
        </div>

        <h3>Look</h3>
        <div className="seg">
          <button className={lookTab === 'generate' ? 'on' : ''} onClick={() => setLookTab('generate')}>
            Generate
          </button>
          <button className={lookTab === 'upload' ? 'on' : ''} onClick={() => setLookTab('upload')}>
            Upload
          </button>
        </div>

        {lookTab === 'generate' ? (
          <>
            <label className="f">
              <span>Describe the character</span>
              <textarea
                value={lookPrompt}
                onChange={(e) => setLookPrompt(e.target.value)}
                placeholder="Black woman in her 40s, short grey locs, olive trench coat, warm practical light, Newark street at dusk"
              />
            </label>
            <div className="row tight" style={{ marginTop: 10 }}>
              <button className="btn" disabled={!lookPrompt.trim() || !!busy} onClick={() => generateLook(false)}>
                {busy === 'look' ? 'Generating…' : images.length ? 'New take' : 'Generate look'}
              </button>
            </div>
            {images.length > 0 && (
              <div className="row" style={{ marginTop: 10 }}>
                <input type="text" value={anglePrompt} onChange={(e) => setAnglePrompt(e.target.value)} />
                <button
                  className="btn"
                  style={{ flex: '0 0 auto' }}
                  disabled={!!busy}
                  onClick={() => generateLook(true)}
                >
                  {busy === 'angle' ? 'Generating…' : '+ Another angle'}
                </button>
              </div>
            )}
          </>
        ) : (
          <>
            <label className="f">
              <span>AI-generated character images (PNG/JPG/WebP)</span>
              <input type="file" accept="image/*" multiple onChange={(e) => uploadImages(e.target.files)} />
            </label>
            <p className="warn">Seedance rejects photos of real people. Use generated characters only.</p>
          </>
        )}

        {images.length > 0 && (
          <div className="thumbs">
            {images.map((url, i) => (
              <div className="thumb" key={url}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" />
                {i === 0 && <span className="hero">HERO</span>}
                <button className="x" onClick={() => setImages((im) => im.filter((u) => u !== url))}>
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        <h3>Voice</h3>
        <div className="seg">
          {(['clone', 'design', 'library', 'none'] as VoiceSource[]).map((v) => (
            <button
              key={v}
              className={voiceTab === v ? 'on' : ''}
              onClick={() => {
                setVoiceTab(v);
                if (v === 'library' && !library) loadLibrary();
              }}
            >
              {{ clone: 'Clone', design: 'Generate', library: 'ElevenLabs library', none: 'No voice' }[v]}
            </button>
          ))}
        </div>

        {voiceTab === 'clone' && (
          <>
            <p className="hint">
              One to three clean samples, 30 to 120 seconds total, one speaker, no music. Record here or upload files.
            </p>
            <div className="row tight" style={{ marginTop: 10 }}>
              <Recorder disabled={!!busy} onDone={(b) => addSample(b, `take-${samples.length + 1}.webm`)} />
              <label className="btn">
                Upload audio
                <input
                  type="file"
                  accept="audio/*"
                  multiple
                  hidden
                  onChange={(e) => [...(e.target.files ?? [])].forEach((f) => addSample(f, f.name))}
                />
              </label>
            </div>
            {samples.map((s) => (
              <div key={s.url} className="row" style={{ marginTop: 8 }}>
                <audio controls src={s.url} />
                <button
                  className="btn small danger"
                  style={{ flex: '0 0 auto' }}
                  onClick={() => setSamples((x) => x.filter((y) => y.url !== s.url))}
                >
                  Remove
                </button>
              </div>
            ))}
            <label className="check">
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
              This is my voice, or I have the speaker&apos;s permission to clone it.
            </label>
            <button
              className="btn"
              style={{ marginTop: 10 }}
              disabled={!samples.length || !consent || !!busy}
              onClick={cloneIt}
            >
              {busy === 'clone' ? 'Cloning…' : 'Clone voice'}
            </button>
          </>
        )}

        {voiceTab === 'design' && (
          <>
            <label className="f">
              <span>Describe the voice</span>
              <textarea
                value={designDesc}
                onChange={(e) => setDesignDesc(e.target.value)}
                placeholder="Low, raspy female voice in her 40s, New Jersey accent, measured and dry, slight smile in the delivery"
              />
            </label>
            <button className="btn" style={{ marginTop: 10 }} disabled={!designDesc.trim() || !!busy} onClick={designIt}>
              {busy === 'design' ? 'Generating options…' : previews.length ? 'New options' : 'Generate options'}
            </button>
            {previews.length > 0 && (
              <div className="previews">
                {previews.map((p, i) => (
                  <div key={p.generatedVoiceId} className={`preview ${picked === i ? 'on' : ''}`} onClick={() => setPicked(i)}>
                    <b>#{i + 1}</b>
                    <audio controls src={`data:${p.mediaType};base64,${p.audioBase64}`} />
                  </div>
                ))}
                <button className="btn" disabled={picked === null || !!busy} onClick={keepDesigned}>
                  {busy === 'keep' ? 'Saving…' : `Keep option #${(picked ?? 0) + 1}`}
                </button>
              </div>
            )}
          </>
        )}

        {voiceTab === 'library' && (
          <div className="previews">
            {!library && <p className="hint">{busy === 'library' ? 'Loading your voices…' : ''}</p>}
            {library?.map((v) => (
              <div
                key={v.voiceId}
                className={`preview ${voice?.voiceId === v.voiceId ? 'on' : ''}`}
                onClick={() => setVoice({ voiceId: v.voiceId, voiceName: v.name, previewUrl: v.previewUrl, source: 'library' })}
              >
                <b style={{ minWidth: 120 }}>{v.name}</b>
                {v.previewUrl ? <audio controls src={v.previewUrl} /> : <span className="hint">{v.category}</span>}
              </div>
            ))}
          </div>
        )}

        {voice && voiceTab !== 'none' && (
          <p className="hint" style={{ marginTop: 12 }}>
            <span className="chip live">● voice ready</span> {voice.voiceName}
          </p>
        )}

        {error && <div className="err">{error}</div>}

        <button className="btn primary big" disabled={!name.trim() || !images.length || !!busy} onClick={save}>
          {busy === 'save' ? 'Saving…' : 'Save avatar'}
        </button>
      </section>

      <section>
        {avatars.length === 0 ? (
          <div className="empty">
            No avatars yet.
            <br />
            Build one on the left, then direct it in the Studio.
          </div>
        ) : (
          <div className="avatars">
            {avatars.map((a) => (
              <article className="avatar" key={a.id}>
                <div className="pic">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={a.imageUrls[0]} alt={a.name} />
                </div>
                <div className="meta">
                  <div className="name">{a.name}</div>
                  <span className={`chip ${a.voiceId ? 'live' : ''}`}>
                    {a.voiceId ? `${a.voiceSource} · ${a.voiceName}` : 'no voice'}
                  </span>
                  <span className="chip">{a.imageUrls.length} look refs</span>
                  {a.previewAudioUrl && <audio controls src={a.previewAudioUrl} />}
                  <button className="btn small danger" onClick={() => remove(a)}>
                    Delete
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
