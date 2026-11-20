import { sqliteTable, text } from "drizzle-orm/sqlite-core";

export const drivers = sqliteTable("drivers", {
  samsaraID: text("samsara_id").primaryKey(),
  name: text("name").notNull(),
});
