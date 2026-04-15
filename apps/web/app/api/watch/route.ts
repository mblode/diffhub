import { ensureFileWatch, getFileWatchSnapshot, waitForFileWatch } from "@/lib/file-watch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WATCH_REQUEST_TIMEOUT_MS = 25_000;

export const GET = async (request: Request) => {
  if (process.env.DIFFHUB_DISABLE_WATCH === "1") {
    return Response.json({ error: "File watch disabled" }, { status: 503 });
  }

  try {
    await ensureFileWatch();
  } catch (error) {
    return Response.json({ error: String(error) }, { status: 500 });
  }

  const currentSnapshot = getFileWatchSnapshot();
  const url = new URL(request.url);
  const requestedRevisionParam = url.searchParams.get("revision");
  const requestedRevision =
    requestedRevisionParam === null ? null : Number.parseInt(requestedRevisionParam, 10);
  const shouldWait =
    requestedRevision !== null &&
    Number.isFinite(requestedRevision) &&
    requestedRevision === currentSnapshot.revision;

  if (!shouldWait) {
    return Response.json({
      ...currentSnapshot,
      changed: false,
      ok: true,
    });
  }

  const waitResult = await waitForFileWatch(request.signal, WATCH_REQUEST_TIMEOUT_MS);

  return Response.json({
    ...getFileWatchSnapshot(),
    changed: waitResult === "change",
    ok: true,
  });
};
