'use client';

import { useRef, useState } from 'react';

// Records from the mic and hands back a Blob.
export default function Recorder({ onDone, disabled }: { onDone: (blob: Blob) => void; disabled?: boolean }) {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const rec = useRef<MediaRecorder | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const start = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mr = new MediaRecorder(stream);
    const chunks: BlobPart[] = [];
    mr.ondataavailable = (e) => chunks.push(e.data);
    mr.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      onDone(new Blob(chunks, { type: mr.mimeType || 'audio/webm' }));
    };
    mr.start();
    rec.current = mr;
    setSeconds(0);
    setRecording(true);
    timer.current = setInterval(() => setSeconds((s) => s + 1), 1000);
  };

  const stop = () => {
    rec.current?.stop();
    if (timer.current) clearInterval(timer.current);
    setRecording(false);
  };

  return recording ? (
    <button type="button" className="btn" onClick={stop}>
      <span className="rec">
        <span className="dot pulse" /> Stop · {seconds}s
      </span>
    </button>
  ) : (
    <button type="button" className="btn" onClick={start} disabled={disabled}>
      ● Record
    </button>
  );
}
