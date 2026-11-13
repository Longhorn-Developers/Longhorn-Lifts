import { randomUUID } from "crypto";
import { sqliteTable, text } from "drizzle-orm/sqlite-core";

export const admins = sqliteTable("admins", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => randomUUID()),
  email: text("email").unique().notNull(),
  hash: text("hash").notNull(),
  type: text("type", { enum: ["dispatcher", "developer"] }).notNull(),
});
