import "server-only";
import { EventEmitter } from "node:events";

/**
 * In-process bus: fits one server; more needs a shared bus behind publishTable/subscribeTable.
 * Kept on globalThis so dev hot reloads don't strand subscribers.
 */
declare global {
  var __tabletopRetroTableBus: EventEmitter | undefined;
}

const bus =
  globalThis.__tabletopRetroTableBus ??
  (() => {
    const emitter = new EventEmitter();
    // One listener per open stream; there's no meaningful cap.
    emitter.setMaxListeners(0);
    return emitter;
  })();
globalThis.__tabletopRetroTableBus = bus;

export function publishTable(tableId: string) {
  bus.emit(tableId);
}

export function subscribeTable(tableId: string, listener: () => void) {
  bus.on(tableId, listener);
  return () => {
    bus.off(tableId, listener);
  };
}

const chatEvent = (tableId: string) => `chat:${tableId}`;

export function publishChat(tableId: string, message: unknown) {
  bus.emit(chatEvent(tableId), message);
}

/** `read()` is sent once at the start and again on every change to the table. */
export function tableEventStream(request: Request, tableId: string, read: () => unknown) {
  return sseStream(request, (send) => {
    const push = () => send(read);
    push();
    return subscribeTable(tableId, push);
  });
}

/** `{ history }` once at the start, then `{ message }` per new message, so one message costs one small event. */
export function chatEventStream(request: Request, tableId: string, history: () => unknown[]) {
  return sseStream(request, (send) => {
    send(() => ({ history: history() }));
    const listener = (message: unknown) => send(() => ({ message }));
    bus.on(chatEvent(tableId), listener);
    return () => {
      bus.off(chatEvent(tableId), listener);
    };
  });
}

/**
 * A failed read ends the stream with an error so the browser reconnects,
 * rather than leaving it open and silent. The 15s comment keeps proxies
 * from closing the connection; `no-transform` keeps compression from
 * buffering it.
 */
function sseStream(request: Request, setup: (send: (read: () => unknown) => void) => () => void) {
  const encoder = new TextEncoder();
  let cleanup = () => {};
  let ended = false;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const end = (error?: unknown) => {
        if (ended) return;
        ended = true;
        cleanup();
        try {
          if (error) controller.error(error);
          else controller.close();
        } catch {
          // Already closed.
        }
      };
      const send = (read: () => unknown) => {
        if (ended) return;
        let message: string;
        try {
          message = `data: ${JSON.stringify(read())}\n\n`;
        } catch (error) {
          console.error("Table feed couldn't read state", error);
          end(error);
          return;
        }
        try {
          controller.enqueue(encoder.encode(message));
        } catch {
          end();
        }
      };
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": keep-alive\n\n"));
        } catch {
          end();
        }
      }, 15_000);
      let unsubscribe = () => {};
      cleanup = () => {
        unsubscribe();
        clearInterval(heartbeat);
      };
      request.signal.addEventListener("abort", () => end());
      unsubscribe = setup(send);
      if (ended) unsubscribe();
    },
    cancel() {
      ended = true;
      cleanup();
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
