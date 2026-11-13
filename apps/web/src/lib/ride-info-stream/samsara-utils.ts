import { randomInt } from "node:crypto";

import { Samsara, SamsaraClient, SamsaraError } from "@samsarahq/samsara";
import GroupRideMember from "@sure-walk/utils/types/group-ride-member";
import { eq } from "drizzle-orm";

import { getDB } from "../db";
import { Location } from "../db/schema/locations";
import { Ride, rides } from "../db/schema/rides";
import { User } from "../db/schema/users";

const samsaraClient = new SamsaraClient({ token: process.env.SAMSARA_API_KEY });

const getCurrentWaitTime = async () => {
  return 30;
};

const getRideName = (user: User, members: GroupRideMember[]) => {
  // make sure the title of the route contains the # of people (group ride), if ADA is required, or both
  return `${members.length > 0 ? `${members.length + 1}-person ` : ``}${user.requiresAssistance ? "ADA " : ""}Sure Walk for ${user.firstName} ${user.lastName}`;
};

const retry = async <T>(func: () => Promise<T>) => {
  // only 2 retries for the sake of speed
  const retries = 2;
  let currentTry = 0;
  let lastErr: SamsaraError | null = null;
  while (currentTry < retries) {
    try {
      const res = await func();
      return res;
    } catch (err) {
      if (err instanceof SamsaraError) {
        // hopefully this is a one-off internal Samsara error: retry
        console.warn(
          `Error occured, retry ${currentTry + 1} / ${retries}: ${err}`,
        );
        lastErr = err;
      } else {
        // throw the unknown error immediately
        console.error(`Unknown error: ${err}`);
        throw err;
      }
    }
    currentTry++;
    // sleep 200ms, since we don't have that much time to afford
    // with functions that are being called in the Durable Object
    await new Promise((r) => setTimeout(r, 200));
  }
  throw lastErr;
};

const createRoute = async ({
  user,
  members,
  pickupLocation,
  dropoffLocation,
}: {
  user: User;
  members: GroupRideMember[];
  pickupLocation: Location;
  dropoffLocation: Location;
}) => {
  const waitTime = await getCurrentWaitTime();
  const routeName = getRideName(user, members);
  // display all relevant information for the leader and group ride members
  const routeNotes =
    `Picking up ${user.firstName} ${user.lastName} (${user.phoneNumber}) at ${pickupLocation.name} and dropping off at ${dropoffLocation.name}. ` +
    `${members.length > 0 ? `Also picking up ${members.map((m) => `${m.firstName} ${m.lastName}${m.phoneNumber ? ` (${m.phoneNumber})` : ""}`).join(", ")}.\n` : ""}Submitted at ${new Date().toLocaleString("en-US", { timeZone: "America/Chicago" })}.`;

  const res = await retry<Samsara.RoutesCreateRouteResponseBody>(
    async () =>
      await samsaraClient.routes.createRoute({
        name: routeName,
        notes: routeNotes,
        recomputeScheduledTimes: false,
        settings: {
          routeCompletionCondition: "departLastStop",
          routeStartingCondition: "arriveFirstStop",
          sequencingMethod: "manual",
        },
        // Sure Walk tag ID
        tagIds: ["6343755"],
        stops: [
          {
            name: pickupLocation.name,
            scheduledArrivalTime: new Date(
              Date.now() + waitTime * 60 * 1000,
            ).toISOString(),
            scheduledDepartureTime: new Date(
              Date.now() + (waitTime + 2) * 60 * 1000,
            ).toISOString(),
            sequenceNumber: 1,
            singleUseLocation: {
              latitude: pickupLocation.lat,
              longitude: pickupLocation.lon,
              address: pickupLocation.address,
              radiusMeters: 100,
            },
          },
          {
            name: dropoffLocation.name,
            scheduledArrivalTime: new Date(
              Date.now() + (waitTime + 12) * 60 * 1000,
            ).toISOString(),
            scheduledDepartureTime: new Date(
              Date.now() + (waitTime + 13) * 60 * 1000,
            ).toISOString(),
            sequenceNumber: 2,
            singleUseLocation: {
              latitude: dropoffLocation.lat,
              longitude: dropoffLocation.lon,
              address: dropoffLocation.address,
              radiusMeters: 100,
            },
          },
        ],
      }),
  );

  const data = res.data!;
  let rideCode: string | null = null;
  if (members.length > 0) {
    // only present on group rides
    rideCode = "";
    // don't use I, 1, 0, and O since those can be hard to distinguish
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const charsLen = chars.length;
    for (let i = 0; i < 7; i++) {
      rideCode += chars.charAt(randomInt(charsLen));
    }
  }

  await retry(
    async () =>
      await samsaraClient.forms.postFormSubmission({
        formTemplate: { id: "3c61e884-1533-4e09-a04c-8ff9fbe4e7f7" },
        isRequired: true,
        status: "notStarted",
        routeStopId: data.stops![0].id,
      }),
  );

  const [rideRecord] = await getDB()
    .insert(rides)
    .values({
      samsaraID: data.id,
      userID: user.id,
      members: members,
      pickupLocationID: pickupLocation.id,
      dropoffLocationID: dropoffLocation.id,
      pickupStopID: data.stops![0].id,
      dropoffStopID: data.stops![1].id,
      estPickupTime: data.stops![0].scheduledArrivalTime!,
      estDropoffTime: data.stops![1].scheduledArrivalTime!,
      shareCode: rideCode,
    })
    .returning();

  return rideRecord;
};

