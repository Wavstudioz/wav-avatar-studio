import { listVoices } from '@/lib/eleven';
import { route } from '@/lib/http';

export const dynamic = 'force-dynamic';

export const GET = route(async () => ({ voices: await listVoices() }));
