import { toError } from "@yappr/lib/result";
import type { TurnTelemetry } from "@yappr/lib/telemetry";
import { Cause, Context, Effect, Exit, Ref, Stream } from "effect";
import {
  errAsync,
  okAsync,
  ResultAsync,
  type ResultAsync as RA,
} from "neverthrow";
import { match } from "ts-pattern";

import { MCP_CONFIG_PATH } from "../../../constants.js";
import type { ChatOptions } from "../../../types.js";
import { buildChatModelMessages } from "./messages.js";
import { defaultChatRuntime, type ChatRuntime } from "./runtime.js";
import { createChatTransport, type ChatStreamRequest } from "./transport.js";

/**
 * SPIKE: the `chat()` orchestration re-expressed as an Effect program, to
 * evaluate the fit of Effect as a stricter FP idiom. Demonstrates the three
 * wins claimed for the service core:
 *   - Layer/DI:      `ChatRuntime` becomes a typed dependency (no `runtime` param).
 *   - Scope:         the MCP manager is `acquireRelease`d — close() is guaranteed
 *                    on success, failure, AND interruption (vs manual try/finally).
 *   - Interruption:  abort is structured (race + interrupt) — no `throwIfAborted`
 *                    threaded through the drain.
 * Kept behind a `ResultAsync` boundary so callers are identical to `chat()`.
 * Parallel to session.ts; not wired into the UI.
 */

class ChatRuntimeTag extends Context.Tag("ChatRuntime")<
  ChatRuntimeTag,
  ChatRuntime
>() {}

/** neverthrow → Effect boundary adapter. */
const fromResultAsync = <A, E>(ra: RA<A, E>): Effect.Effect<A, E> =>
  Effect.promise(() => Promise.resolve(ra)).pipe(
    Effect.flatMap((res) =>
      res.match(
        (a) => Effect.succeed(a),
        (e) => Effect.fail(e),
      ),
    ),
  );

/** MCP manager as a scoped resource: load on acquire, close on scope exit. */
const acquireMcp = (configPath: string) =>
  Effect.gen(function* () {
    const runtime = yield* ChatRuntimeTag;
    const mcp = runtime.createMcpManager();
    return yield* Effect.acquireRelease(
      fromResultAsync(mcp.loadConfigAndGetStatuses(configPath)).pipe(
        Effect.as(mcp),
      ),
      () => Effect.promise(() => mcp.close()),
    );
  });

/** Interrupt the running fiber when an external AbortSignal fires. */
const interruptOnAbort = (signal: AbortSignal | undefined) =>
  signal === undefined
    ? Effect.never
    : Effect.async<never>((resume) => {
        const onAbort = () => resume(Effect.interrupt);
        if (signal.aborted) onAbort();
        else signal.addEventListener("abort", onAbort, { once: true });
      });

interface DrainCallbacks {
  onUpdate: ChatOptions["onUpdate"];
  onToolCall: ChatOptions["onToolCall"];
  onTelemetry: ChatOptions["onTelemetry"];
}

const drain = (
  transport: ReturnType<typeof createChatTransport>,
  req: ChatStreamRequest,
  callbacks: DrainCallbacks,
  startedAt: number,
) =>
  Effect.gen(function* () {
    const content = yield* Ref.make("");
    const usage = yield* Ref.make<Omit<TurnTelemetry, "latencyMs"> | null>(
      null,
    );

    yield* Stream.fromAsyncIterable(transport.stream(req), toError).pipe(
      Stream.runForEach((event) =>
        match(event)
          .with({ type: "delta" }, (e) =>
            Ref.updateAndGet(content, (c) => c + e.text).pipe(
              Effect.flatMap((c) => Effect.sync(() => callbacks.onUpdate?.(c))),
            ),
          )
          .with({ type: "tool" }, (e) =>
            Effect.sync(() => callbacks.onToolCall?.(e.name, e.phase)),
          )
          .with({ type: "usage" }, (e) => Ref.set(usage, e.usage))
          .with({ type: "error" }, (e) => Effect.fail(new Error(e.message)))
          .exhaustive(),
      ),
    );

    const finalUsage = yield* Ref.get(usage);
    if (finalUsage) {
      yield* Effect.sync(() =>
        callbacks.onTelemetry?.({
          ...finalUsage,
          latencyMs: Date.now() - startedAt,
        }),
      );
    }
    const finalContent = yield* Ref.get(content);
    return finalContent || null;
  });

const chatProgram = (prompt: string, options: ChatOptions) =>
  Effect.gen(function* () {
    const {
      provider = "ollama",
      model = "qwen2.5:14b",
      ollamaBaseUrl,
      openrouterApiKey,
      mcpConfigPath,
      useTools = true,
      messages: priorMessages = [],
      images = [],
      systemPrompts = [],
      abortController,
      onUpdate,
      onToolCall,
      onTelemetry,
    } = options;

    const runtime = yield* ChatRuntimeTag;
    const mcp = yield* acquireMcp(mcpConfigPath ?? MCP_CONFIG_PATH);
    const transport = createChatTransport(runtime, {
      provider,
      model,
      ollamaBaseUrl,
      openrouterApiKey,
    });
    const req: ChatStreamRequest = {
      messages: buildChatModelMessages(prompt, priorMessages, images),
      systemPrompts,
      tools: useTools ? mcp.getTanStackTools() : [],
      ...(abortController && { signal: abortController.signal }),
    };

    return yield* Effect.raceFirst(
      drain(transport, req, { onUpdate, onToolCall, onTelemetry }, Date.now()),
      interruptOnAbort(abortController?.signal),
    );
  });

/** Drop-in equivalent of `chat()` — runs the Effect and maps Exit → Result. */
export function chatEffect(
  prompt: string,
  options: ChatOptions = {},
): ResultAsync<string | null, Error> {
  const program = chatProgram(prompt, options).pipe(
    Effect.scoped,
    Effect.provideService(
      ChatRuntimeTag,
      options.runtime ?? defaultChatRuntime,
    ),
  );
  return ResultAsync.fromSafePromise(Effect.runPromiseExit(program)).andThen(
    (exit) =>
      Exit.match(exit, {
        onSuccess: (value) => okAsync(value),
        onFailure: (cause) => errAsync(toError(Cause.squash(cause))),
      }),
  );
}

export { ChatRuntimeTag, acquireMcp };
