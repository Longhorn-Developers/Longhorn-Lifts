import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import z from "zod";

import { getDB } from "@/lib/db";
import { accounts } from "@/lib/db/schema/accounts";
import { codes } from "@/lib/db/schema/codes";
import { users } from "@/lib/db/schema/users";

const partialUser = z.object({
  firstName: z
    .string()
    .min(1, "First name must be at least 1 character.")
    .max(30, "First name must be at most 30 characters."),
  lastName: z
    .string()
    .min(1, "Last name must be at least 1 character.")
    .max(30, "Last name must be at most 30 characters."),
  eid: z.string().min(4, "EID must be at least 4 characters.").optional(),
  phoneNumber: z.string().min(10, "Phone number must be at least 10 digits."),
  requiresAssistance: z.boolean(),
  userType: z.enum(["ut-affiliated", "guest"]),
});

export async function POST(request: NextRequest) {
  const data = await request.json();
  const validationResult = partialUser.safeParse(data);

  if (!validationResult.success) {
    return NextResponse.json(
      {
        message: "Invalid request body.",
        errors: validationResult.error.issues,
      },
      { status: 400 },
    );
  }

  const {
    firstName,
    lastName,
    eid,
    phoneNumber,
    requiresAssistance,
    userType,
  } = validationResult.data;

  const [existingUser] = await getDB()
    .select()
    .from(users)
    .where(eq(users.phoneNumber, phoneNumber))
    .leftJoin(
      accounts,
      and(eq(users.id, accounts.userID), eq(accounts.signInMethod, "generic")),
    );

  let code;

  // if the phone number is already in use, override this account if the number is succesfully verified
  if (existingUser) {
    [{ code }] = await getDB()
      .insert(codes)
      .values({
        accountID: existingUser.accounts!.id,
        identifier: phoneNumber,
        newFirstName: firstName, // update first and last name only if the phone number is verified
        newLastName: lastName, // avoids updating an already existing user's name with the specific number
        newEid: eid ?? null,
        newRequiresAssistance: requiresAssistance,
        newUserType: userType,
      })
      .returning({ code: codes.code });
  }
  // else, create a new account
  else {
    const [{ insertedID }] = await getDB()
      .insert(users)
      .values({
        firstName,
        lastName,
        eid,
        requiresAssistance,
        userType,
      })
      .returning({ insertedID: users.id });
    const [{ accountID }] = await getDB()
      .insert(accounts)
      .values({ userID: insertedID, signInMethod: "generic" })
      .returning({ accountID: accounts.id });
    [{ code }] = await getDB()
      .insert(codes)
      .values({ accountID, identifier: phoneNumber })
      .returning({ code: codes.code });
  }

  // TODO: send email / text message with the code
  console.log(code);

  return NextResponse.json({ message: "Verification code sent.", code });
}
