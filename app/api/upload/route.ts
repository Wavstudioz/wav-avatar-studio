import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { route } from '@/lib/http';

// Browser uploads go straight to Blob (no 4.5 MB serverless body limit).
export const POST = route(async (req: Request) => {
  const body = (await req.json()) as HandleUploadBody;
  return handleUpload({
    body,
    request: req,
    onBeforeGenerateToken: async () => ({
      allowedContentTypes: ['image/*', 'audio/*', 'video/*'],
      addRandomSuffix: true,
      maximumSizeInBytes: 200 * 1024 * 1024,
    }),
    onUploadCompleted: async () => {},
  });
});
