/**
 * Next.js instrumentation hook.
 * Runs once on server startup (in production) or when the dev server boots.
 * Used here to warm up the GPA optimizer model so the first user request
 * doesn't pay the ~6-7s synthetic-data training cost.
 *
 * @see https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation
 */

export async function register() {
  // Only run on the server (Node.js runtime)
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { ensureModelTrained } = await import("@/lib/gpa/optimizer");
    try {
      const start = Date.now();
      await ensureModelTrained();
      const elapsed = Date.now() - start;
      console.log(`[instrumentation] GPA model warmed up in ${elapsed}ms`);
    } catch (err) {
      console.error("[instrumentation] failed to warm up GPA model:", err);
    }
  }
}
