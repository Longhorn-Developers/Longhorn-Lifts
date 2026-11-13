import { getCloudflareContext } from "@opennextjs/cloudflare";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import z from "zod";

import { hashString } from "@/lib/auth";
import { getDB } from "@/lib/db";
import { refreshTokens } from "@/lib/db/schema/refresh-tokens";

const logoutFormat = z.object({
  refreshToken: z.string(),
  pushToken: z.string().optional(),
});

export async function POST(request: NextRequest) {
  const data = await request.json();
  const validationResult = logoutFormat.safeParse(data);
  if (!validationResult.success) {
    return NextResponse.json(
      {
        message: "Invalid request body.",
        errors: validationResult.error.issues,
      },
      { status: 400 },
    );
  }

  const { refreshToken, pushToken } = validationResult.data;
  await getDB()
    .delete(refreshTokens)
    .where(eq(refreshTokens.hash, hashString(refreshToken)));

  if (pushToken) {
    const { env } = getCloudflareContext();
    const doID = env.RIDE_INFO_STREAM.idFromName("global");
    const stub = env.RIDE_INFO_STREAM.get(doID);
    await stub.removeSubscriber(pushToken);
  }

  return NextResponse.json({ message: "Logged out successfully." });
}
