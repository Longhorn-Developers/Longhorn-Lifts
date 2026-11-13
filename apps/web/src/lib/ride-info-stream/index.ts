import { Samsara } from "@samsarahq/samsara";
import InProgressRideState from "@sure-walk/utils/types/in-progress-ride-state";
import VehicleInfoShort from "@sure-walk/utils/types/vehicle-info-short";
import { DurableObject } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { ExpoPushTicket } from "expo-server-sdk";

import { getDBInWorker } from "../db";
import { Ride, rides } from "../db/schema/rides";
import { users } from "../db/schema/users";
import { Vehicle, vehicles } from "../db/schema/vehicles";
import {
  fetchPushReceipts,
  sendCancelledRideNotification,
  sendMissedRideNotification,
  sendRideFeedbackNotification,
  sendRouteUpdateNotification,
  sendVehicleInfoNotification,
} from "../push-notifications";
import {
  getActiveRideByUserID,
  getActiveRides,
  setDropoffStopState,
  setPickupStopState,
} from "./ride-helper";
import {
  fetchCurrentRoutes,
  getAsset,
  getAssetLocations,
  getFormSubmission,
  getRouteUpdates,
  getVehicleFromDriver,
  getVehicleLocations,
  missRide,
} from "./samsara-utils";

export class RideInfoStream extends DurableObject<CloudflareEnv> {
  // { rideID: [all clients] }
  streams: Map<string, WebSocket[]>;
  sql: SqlStorage;

  constructor(state: DurableObjectState, env: CloudflareEnv) {
    super(state, env);
    this.streams = new Map();
    this.sql = state.storage.sql;

    this.initializeDB();
  }

