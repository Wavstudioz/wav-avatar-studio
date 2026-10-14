'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/client';
import type { Avatar, Job } from '@/lib/types';
import AvatarsPanel from './components/AvatarsPanel';
import StudioPanel from './components/StudioPanel';
import LibraryPanel from './components/LibraryPanel';

type Tab = 'avatars' | 'studio' | 'library';

export default function Home() {
  const [tab, setTab] = useState<Tab>('studio');
  const [avatars, setAvatars] = useState<Avatar[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [firstFrame, setFirstFrame] = useState<string | undefined>();

  const loadAvatars = useCallback(async () => {
    try {
      const { avatars } = await api<{ avatars: Avatar[] }>('/api/avatars');
      setAvatars(avatars);
    } catch (e) {
      setLoadError((e as Error).message);
    }
  }, []);

  const loadJobs = useCallback(async () => {
    try {
      const { jobs } = await api<{ jobs: Job[] }>('/api/jobs');
      setJobs(jobs);
    } catch (e) {
      setLoadError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    loadAvatars();
    loadJobs();
  }, [loadAvatars, loadJobs]);

  useEffect(() => {
    if (!loadError && avatars.length === 0) setTab((t) => (t === 'studio' ? 'avatars' : t));
  }, [avatars.length, loadError]);

  const queued = (job: Job) => {
    setJobs((j) => [job, ...j]);
    setTab('library');
  };

  const processing = jobs.filter((j) => j.status === 'processing').length;

  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand">
          <span className="tally" />
          <div>
            <h1>Wav Avatar Studio</h1>
            <small>Seedance 2.5 · ElevenLabs voices</small>
          </div>
        </div>
        <nav className="tabs">
          <button className={tab === 'avatars' ? 'on' : ''} onClick={() => setTab('avatars')}>
            Avatars<span className="count">{avatars.length}</span>
          </button>
          <button className={tab === 'studio' ? 'on' : ''} onClick={() => setTab('studio')}>
            Studio
          </button>
          <button className={tab === 'library' ? 'on' : ''} onClick={() => setTab('library')}>
            Library<span className="count">{processing ? `${processing} rendering` : jobs.length}</span>
          </button>
        </nav>
      </header>

      {loadError && (
        <div className="err">
          {loadError.replace(/\.+$/, '')}. Check that a Public Blob store is connected to this project, then redeploy.
        </div>
      )}

      {tab === 'avatars' && <AvatarsPanel avatars={avatars} reload={loadAvatars} />}
      {tab === 'studio' && (
        <StudioPanel
          avatars={avatars}
          onQueued={queued}
          firstFrame={firstFrame}
          clearFirstFrame={() => setFirstFrame(undefined)}
          goToAvatars={() => setTab('avatars')}
        />
      )}
      {tab === 'library' && (
        <LibraryPanel
          jobs={jobs}
          setJobs={setJobs}
          reload={loadJobs}
          useAsFirstFrame={(url) => {
            setFirstFrame(url);
            setTab('studio');
          }}
        />
      )}
    </main>
  );
}
