const formatter = Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  hour12: false,
  timeZone: "America/Chicago",
  timeZoneName: "longOffset",
});
const parts = formatter.formatToParts(new Date());

export const dstActive = () => {
  const tzOffset = parts.find((t) => t.type === "timeZoneName")?.value;
  return tzOffset === "GMT-05:00";
};

export const isInHours = () => {
  const startHour = dstActive() ? 20 : 19;
  const endHour = 2;
  const currentHour = parseInt(
    parts.find((t) => t.type === "hour")?.value ?? "0",
  );

  return currentHour >= startHour || currentHour < endHour;
};
