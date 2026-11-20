import GroupRideMember from "@sure-walk/utils/types/group-ride-member";
import { sql } from "drizzle-orm";
import { index, int, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { v7 } from "uuid";

import { drivers } from "./drivers";
import { locations } from "./locations";
import { UserInfo, users } from "./users";
import { vehicles } from "./vehicles";

const stopStates: [string, ...string[]] = [
  "unassigned",
  "scheduled",
  "en route",
  "arrived",
  "skipped",
  "departed",
];

export const cancellationReasons: [string, ...string[]] = [
  "I didn't need the ride anymore",
  "My ride never came",
  "The estimated wait was too long",
  "Weather improved",
  "Got a different ride",
  "I didn't receive a call",
  "Other",
];

export const rides = sqliteTable(
  "rides",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => v7()),
    samsaraID: text("samsara_id").unique().notNull(),
    userID: text("user_id")
      .references(() => users.id)
      .notNull(),
    userInfoSnapshot: text("user_info_snapshot", { mode: "json" })
      .$type<UserInfo>()
      .notNull(),
    members: text("members", { mode: "json" })
      .$type<GroupRideMember[]>()
      .notNull(),
    pickupLocationID: int("pickup_location_id")
      .references(() => locations.id)
      .notNull(),
    dropoffLocationID: int("dropoff_location_id")
      .references(() => locations.id)
      .notNull(),
    pickupStopID: text("pickup_stop_id").unique().notNull(),
    dropoffStopID: text("dropoff_stop_id").unique().notNull(),
    estPickupTime: text("est_pickup_time").notNull(),
    estDropoffTime: text("est_dropoff_time").notNull(),
    actualPickupTime: text("actual_pickup_time"),
    actualDropoffTime: text("actual_dropoff_time"),
    pickupStopState: text("pickup_stop_state", { enum: stopStates })
      .notNull()
      .default("unassigned"),
    dropoffStopState: text("dropoff_stop_state", { enum: stopStates })
      .notNull()
      .default("unassigned"),
    submittedAt: int("submitted_at", { mode: "timestamp" })
      .default(sql`(unixepoch())`)
      .notNull(),
    vehicleID: text("vehicle_id").references(() => vehicles.samsaraID),
    driverID: text("driver_id").references(() => drivers.samsaraID),
    numPickedUp: int("num_picked_up"),
    shareCode: text("share_code"),
    cancelledTime: text("cancelled_time"),
    cancellationReason: text("cancellation_reason", {
      enum: cancellationReasons,
    }),
    cancellationExtra: text("cancellation_extra"),
  },
  (table) => [index("submitted_at_rides_idx").on(table.submittedAt)],
);

export type Ride = typeof rides.$inferSelect;
