export function route<C>(fn: (req: Request, ctx: C) => Promise<unknown>) {
  return async (req: Request, ctx: C) => {
    try {
      const result = await fn(req, ctx);
      return result instanceof Response ? result : Response.json(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(message);
      return Response.json({ error: message }, { status: 500 });
    }
  };
}

export class BadRequest extends Error {}

export function need<T>(value: T | undefined | null | '', message: string): T {
  if (value === undefined || value === null || value === '') throw new Error(message);
  return value;
}
