import InProgressRideState from "@sure-walk/utils/types/in-progress-ride-state";
import Location from "@sure-walk/utils/types/location";
import VehicleInfoShort from "@sure-walk/utils/types/vehicle-info-short";
import {
  WorkflowEntrypoint,
  WorkflowEvent,
  WorkflowStep,
} from "cloudflare:workers";
import {
  ExpoPushMessage,
  ExpoPushReceipt,
  ExpoPushTicket,
} from "expo-server-sdk";

const createRouteUpdatePayload = ({
  rideState,
  pushToken,
  rideID,
  shareCode,
  isLeader,
}: {
  rideState: Extract<InProgressRideState, "assigned" | "en route" | "arrived">;
  pushToken: string;
  rideID: string;
  shareCode: string | null;
  isLeader: boolean;
}): ExpoPushMessage => {
  const messages = {
    assigned: {
      title: "Your ride has a driver",
      body: "Your ride has been assigned a driver. They will be headed towards you soon.",
    },
    "en route": {
      title: "Your ride is on the way",
      body: "Get ready and start heading to your pickup location.",
    },
    arrived: {
      title: "Your ride has arrived",
      body: "Meet your ride at your pickup location. You have 2 minutes before they leave.",
    },
  };

  const { title, body } = messages[rideState];
  const data = {
    route: `/home/current-ride-info${!isLeader ? `?shareCode=${shareCode}` : ""}`,
    rideState,
    eventType: "routeUpdate",
  };

  return {
    title,
    body,
    data,
    to: pushToken,
    priority: "high",
    interruptionLevel: "time-sensitive",
    threadId: rideID,
    channelId: "default",
  };
};

const createVehicleInfoPayload = ({
  vehicleInfo,
  pushToken,
  rideID,
  shareCode,
  isLeader,
}: {
  vehicleInfo: VehicleInfoShort;
  pushToken: string;
  rideID: string;
  shareCode: string | null;
  isLeader: boolean;
}): ExpoPushMessage => {
  const title = "Your vehicle info";
  const body = `Look out for a ${vehicleInfo.name}${vehicleInfo.licensePlate ? `, with the license plate ${vehicleInfo.licensePlate}` : ""}.`;

  const data = {
    route: `/home/current-ride-info${!isLeader ? `?shareCode=${shareCode}` : ""}`,
    vehicleInfo,
    eventType: "vehicleInfo",
  };

  return {
    title,
    body,
    data,
    to: pushToken,
    priority: "high",
    interruptionLevel: "time-sensitive",
    threadId: rideID,
    channelId: "default",
  };
};

const createMissedRidePayload = ({
  pickupLocation,
  dropoffLocation,
  pushToken,
  rideID,
}: {
  pickupLocation: Location;
  dropoffLocation: Location;
  pushToken: string;
  rideID: string;
}): ExpoPushMessage => {
  const title = "You missed your ride";
  const body = "Your ride has left. Please request a new ride.";

  const data = {
    eventType: "missedRide",
    pickupLocation,
    dropoffLocation,
  };

  return {
    title,
    body,
    data,
    to: pushToken,
    priority: "high",
    interruptionLevel: "time-sensitive",
    threadId: rideID,
    channelId: "default",
  };
};

const createCancelledRidePayload = ({
  pushToken,
  rideID,
}: {
  pushToken: string;
  rideID: string;
}): ExpoPushMessage => {
  const title = "Ride cancelled";
  const body = "Your ride was cancelled by the group leader.";

  const data = {
    eventType: "rideCancelled",
  };

  return {
    title,
    body,
    data,
    to: pushToken,
    priority: "high",
    interruptionLevel: "time-sensitive",
    threadId: rideID,
    channelId: "default",
  };
};

const createRideFeedbackPayload = ({
  pushToken,
  rideID,
}: {
  pushToken: string;
  rideID: string;
}): ExpoPushMessage => {
  const title = "Ride complete!";
  const body =
    "Thank you for using Sure Walk! Tap here to submit feedback about your ride.";

  const data = {
    route: `/feedback?rideID=${rideID}`,
    eventType: "rideFeedback",
  };

  return {
    title,
    body,
    data,
    to: pushToken,
    priority: "high",
    threadId: rideID,
    channelId: "default",
  };
};

const chunkMessages = (list: ExpoPushMessage[]) => {
  const result = [];
  for (let i = 0; i < list.length; i += 100) {
    result.push(list.slice(i, i + 100));
  }
  return result;
};

