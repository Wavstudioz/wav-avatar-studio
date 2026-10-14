'use client';

import { useEffect, useRef, useState } from 'react';
import { api, money } from '@/lib/client';
import type { Job } from '@/lib/types';

const POLL_MS = 8000;

export default function LibraryPanel({
  jobs,
  setJobs,
  reload,
  useAsFirstFrame,
}: {
  jobs: Job[];
  setJobs: React.Dispatch<React.SetStateAction<Job[]>>;
  reload: () => Promise<void>;
  useAsFirstFrame: (url: string) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [extending, setExtending] = useState<string | null>(null);
  const [extendPrompt, setExtendPrompt] = useState('');
  const [extendLen, setExtendLen] = useState(6);
  const [busy, setBusy] = useState<string | null>(null);
  const jobsRef = useRef(jobs);
  jobsRef.current = jobs;

  // Poll anything still rendering.
  useEffect(() => {
    let stopped = false;
    const tick = async () => {
      const pending = jobsRef.current.filter((j) => j.status === 'processing');
      await Promise.all(
        pending.map(async (j) => {
          try {
            const { job } = await api<{ job: Job }>(`/api/jobs/${j.id}`);
            if (!stopped) setJobs((all) => all.map((x) => (x.id === job.id ? job : x)));
          } catch {
            // transient; try again next tick
          }
        }),
      );
    };
    tick();
    const t = setInterval(tick, POLL_MS);
    return () => {
      stopped = true;
      clearInterval(t);
    };
  }, [setJobs]);

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

  const queue = (body: Record<string, unknown>, label: string) =>
    run(label, async () => {
      const { job } = await api<{ job: Job }>('/api/generate', body);
      setJobs((all) => [job, ...all]);
      setExtending(null);
      setExtendPrompt('');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });

  const remove = (j: Job) =>
    confirm('Remove this clip from the library?') &&
    run(`del-${j.id}`, async () => {
      await api(`/api/jobs/${j.id}`, undefined, 'DELETE');
      setJobs((all) => all.filter((x) => x.id !== j.id));
    });

  if (jobs.length === 0) {
    return <div className="empty">Nothing rendered yet. Head to the Studio and make your first shot.</div>;
  }

  return (
    <>
      <div className="row tight" style={{ justifyContent: 'flex-end', marginBottom: 12 }}>
        <button className="btn small ghost" onClick={() => reload()}>
          Refresh
        </button>
      </div>
      {error && <div className="err" style={{ marginBottom: 12 }}>{error}</div>}
      <div className="jobs">
        {jobs.map((j) => (
          <article className="job" key={j.id}>
            {j.status === 'completed' && j.videoUrl ? (
              <video src={j.videoUrl} controls playsInline preload="metadata" />
            ) : (
              <div className="wait">
                {j.status === 'processing' ? (
                  <>
                    <span className="pulse">RENDERING{j.progress ? ` · ${Math.round(j.progress * 100)}%` : ''}</span>
                    <div className="bar">
                      <i style={{ width: `${Math.max(4, (j.progress ?? 0.04) * 100)}%` }} />
                    </div>
                  </>
                ) : (
                  <span className="status-failed">{j.status.toUpperCase()}</span>
                )}
              </div>
            )}

            <div className="body">
              <div className="title">{j.title}</div>
              <div className="tags">
                <span className="chip">{j.kind}</span>
                {j.params.draft && <span className="chip">draft</span>}
                {j.params.resolution && <span className="chip">{j.params.resolution}</span>}
                {j.params.duration && <span className="chip">{j.params.duration}s</span>}
                {j.estimatedCost !== undefined && <span className="chip">~{money(j.estimatedCost)}</span>}
              </div>
              {j.error && <p className="hint status-failed">{j.error}</p>}

              {j.status === 'completed' && (
                <div className="actions">
                  {j.draftTaskId && (
                    <button
                      className="btn small primary"
                      disabled={!!busy}
                      onClick={() => queue({ kind: 'final', parentId: j.id }, `final-${j.id}`)}
                    >
                      {busy === `final-${j.id}` ? 'Sending…' : `Render 1080p (~${money((j.params.duration ?? 5) * 1.137)})`}
                    </button>
                  )}
                  <button className="btn small" onClick={() => setExtending(extending === j.id ? null : j.id)}>
                    Extend
                  </button>
                  {j.lastFrameUrl && (
                    <button className="btn small" onClick={() => useAsFirstFrame(j.lastFrameUrl!)}>
                      Next shot from last frame
                    </button>
                  )}
                  {j.videoUrl && (
                    <a className="btn small ghost" href={j.videoUrl} download target="_blank" rel="noreferrer">
                      Download
                    </a>
                  )}
                </div>
              )}

              {extending === j.id && (
                <div style={{ marginTop: 6 }}>
                  <textarea
                    value={extendPrompt}
                    onChange={(e) => setExtendPrompt(e.target.value)}
                    placeholder="Camera keeps drifting as she turns and walks out of frame"
                  />
                  <label className="f">
                    <span>Add {extendLen}s</span>
                    <input type="range" min={4} max={30} value={extendLen} onChange={(e) => setExtendLen(+e.target.value)} />
                  </label>
                  <button
                    className="btn small primary"
                    style={{ marginTop: 8 }}
                    disabled={!!busy}
                    onClick={() =>
                      queue({ kind: 'extend', parentId: j.id, scene: extendPrompt, duration: extendLen }, `ext-${j.id}`)
                    }
                  >
                    {busy === `ext-${j.id}` ? 'Sending…' : 'Extend clip'}
                  </button>
                </div>
              )}

              <button className="btn small danger" style={{ alignSelf: 'flex-start' }} onClick={() => remove(j)}>
                Remove
              </button>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