const getAssetLocations = async () => {
  const res = await retry(
    async () => await samsaraClient.assets.v1GetAllAssetCurrentLocations(),
  );
  return res;
};

const getVehicleLocations = async () => {
  const res = await retry(
    async () => await samsaraClient.vehicleLocations.getVehicleLocationsFeed(),
  );
  return res;
};

const getRouteUpdates = async (after?: string) => {
  const res = await retry(
    async () =>
      await samsaraClient.routes.getRoutesFeed({
        after,
        expand: "route",
      }),
  );
  return res;
};

const getRoute = async (routeID: string) => {
  const res = await retry(
    async () => await samsaraClient.routes.fetchRoute({ id: routeID }),
  );
  return res;
};

const getAsset = async (vehicleID: string) => {
  const res = await retry(
    async () => await samsaraClient.assets.list({ ids: vehicleID }),
  );
  return res;
};

const cancelRide = async (ride: Ride, user: User) => {
  const newName = "Cancelled " + getRideName(user, ride.members);
  await retry(
    async () =>
      await samsaraClient.routes.patchRoute({
        id: ride.samsaraID,
        name: newName,
        // @ts-expect-error should be null to remove vehicleId
        vehicleId: null,
        // @ts-expect-error should be null to remove driverId
        driverId: null,
        stops: [
          {
            id: ride.pickupStopID!,
            sequenceNumber: 1,
          },
          {
            id: ride.dropoffStopID!,
            sequenceNumber: 2,
          },
        ],
      }),
  );

  await getDB()
    .update(rides)
    .set({ cancelledTime: new Date().toISOString(), shareCode: null })
    .where(eq(rides.id, ride.id));
};

const getFormSubmission = async (submissionID: string) => {
  const res = await retry(
    async () =>
      await samsaraClient.forms.getFormSubmissions({
        ids: submissionID,
      }),
  );
  return res;
};

const fetchCurrentRoutes = async () => {
  const res = await retry(
    async () =>
      await samsaraClient.routes.fetchRoutes({
        startTime: new Date(Date.now() - 12 * 3600 * 1000).toISOString(),
        endTime: new Date(Date.now() + 8 * 3600 * 1000).toISOString(),
      }),
  );
  return res;
};

const missRide = async (ride: Ride, user: User) => {
  const newName = "Missed " + getRideName(user, ride.members);
  await retry(
    async () =>
      await samsaraClient.routes.patchRoute({
        id: ride.samsaraID,
        name: newName,
        // @ts-expect-error should be null to remove vehicleId
        vehicleId: null,
        // @ts-expect-error should be null to remove driverId
        driverId: null,
        stops: [
          {
            id: ride.pickupStopID!,
            sequenceNumber: 1,
          },
          {
            id: ride.dropoffStopID!,
            sequenceNumber: 2,
          },
        ],
      }),
  );
};

const getVehicleFromDriver = async (driverID: string) => {
  const res = await retry(
    async () =>
      await samsaraClient.driverVehicleAssignments.getDriverVehicleAssignments({
        filterBy: "drivers",
        driverIds: driverID,
        assignmentType: "HOS",
      }),
  );
  return res;
};

const getDriverFromVehicle = async (vehicleID: string) => {
  const res = await retry(
    async () =>
      await samsaraClient.driverVehicleAssignments.getDriverVehicleAssignments({
        filterBy: "vehicles",
        vehicleIds: vehicleID,
        assignmentType: "HOS",
      }),
  );
  return res;
};

const sendMessageToDriver = async (driverID: string, text: string) => {
  const res = await retry(
    async () =>
      await samsaraClient.messages.v1CreateMessages({
        driverIds: [Number.parseInt(driverID)],
        text,
      }),
  );
  return res;
};

export {
  cancelRide,
  createRoute,
  fetchCurrentRoutes,
  getAsset,
  getAssetLocations,
  getCurrentWaitTime,
  getDriverFromVehicle,
  getFormSubmission,
  getRideName,
  getRoute,
  getRouteUpdates,
  getVehicleFromDriver,
  getVehicleLocations,
  missRide,
  samsaraClient,
  sendMessageToDriver,
};