const retryFetch = async <T>(func: () => Promise<T>) => {
  // only 2 retries for the sake of speed
  const retries = 2;
  let currentTry = 0;
  let lastErr: unknown | null = null;
  while (currentTry < retries) {
    try {
      const res = await func();
      return res;
    } catch (err) {
      console.warn(
        `Error occured, retry ${currentTry + 1} / ${retries}: ${err}`,
      );
      lastErr = err;
    }
    currentTry++;
    // sleep 200ms, since we don't have that much time to afford
    // with functions that are being called in the Durable Object
    await new Promise((r) => setTimeout(r, 200));
  }
  throw lastErr;
};

const sendPushNotifications = async (messages: ExpoPushMessage[]) => {
  const response = await retryFetch(
    async () =>
      await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: {
          accept: "application/json",
          "accept-encoding": "gzip, deflate",
          "content-type": "application/json",
        },
        body: JSON.stringify(messages),
      }),
  );

  const data = await response.json();
  return (data as { data: ExpoPushTicket[] }).data;
};

export const fetchPushReceipts = async (ticketIDs: string[]) => {
  const response = await retryFetch(
    async () =>
      await fetch("https://exp.host/--/api/v2/push/getReceipts", {
        method: "POST",
        headers: {
          accept: "application/json",
          "accept-encoding": "gzip, deflate",
          "content-type": "application/json",
        },
        body: JSON.stringify({ ids: ticketIDs }),
      }),
  );

  const data = await response.json();
  return (data as { data: Record<string, ExpoPushReceipt> }).data;
};

const sendMessages = async (messages: ExpoPushMessage[]) => {
  const chunks = chunkMessages(messages);
  const tickets = [];
  for (const chunk of chunks) {
    try {
      const ticketChunk = await sendPushNotifications(chunk);
      console.log("result of sending push messages to Expo:", ticketChunk);
      tickets.push(...ticketChunk);
    } catch (error) {
      console.error(error);
    }
  }

  return tickets;
};

export const sendRouteUpdateNotification = async ({
  rideState,
  pushTokens,
  rideID,
  shareCode,
  isLeader,
}: {
  rideState: Extract<InProgressRideState, "assigned" | "en route" | "arrived">;
  pushTokens: string[];
  rideID: string;
  shareCode: string | null;
  isLeader: boolean[];
}) => {
  const messages = pushTokens.map((pushToken, i) =>
    createRouteUpdatePayload({
      rideState,
      pushToken,
      rideID,
      shareCode,
      isLeader: isLeader[i],
    }),
  );

  return sendMessages(messages);
};

export const sendVehicleInfoNotification = async ({
  vehicleInfo,
  pushTokens,
  rideID,
  shareCode,
  isLeader,
}: {
  vehicleInfo: VehicleInfoShort;
  pushTokens: string[];
  rideID: string;
  shareCode: string | null;
  isLeader: boolean[];
}) => {
  const messages = pushTokens.map((pushToken, i) =>
    createVehicleInfoPayload({
      vehicleInfo,
      pushToken,
      rideID,
      shareCode,
      isLeader: isLeader[i],
    }),
  );

  return sendMessages(messages);
};

export const sendMissedRideNotification = async ({
  pickupLocation,
  dropoffLocation,
  pushTokens,
  rideID,
}: {
  pickupLocation: Location;
  dropoffLocation: Location;
  pushTokens: string[];
  rideID: string;
}) => {
  const messages = pushTokens.map((pushToken) =>
    createMissedRidePayload({
      pickupLocation,
      dropoffLocation,
      pushToken,
      rideID,
    }),
  );

  return sendMessages(messages);
};

export const sendCancelledRideNotification = async ({
  pushTokens,
  rideID,
  isLeader,
}: {
  pushTokens: string[];
  rideID: string;
  isLeader: boolean[];
}) => {
  const messages = pushTokens
    .filter((_, i) => !isLeader[i])
    .map((pushToken) =>
      createCancelledRidePayload({
        pushToken,
        rideID,
      }),
    );

  return sendMessages(messages);
};

export const sendRideFeedbackNotification = async ({
  pushTokens,
  rideID,
}: {
  pushTokens: string[];
  rideID: string;
}) => {
  const messages = pushTokens.map((pushToken) =>
    createRideFeedbackPayload({
      pushToken,
      rideID,
    }),
  );

  return sendMessages(messages);
};

export class PushReceiptsWorkflow extends WorkflowEntrypoint<CloudflareEnv> {
  async run(event: WorkflowEvent<unknown>, step: WorkflowStep) {
    if (event.schedule || (event.payload as { schedule?: boolean }).schedule) {
      await step.do("fetch-push-receipts", async () => {
        const doID = this.env.RIDE_INFO_STREAM.idFromName("global");
        const stub = this.env.RIDE_INFO_STREAM.get(doID);
        await stub.fetchPushReceipts();
      });
    }
  }
}
