import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import z from "zod";

import { getDB } from "@/lib/db";
import { accounts } from "@/lib/db/schema/accounts";
import { codes } from "@/lib/db/schema/codes";
import { users } from "@/lib/db/schema/users";

const phoneBody = z.object({
  phoneNumber: z.string().min(10, "Phone number must be at least 10 digits."),
});

export async function POST(request: NextRequest) {
  const data = await request.json();
  const validationResult = phoneBody.safeParse(data);

  if (!validationResult.success) {
    return NextResponse.json(
      {
        message: "Invalid request body.",
        errors: validationResult.error.issues,
      },
      { status: 400 },
    );
  }

  const { phoneNumber } = validationResult.data;

  const [existingUser] = await getDB()
    .select()
    .from(users)
    .where(eq(users.phoneNumber, phoneNumber))
    .leftJoin(
      accounts,
      and(eq(users.id, accounts.userID), eq(accounts.signInMethod, "generic")),
    );

  if (!existingUser) {
    return NextResponse.json(
      {
        message: "User not found.",
      },
      { status: 404 },
    );
  }

  const [{ code }] = await getDB()
    .insert(codes)
    .values({ accountID: existingUser.accounts!.id, identifier: phoneNumber })
    .returning({ code: codes.code });

  // TODO: send text
  console.log(code);

  return NextResponse.json({ message: "Verification code sent. ", code });
}