  async fetch(request: Request): Promise<Response> {
    const currentRide = JSON.parse(
      decodeURIComponent(request.headers.get("x-current-ride") ?? ""),
    ) as Awaited<ReturnType<typeof getActiveRideByUserID>> & {
      rideState: InProgressRideState;
      isLeader: boolean;
      pushToken: string;
    };
    const pickupLocation = currentRide.pickupLocation;
    const dropoffLocation = currentRide.dropoffLocation;
    const groupRide = currentRide.members;
    const rideState = currentRide.rideState;
    const shareCode = currentRide.shareCode ?? null;
    const vehicleInfo = currentRide.vehicle;
    const leader = currentRide.user;
    const isLeader = currentRide.isLeader;
    const pushToken = currentRide.pushToken;

    const websocketPair = new WebSocketPair();
    const [client, server] = Object.values(websocketPair);

    server.accept();
    this.streams.set(currentRide.id, [
      ...(this.streams.get(currentRide.id) ?? []),
      server,
    ]);
    if (pushToken) {
      this.subscribePushToken(pushToken, currentRide.id, isLeader, shareCode);
    }

    server.addEventListener("close", () => {
      server.close(1000, "Closing normally.");
      this.deleteSocket(server, currentRide.id);
    });

    setTimeout(() => {
      this.sendEvent(
        "connected",
        {
          rideState,
          pickupLocation,
          dropoffLocation,
          groupRide,
          shareCode,
          leader,
        },
        currentRide.id,
      );
      if (vehicleInfo) {
        this.sendEvent(
          "vehicleInfo",
          this.vehicleInfoShort(vehicleInfo),
          currentRide.id,
        );
      }
    }, 1000);

    // kick off the data fetching loop if it hasn't already
    const currentAlarm = await this.ctx.storage.getAlarm();
    if (currentAlarm === null) {
      this.ctx.storage.setAlarm(Date.now() + 5000);
    }

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  initializeDB() {
    this.sql.exec(`CREATE TABLE IF NOT EXISTS pushTokens(
      pushToken text PRIMARY KEY,
      rideID text NOT NULL,
      isLeader INTEGER NOT NULL,
      shareCode text
    ) STRICT;
    
    CREATE TABLE IF NOT EXISTS pushTickets(
      ticketID text PRIMARY KEY,
      submittedAt INTEGER DEFAULT (unixepoch())
    ) STRICT;`);
  }

  subscribePushToken(
    pushToken: string,
    rideID: string,
    isLeader: boolean,
    shareCode: string | null,
  ) {
    if (!pushToken) {
      return;
    }

    this.sql.exec(
      `INSERT OR REPLACE INTO pushTokens (pushToken, rideID, isLeader, shareCode) 
      VALUES (?, ?, ?, ?);`,
      pushToken,
      rideID,
      isLeader ? 1 : 0,
      shareCode,
    );
  }

  clearSubscribers(rideID: string) {
    this.sql.exec(`DELETE FROM pushTokens WHERE rideID = ?;`, rideID);
  }

  removeSubscriber(pushToken: string) {
    this.sql.exec(`DELETE FROM pushTokens where pushToken = ?`, pushToken);
  }

  getSubscribers(rideID: string) {
    const res = this.sql
      .exec(`SELECT * FROM pushTokens where rideID = ?;`, rideID)
      .toArray();
    if (res.length === 0) {
      return;
    }

    const shareCode = res[0].shareCode as string | null;
    const pushTokens = res.map((value) => value.pushToken as string);
    const isLeader = res.map((value) => (value.isLeader as number) === 1);
    return {
      pushTokens,
      shareCode,
      isLeader,
    };
  }

  addPushTickets(pushTickets: ExpoPushTicket[]) {
    const addIds: string[] = [];
    pushTickets.forEach((pushTicket) => {
      if (pushTicket.status === "ok") {
        addIds.push(pushTicket.id);
      } else {
        if (pushTicket.details?.error === "DeviceNotRegistered") {
          this.sql.exec(
            `DELETE FROM pushTokens WHERE pushToken = ?`,
            pushTicket.details.expoPushToken,
          );
        } else {
          // unexpected error
          console.error("unexpected error from Expo API: ", pushTicket);
        }
      }
    });
    if (addIds.length > 0) {
      const template = addIds.map(() => "(?)").join(",\n");
      this.sql.exec(
        `INSERT INTO pushTickets (ticketID) VALUES ${template};`,
        ...addIds,
      );
    }
  }

  async fetchPushReceipts() {
    const res = this.sql
      .exec(
        `SELECT ticketID FROM pushTickets ORDER BY submittedAt ASC LIMIT 1000`,
      )
      .toArray();
    if (res.length === 0) {
      return;
    }

    const ticketIDs = res.map((row) => row.ticketID as string);
    const pushReceipts = await fetchPushReceipts(ticketIDs);
    const removeIDs: string[] = [];
    Object.entries(pushReceipts).forEach(([ticketID, pushReceipt]) => {
      removeIDs.push(ticketID);
      if (pushReceipt.status === "error") {
        if (pushReceipt.details?.error === "DeviceNotRegistered") {
          this.sql.exec(
            `DELETE FROM pushTokens WHERE pushToken = ?`,
            pushReceipt.details.expoPushToken,
          );
        } else {
          console.error("unexpected error from Expo API: ", pushReceipt);
        }
      }
    });
    if (removeIDs.length > 0) {
      const template = removeIDs.map(() => "?").join(", ");
      this.sql.exec(
        `DELETE FROM pushTickets WHERE ticketID IN (${template});`,
        ...removeIDs,
      );
    }
  }

  deleteSocket(ws: WebSocket, rideID: string) {
    const currConnections = this.streams.get(rideID);
    this.streams.set(
      rideID,
      currConnections?.filter((val) => val !== ws) ?? [],
    );
  }

  sendEvent(eventType: string, data: object, rideID: string) {
    // format of each JSON payload
    const payload = { data: data, eventType: eventType };
    this.streams.get(rideID)?.forEach((ws) => {
      ws.send(JSON.stringify(payload));
    });
  }

  async alarm() {
    await this.pollInfo();
  }

  async pollInfo() {
    // determine if an unassigned route has been assigned a driver
    const assignmentChanges = await this.pollAssignmentChanges();
    let activeRides = await getActiveRides(this.env);
    await this.streamAssignmentChanges(activeRides, assignmentChanges);

    let routeUpdates = await this.pollRouteUpdates();

    if (activeRides.length === 0 && routeUpdates.data.length === 0) {
      console.log(
        `Durable object spinning down at ${new Date().toLocaleTimeString()}`,
      );
      // durable object will be spun down
      return;
    }

    if (routeUpdates.data.length > 0) {
      // forward route updates (en route, arrived, departed, skipped)
      await this.streamRouteUpdates(activeRides, routeUpdates);
      let hasNextPage = routeUpdates.pagination.hasNextPage;
      activeRides = await getActiveRides(this.env);
      while (hasNextPage) {
        await this.streamRouteUpdates(activeRides, routeUpdates);
        routeUpdates = await this.pollRouteUpdates();
        activeRides = await getActiveRides(this.env);
        hasNextPage = routeUpdates.pagination.hasNextPage;
      }
    }

    // forward asset / vehicle locations
    const assetLocations = await this.pollAssetLocations();
    const vehicleLocations = await this.pollVehicleLocations();
    await this.streamLocations(activeRides, assetLocations, vehicleLocations);

    const currentAlarm = await this.ctx.storage.getAlarm();
    if (!currentAlarm) {
      this.ctx.storage.setAlarm(Date.now() + 5000);
    }
  }

  async streamAssignmentChanges(
    activeRides: Ride[],
    assignmentChanges: Samsara.RoutesFetchRoutesResponseBody,
  ) {
    for (const ride of activeRides) {
      if (ride.pickupStopState === "unassigned") {
        const route = (assignmentChanges.data ?? []).find(
          (route) => route.id === ride.samsaraID,
        );
        if (route?.vehicle || route?.driver) {
          await setPickupStopState(ride.pickupStopID, "scheduled", this.env);
          await setDropoffStopState(ride.dropoffStopID, "scheduled", this.env);
          this.sendRouteUpdate(ride.id, "assigned");

          // we ended up not going with driver assigned notification
          // as there were too many notifications

          // const subscribers = this.getSubscribers(ride.id);
          // if (subscribers) {
          //   const res = await sendRouteUpdateNotification({
          //     rideState: "assigned",
          //     pushTokens: subscribers.pushTokens,
          //     rideID: ride.id,
          //     shareCode: subscribers.shareCode,
          //     isLeader: subscribers.isLeader,
          //   });
          //   this.addPushTickets(res);
          // }
        }
      }
    }
  }

  async streamLocations(
    activeRides: Ride[],
    assetLocations: Samsara.InlineResponse2002,
    vehicleLocations: Samsara.VehicleLocationsListResponse,
  ) {
    for (const ride of activeRides) {
      if (
        ride.vehicleID &&
        // only stream location after en route
        ride.pickupStopState !== "scheduled" &&
        (this.streams.get(ride.id) ?? []).length !== 0
      ) {
        const assetData = assetLocations.assets?.find(
          (vehicle) => vehicle.id + "" === ride.vehicleID,
        );
        if (assetData && assetData.location) {
          this.sendEvent("vehicleLocation", assetData.location[0], ride.id);
          continue;
        }

        const vehicleData = vehicleLocations.data.find(
          (vehicle) => vehicle.id === ride.vehicleID,
        );
        if (vehicleData && vehicleData.locations) {
          this.sendEvent("vehicleLocation", vehicleData.locations[0], ride.id);
        }
      }
    }
  }

  async streamRouteUpdates(
    activeRides: Awaited<ReturnType<typeof getActiveRides>>,
    routeUpdates: Samsara.RoutesGetRoutesFeedResponseBody,
  ) {
    for (const ride of routeUpdates.data) {
      for (const stop of ride.changes.after.stops ?? []) {
        const stopID = stop.id;
        const stopState = stop.state!;
        const stopType =
          ride.route.stops?.at(0)?.id === stopID ? "pickup" : "dropoff";

        // if activeRide exists, the route update associated with this ride
        // is important and should be delivered to the user, either through
        // the websocket connection or a push notification
        // otherwise we still want to update the stop status in the database
        const activeRide = activeRides.find(
          ({ samsaraID }) => samsaraID === ride.route.id,
        );
        const rideID = activeRide?.id;

        if (stopType === "pickup") {
          await setPickupStopState(stopID, stopState, this.env);

          if (rideID) {
            if (stopState === "scheduled") {
              // already done in streamAssignmentChanges
              // this.sendRouteUpdate(rideID, "assigned");
            }
            if (stopState === "en route") {
              // if the stop becomes en route, that means the driver / vehicle
              // has been finalized and is now currently driving towards the
              // user's pickup location directly
              this.sendRouteUpdate(rideID, "en route");
              const subscribers = this.getSubscribers(rideID);
              if (subscribers) {
                const res = await sendRouteUpdateNotification({
                  rideState: "en route",
                  pushTokens: subscribers.pushTokens,
                  rideID: rideID,
                  shareCode: subscribers.shareCode,
                  isLeader: subscribers.isLeader,
                });
                this.addPushTickets(res);
              }

              // we can now fetch and deliver the finalized vehicle information
              let vehicleID = ride.route.vehicle?.id;
              const driverID = ride.route.driver?.id;
              if (driverID) {
                const vehicleAssignment = await getVehicleFromDriver(driverID);
                if (
                  // this can be undefined for some reason
                  vehicleAssignment.data &&
                  vehicleAssignment.data.length > 0
                ) {
                  vehicleID = vehicleAssignment.data[0].vehicle.id;
                }
              }
              if (vehicleID) {
                // get agnostic information about the asset, and then handle
                // equipment or a vehicle later
                const asset = await getAsset(vehicleID);
                const assetInfo = asset.data[0];
                let vehicle: Vehicle;

                if (assetInfo.type === "vehicle") {
                  // this will likely have year / make / model information
                  // and a license plate
                  [vehicle] = await getDBInWorker(this.env)
                    .insert(vehicles)
                    .values({
                      samsaraID: vehicleID,
                      name: assetInfo.name ?? "unnamed",
                      make: assetInfo.make,
                      model: assetInfo.model,
                      year: assetInfo.year,
                      licensePlate: assetInfo.licensePlate,
                      adaAccessible: assetInfo.name?.includes("ADA") ?? false,
                      type: "vehicle",
                    })
                    .onConflictDoUpdate({
                      target: vehicles.samsaraID,
                      set: {
                        // data might have changed, so update everything (excl. id)
                        name: assetInfo.name ?? "unnamed",
                        make: assetInfo.make,
                        model: assetInfo.model,
                        year: assetInfo.year,
                        licensePlate: assetInfo.licensePlate,
                        adaAccessible: assetInfo.name?.includes("ADA") ?? false,
                      },
                    })
                    .returning();
                } else {
                  // equipment, so the asset will at least have a name
                  // the license plate might be a 4-digit code on the side
                  // of the cart

                  [vehicle] = await getDBInWorker(this.env)
                    .insert(vehicles)
                    .values({
                      samsaraID: vehicleID,
                      name: assetInfo.name ?? "unnamed",
                      licensePlate: assetInfo.licensePlate,
                      adaAccessible: assetInfo.name?.includes("ADA") ?? false,
                      type: "equipment",
                    })
                    .onConflictDoUpdate({
                      target: vehicles.samsaraID,
                      set: {
                        name: assetInfo.name ?? "unnamed",
                        licensePlate: assetInfo.licensePlate,
                        adaAccessible: assetInfo.name?.includes("ADA") ?? false,
                      },
                    })
                    .returning();
                }

                await getDBInWorker(this.env)
                  .update(rides)
                  .set({ vehicleID: vehicleID })
                  .where(eq(rides.samsaraID, ride.route.id));

                this.sendVehicleInfo(rideID, vehicle);
                if (subscribers) {
                  const res = await sendVehicleInfoNotification({
                    vehicleInfo: this.vehicleInfoShort(vehicle),
                    pushTokens: subscribers.pushTokens,
                    rideID,
                    shareCode: subscribers.shareCode,
                    isLeader: subscribers.isLeader,
                  });
                  this.addPushTickets(res);
                }
              }
            }
            if (stopState === "arrived") {
              // the user will now have 2 minutes to board the vehicle
              this.sendRouteUpdate(rideID, "arrived");
              const subscribers = this.getSubscribers(rideID);
              if (subscribers) {
                const res = await sendRouteUpdateNotification({
                  rideState: "arrived",
                  pushTokens: subscribers.pushTokens,
                  rideID: rideID,
                  shareCode: subscribers.shareCode,
                  isLeader: subscribers.isLeader,
                });
                this.addPushTickets(res);
              }
              await getDBInWorker(this.env)
                .update(rides)
                .set({ actualPickupTime: stop.actualArrivalTime })
                .where(eq(rides.pickupStopID, stopID));
            }
            if (stopState === "departed") {
              // when the vehicle leaves the pickup location, there are now
              // two possibilities:
              // firstly, the user was picked up
              // second, the user missed their ride
              // in group rides, as long as one person gets picked up the ride
              // will continue.
              // this information is located on a form assigned to the pickup stop

              // this can be undefined
              const formObject = ride.route.stops![0].forms;
              let numPickedUp: number | undefined = 1;
              if (formObject) {
                const submissionID = formObject![0].id;
                const form = await getFormSubmission(submissionID);
                if (form.data[0].status === "completed") {
                  numPickedUp = form.data[0].fields[0].numberValue?.value;
                }
              }
              // if the form didn't submit in time, give them the benefit of the doubt
              if (numPickedUp === undefined) {
                numPickedUp = 1;
              }
              if (numPickedUp < 1) {
                await getDBInWorker(this.env)
                  .update(rides)
                  .set({ shareCode: null, numPickedUp })
                  .where(eq(rides.id, rideID));

                const [user] = await getDBInWorker(this.env)
                  .select()
                  .from(users)
                  .where(eq(users.id, activeRide.userID));
                // update samsara route, unassign driver / vehicle
                await missRide(activeRide, user);

                this.streams
                  .get(rideID)
                  ?.forEach((ws) => ws.close(1000, "Missed pickup."));
                this.streams.delete(rideID);
                const subscribers = this.getSubscribers(rideID);
                if (subscribers) {
                  const res = await sendMissedRideNotification({
                    pickupLocation: activeRide.pickupLocation,
                    dropoffLocation: activeRide.dropoffLocation,
                    pushTokens: subscribers.pushTokens,
                    rideID,
                  });
                  this.addPushTickets(res);
                }
                this.clearSubscribers(rideID);
              } else {
                await getDBInWorker(this.env)
                  .update(rides)
                  .set({ numPickedUp })
                  .where(eq(rides.id, rideID));
                this.sendRouteUpdate(rideID, "in progress");
              }
            }
          }
        }

        if (stopType === "dropoff") {
          await setDropoffStopState(stopID, stopState, this.env);

          if (rideID) {
            if (stopState === "arrived") {
              // the end of the ride, record time for metrics
              this.sendRouteUpdate(rideID, "dropped off");
              await getDBInWorker(this.env)
                .update(rides)
                .set({ actualDropoffTime: stop.actualArrivalTime })
                .where(eq(rides.dropoffStopID, stopID));
            }
            if (stopState === "departed") {
              // send feedback notification
              const subscribers = this.getSubscribers(rideID);
              if (subscribers) {
                const res = await sendRideFeedbackNotification({
                  pushTokens: subscribers.pushTokens,
                  rideID,
                });
                this.addPushTickets(res);
              }

              await getDBInWorker(this.env)
                .update(rides)
                .set({ shareCode: null })
                .where(eq(rides.dropoffStopID, stopID));
              this.streams
                .get(rideID)
                ?.forEach((ws) => ws.close(1000, `Complete: ${rideID}`));
              this.streams.delete(rideID);
              this.clearSubscribers(rideID);
            }
          }
        }
      }
    }
  }

  sendRouteUpdate(rideID: string, rideState: InProgressRideState) {
    this.sendEvent("routeUpdate", { rideState }, rideID);
  }

  vehicleInfoShort(vehicle: Vehicle): VehicleInfoShort {
    let vehicleName: string;
    if (vehicle.type === "vehicle") {
      vehicleName = `${vehicle.year} ${vehicle.make} ${vehicle.model}`;
    } else {
      vehicleName = "Cart";
    }

    const vehicleInfo = {
      name: vehicleName,
      licensePlate: vehicle.licensePlate,
      adaAccessible: vehicle.adaAccessible,
    };

    return vehicleInfo;
  }

  sendVehicleInfo(rideID: string, vehicle: Vehicle) {
    const vehicleInfo = this.vehicleInfoShort(vehicle);
    this.sendEvent("vehicleInfo", vehicleInfo, rideID);
  }

  async pollAssetLocations(): Promise<Samsara.InlineResponse2002> {
    const result = await getAssetLocations();
    return result;
  }

  async pollVehicleLocations(): Promise<Samsara.VehicleLocationsListResponse> {
    const result = await getVehicleLocations();
    return result;
  }

  async pollRouteUpdates(): Promise<Samsara.RoutesGetRoutesFeedResponseBody> {
    const endCursor = await this.ctx.storage.get<string>(
      "routeUpdatesEndCursor",
    );
    const result = await getRouteUpdates(endCursor);
    await this.ctx.storage.put(
      "routeUpdatesEndCursor",
      result.pagination.endCursor,
    );
    return result;
  }

  async pollAssignmentChanges(): Promise<Samsara.RoutesFetchRoutesResponseBody> {
    const result = await fetchCurrentRoutes();
    return result;
  }

  async afterCancelRide(
    ride: Exclude<Awaited<ReturnType<typeof getActiveRideByUserID>>, undefined>,
  ): Promise<void> {
    // called from the Next.js worker, make sure to disconnect all connections
    this.streams
      .get(ride.id)
      ?.forEach((ws) => ws.close(1000, "Ride cancelled."));
    this.streams.delete(ride.id);
    const subscribers = this.getSubscribers(ride.id);
    if (subscribers) {
      const res = await sendCancelledRideNotification({
        pushTokens: subscribers.pushTokens,
        rideID: ride.id,
        isLeader: subscribers.isLeader,
      });
      this.addPushTickets(res);
    }
    this.clearSubscribers(ride.id);
  }
}
