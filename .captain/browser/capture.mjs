/* oxlint-disable unicorn/no-await-expression-member, promise/avoid-new, eslint/no-plusplus, eslint/no-promise-executor-return -- Disposable visual-QA harness using the native CDP socket. */
import { writeFile } from "node:fs/promises";

setTimeout(() => process.exit(3), 60_000).unref();

const [url, port, desktopOut, mobileOut, consoleOut] = process.argv.slice(2);
const target = await (
  await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: "PUT" })
).json();
const ws = new WebSocket(target.webSocketDebuggerUrl);
const pending = new Map();
const errors = [];
const failedRequests = [];
let id = 0;

const send = (method, params = {}) =>
  new Promise((resolve) => {
    pending.set(++id, resolve);
    ws.send(JSON.stringify({ id, method, params }));
  });

await new Promise((resolve) => ws.addEventListener("open", resolve, { once: true }));
ws.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  if (message.id) {
    pending.get(message.id)?.(message.result);
    pending.delete(message.id);
    return;
  }
  if (message.method === "Log.entryAdded" && message.params.entry.level === "error") {
    errors.push(message.params.entry.text);
  }
  if (message.method === "Runtime.exceptionThrown") {
    errors.push(
      message.params.exceptionDetails.exception?.description ??
        message.params.exceptionDetails.text,
    );
  }
  if (message.method === "Network.loadingFailed") {
    failedRequests.push(message.params.errorText);
  }
});

await send("Log.enable");
await send("Network.enable");
await send("Runtime.enable");
await send("Page.enable");

const capture = async ({ height, mobile, out, width }) => {
  await send("Emulation.setDeviceMetricsOverride", {
    deviceScaleFactor: 1,
    height,
    mobile,
    width,
  });
  await send("Page.navigate", { url });
  await new Promise((resolve) => setTimeout(resolve, 4000));
  const metrics = await send("Runtime.evaluate", {
    expression: `(() => {
      const heading = document.querySelector('h1');
      const image = document.querySelector('main section img, section img');
      const headingRect = heading?.getBoundingClientRect();
      const imageRect = image?.getBoundingClientRect();
      const lineHeight = heading ? Number.parseFloat(getComputedStyle(heading).lineHeight) : 0;
      return {
        heading: heading?.textContent,
        headingLines: headingRect && lineHeight ? Math.round(headingRect.height / lineHeight) : null,
        imageRight: imageRect ? Math.round(imageRect.right) : null,
        imageWidth: imageRect ? Math.round(imageRect.width) : null,
        overflow: document.documentElement.scrollWidth > innerWidth,
        viewport: [innerWidth, innerHeight],
      };
    })()`,
    returnByValue: true,
  });
  const { data } = await send("Page.captureScreenshot", {
    captureBeyondViewport: false,
    format: "png",
    fromSurface: true,
  });
  await writeFile(out, Buffer.from(data, "base64"));
  return metrics.result.value;
};

const desktop = await capture({
  height: 885,
  mobile: false,
  out: desktopOut,
  width: 1665,
});
const mobile = await capture({
  height: 844,
  mobile: true,
  out: mobileOut,
  width: 390,
});

const result = { desktop, errors, failedRequests, mobile };
await writeFile(consoleOut, JSON.stringify(result, null, 2));
await fetch(`http://127.0.0.1:${port}/json/close/${target.id}`);
ws.close();
console.log(JSON.stringify(result, null, 2));
