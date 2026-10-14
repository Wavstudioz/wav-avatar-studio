export type VoiceSource = 'clone' | 'design' | 'library' | 'none';

export interface Avatar {
  id: string;
  name: string;
  description?: string;
  /** Look references (AI-generated images only — Seedance rejects real faces). First one is the hero shot. */
  imageUrls: string[];
  voiceId?: string;
  voiceName?: string;
  voiceSource: VoiceSource;
  previewAudioUrl?: string;
  createdAt: string;
}

export type JobKind = 'talk' | 'shot' | 'extend' | 'final';
export type JobStatus = 'processing' | 'completed' | 'failed' | 'cancelled';

export interface Job {
  id: string;
  /** EmpirioLabs job id */
  jobId: string;
  kind: JobKind;
  title: string;
  avatarIds: string[];
  prompt: string;
  dialogue?: string;
  audioUrl?: string;
  params: {
    /** 'seedance' (AI characters, full scenes) or 'portrait' (Pixverse Avatar — real photos, lip-sync) */
    engine?: Engine;
    image?: string;
    resolution?: string;
    aspect_ratio?: string;
    duration?: number;
    draft?: boolean;
    [k: string]: unknown;
  };
  status: JobStatus;
  progress?: number;
  videoUrl?: string;
  lastFrameUrl?: string;
  draftTaskId?: string;
  parentId?: string;
  estimatedCost?: number;
  error?: string;
  createdAt: string;
  completedAt?: string;
}

export type Engine = 'seedance' | 'portrait';

export const PORTRAIT_MODEL = 'pixverse-avatar';

/** Pixverse Avatar, per second of output (EmpirioLabs list price, Oct 2026) */
export const PORTRAIT_RATES: Record<string, number> = {
  '360p': 0.025556,
  '540p': 0.051111,
  '720p': 0.076667,
  '1080p': 0.102222,
};

/** Seedance 2.5, per second of output */
export const RATES: Record<string, number> = {
  '480p': 0.206,
  '720p': 0.462,
  '1080p': 1.137,
};

export const CAMERA_MOVES = [
  'None',
  'Slow push in',
  'Slow pull out',
  'Dolly left to right',
  'Orbit around the subject',
  'Crane up reveal',
  'Handheld documentary feel',
  'Locked-off static frame',
  'Low-angle hero shot',
  'Over-the-shoulder',
  'Whip pan',
  'Rack focus from background to subject',
] as const;
