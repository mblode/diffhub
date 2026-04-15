export interface Deferred<T> {
  promise: Promise<T>;
  reject: (reason?: unknown) => void;
  resolve: (value: T | PromiseLike<T>) => void;
}

export const createDeferred = <T>(): Deferred<T> => {
  let deferredResolve!: Deferred<T>["resolve"];
  let deferredReject!: Deferred<T>["reject"];

  // oxlint-disable-next-line promise/avoid-new
  const promise = new Promise<T>((resolve, reject) => {
    deferredResolve = resolve;
    deferredReject = reject;
  });

  return { promise, reject: deferredReject, resolve: deferredResolve };
};
