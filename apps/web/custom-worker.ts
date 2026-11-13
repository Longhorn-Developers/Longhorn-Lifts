/* eslint-disable simple-import-sort/imports */
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { default as handler } from "./.open-next/worker";
import { handleRideStream } from "@/lib/ride-info-stream/worker";

export default {
  async fetch(
    request: Request,
    env: CloudflareEnv,
    ctx: ExecutionContext,
  ): Promise<Response> {
    const url = new URL(request.url);
    // this is required becuase .fetch on a Durable Object from a Next.js worker context
    // will not work when using websockets (at least from my testing)
    if (url.pathname.startsWith("/api/ride/events")) {
      return await handleRideStream(request, env);
    }

    // otherwise just use the regular Next.js worker
    return handler.fetch(request, env, ctx);
  },
} satisfies ExportedHandler<CloudflareEnv>;

export { PushReceiptsWorkflow } from "./src/lib/push-notifications";
export { RideInfoStream } from "./src/lib/ride-info-stream";
