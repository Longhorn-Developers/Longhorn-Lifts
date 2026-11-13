import { getCloudflareContext } from "@opennextjs/cloudflare";
import CurrentRideMini from "@sure-walk/utils/types/current-ride-mini";
import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import z from "zod";

import { ensureAuthenticated } from "@/lib/auth";
import { getDB } from "@/lib/db";
import { accounts } from "@/lib/db/schema/accounts";
import { locations } from "@/lib/db/schema/locations";
import { users } from "@/lib/db/schema/users";
import { addLocations } from "@/lib/locations";
import {
  getActiveRideByUserID,
  getInProgressRideStateFromRide,
} from "@/lib/ride-info-stream/ride-helper";
import {
  cancelRide,
  createRoute,
  getDriverFromVehicle,
  getRideName,
  getRoute,
  sendMessageToDriver,
} from "@/lib/ride-info-stream/samsara-utils";

let initialized = false;

const groupRideMember = z.object({
  firstName: z
    .string()
    .min(1, "First name must be at least 1 character.")
    .max(30, "First name must be at most 30 characters."),
  lastName: z
    .string()
    .min(1, "Last name must be at least 1 character.")
    .max(30, "Last name must be at most 30 characters."),
  eid: z.string().min(4, "EID must be at least 4 characters.").optional(),
  phoneNumber: z
    .string()
    .min(10, "Phone number must be at least 10 digits")
    .optional(),
  userType: z.enum(["ut-affiliated", "guest"]),
});

const partialRide = z.object({
  pickupLocation: z.int(),
  dropoffLocation: z.int(),
  groupRide: z
    .array(groupRideMember)
    .max(4, "There may only be up to 5 total members per ride."),
});

export async function POST(request: NextRequest) {
  const authResponse = ensureAuthenticated(request);
  if (!authResponse.success) {
    return authResponse.failResponse!;
  }

  if (!initialized) {
    initialized = true;

    // add / update location information in DB on startup
    await addLocations();
  }

  const data = await request.json();
  const validationResult = partialRide.safeParse(data);

  if (!validationResult.success) {
    return NextResponse.json(
      {
        message: "Invalid request body.",
        errors: validationResult.error.issues,
      },
      { status: 400 },
    );
  }

  const { pickupLocation, dropoffLocation, groupRide } = validationResult.data;

  const [pickupLocationInfo] = await getDB()
    .select()
    .from(locations)
    .where(and(eq(locations.id, pickupLocation), eq(locations.type, "pickup")));

  if (!pickupLocationInfo) {
    return NextResponse.json(
      {
        message: "Invalid pickup location.",
      },
      { status: 400 },
    );
  }

  const [dropoffLocationInfo] = await getDB()
    .select()
    .from(locations)
    .where(and(eq(locations.id, dropoffLocation)));

  if (
    !dropoffLocationInfo ||
    pickupLocationInfo.id === dropoffLocationInfo.id
  ) {
    return NextResponse.json(
      {
        message: "Invalid dropoff location.",
      },
      { status: 400 },
    );
  }

  const accountID = authResponse.accountID!;
  const user = (await getDB()
    .select()
    .from(accounts)
    .where(eq(accounts.id, accountID))
    .leftJoin(users, eq(accounts.userID, users.id))
    .then(([result]) => result.users))!;

  const { env } = getCloudflareContext();
  const currentRide = await getActiveRideByUserID(user.id, env);
  if (currentRide) {
    return NextResponse.json(
      {
        message: "User currently has an active ride.",
      },
      { status: 400 },
    );
  }

  await createRoute({
    user,
    members: groupRide,
    pickupLocation: pickupLocationInfo,
    dropoffLocation: dropoffLocationInfo,
  });

  return NextResponse.json(
    { message: "Ride successfully created." },
    { status: 200 },
  );
}

export async function GET(request: NextRequest) {
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

  const { env } = getCloudflareContext();
  const currentRide = await getActiveRideByUserID(user.id, env);
  if (!currentRide) {
    return new NextResponse(null, { status: 204 });
  }

  const currentRideMini: CurrentRideMini = {
    pickupLocation: currentRide.pickupLocation,
    dropoffLocation: currentRide.dropoffLocation,
    rideState: getInProgressRideStateFromRide(currentRide),
  };

  return NextResponse.json(currentRideMini, { status: 200 });
}

export async function DELETE(request: NextRequest) {
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

  const { env } = getCloudflareContext();
  const currentRide = await getActiveRideByUserID(user.id, env);
  if (!currentRide) {
    return NextResponse.json({ message: "No active ride." }, { status: 404 });
  }

  const rideState = getInProgressRideStateFromRide(currentRide);
  if (rideState === "in progress" || rideState === "dropped off") {
    return NextResponse.json(
      { message: "Already picked up; too late to cancel." },
      { status: 400 },
    );
  }

  const route = await getRoute(currentRide.samsaraID);
  let driverID = route.data?.driver?.id;
  if (!driverID && route.data?.vehicle?.id) {
    const assignment = await getDriverFromVehicle(route.data.vehicle.id);
    if (assignment.data && assignment.data.length > 0) {
      driverID = assignment.data[0].driver.id;
    }
  }
  const doID = env.RIDE_INFO_STREAM.idFromName("global");
  const stub = env.RIDE_INFO_STREAM.get(doID);
  await cancelRide(currentRide, user);
  await stub.afterCancelRide(currentRide);
  if (driverID) {
    const rideName = getRideName(currentRide.user, currentRide.members);
    await sendMessageToDriver(driverID, `The "${rideName}" was cancelled.`);
  }

  return NextResponse.json(
    { message: "Ride cancelled.", rideIDForFeedback: currentRide.id },
    { status: 200 },
  );
}
