import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import z from "zod";

import { generateAccessToken, generateRefreshToken } from "@/lib/auth";
import { getDB } from "@/lib/db";
import { accounts } from "@/lib/db/schema/accounts";
import { codes } from "@/lib/db/schema/codes";
import { users } from "@/lib/db/schema/users";

const codeFormat = z.object({
  code: z.string().length(6, "Code must be 6 characters long."),
});

export async function POST(request: NextRequest) {
  const data = await request.json();
  const validationResult = codeFormat.safeParse(data);

  if (!validationResult.success) {
    return NextResponse.json(
      {
        message: "Invalid request body.",
        errors: validationResult.error.issues,
      },
      { status: 400 },
    );
  }

  const { code } = validationResult.data;
  const [result] = await getDB()
    .select()
    .from(codes)
    .where(eq(codes.code, code))
    .leftJoin(accounts, eq(codes.accountID, accounts.id))
    .leftJoin(users, eq(accounts.userID, users.id));

  if (!result || new Date(result.codes!.expiresAt + "Z") < new Date()) {
    // make timestamp UTC aware
    if (result) {
      await getDB().delete(codes).where(eq(codes.id, result.codes!.id));
    }
    return NextResponse.json(
      { message: "Invalid or expired code." },
      { status: 400 },
    );
  }

  await getDB().delete(codes).where(eq(codes.id, result.codes!.id));
  let [user] = await getDB()
    .update(users)
    .set({ phoneNumber: result.codes!.identifier })
    .where(eq(users.id, result.users!.id))
    .returning();
  if (result.codes.newFirstName) {
    [user] = await getDB()
      .update(users)
      .set({
        firstName: result.codes.newFirstName,
        lastName: result.codes.newLastName!,
        eid: result.codes.newEid,
        requiresAssistance: result.codes.newRequiresAssistance!,
        userType: result.codes.newUserType!,
      })
      .where(eq(users.id, result.users!.id))
      .returning();
  }

  const accessToken = generateAccessToken(result.accounts!);
  const refreshToken = await generateRefreshToken(result.accounts!);

  return NextResponse.json({ accessToken, refreshToken, user });
}
