import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import z from "zod";

import { ensureAuthenticated } from "@/lib/auth";
import { getDB } from "@/lib/db";
import { accounts } from "@/lib/db/schema/accounts";
import { cancellationReasons, rides } from "@/lib/db/schema/rides";
import { users } from "@/lib/db/schema/users";

const cancellationBody = z.object({
  rideID: z.string(),
  cancellationReason: z.enum(cancellationReasons),
  cancellationExtra: z.string().max(2000).optional(),
});

export async function POST(request: NextRequest) {
  const authResponse = ensureAuthenticated(request);
  if (!authResponse.success) {
    return authResponse.failResponse!;
  }

  const accountID = authResponse.accountID!;
  const user = (await getDB()
    .select()
    .from(accounts)
    .where(eq(accounts.id, accountID))
    .leftJoin(users, eq(accounts.userID, users.id))
    .then(([result]) => result.users))!;

  const data = await request.json();
  const validationResult = cancellationBody.safeParse(data);

  if (!validationResult.success) {
    return NextResponse.json(
      {
        message: "Invalid body.",
      },
      { status: 400 },
    );
  }

  const { rideID, cancellationReason, cancellationExtra } =
    validationResult.data;

  const [ride] = await getDB()
    .select()
    .from(rides)
    .where(and(eq(rides.id, rideID), eq(rides.userID, user.id)));

  if (!ride) {
    return NextResponse.json(
      {
        message: "Ride not found.",
      },
      { status: 404 },
    );
  }

  if (!ride.cancelledTime) {
    return NextResponse.json(
      {
        message: "Ride not cancelled.",
      },
      { status: 400 },
    );
  }

  if (ride.cancellationReason) {
    return NextResponse.json(
      {
        message: "Cancellation reason already provided.",
      },
      { status: 400 },
    );
  }

  if (cancellationReason === "Other" && (cancellationExtra ?? "").length < 1) {
    return NextResponse.json(
      {
        message: "Provide a cancellation message.",
      },
      { status: 400 },
    );
  }

  await getDB()
    .update(rides)
    .set({ cancellationReason, cancellationExtra })
    .where(eq(rides.id, rideID));

  return NextResponse.json(
    {
      message: "Reason received.",
    },
    { status: 200 },
  );
}
