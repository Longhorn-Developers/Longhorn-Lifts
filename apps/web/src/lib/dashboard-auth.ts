"use server";

import "server-only";

import { and, eq } from "drizzle-orm";
import jwt from "jsonwebtoken";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import z from "zod";

import { hashString } from "./auth";
import { getDB } from "./db";
import { admins } from "./db/schema/admins";

const SESSION_TTL = 30;

export const generateSession = async (adminID: string, expiresIn: number) => {
  const payload = { adminID };
  return jwt.sign(payload, process.env.JWT_SECRET!, {
    expiresIn,
  });
};

export const verifySession = async (session: string) => {
  try {
    const payload = jwt.verify(session, process.env.JWT_SECRET!) as {
      adminID: string;
    };
    const adminID = payload.adminID;
    return { adminID, valid: true };
  } catch {
    return { valid: false };
  }
};

export const createSession = async (adminID: string) => {
  const expiresIn = SESSION_TTL * 24 * 60 * 60;
  const session = await generateSession(adminID, expiresIn);
  const cookieStore = await cookies();

  cookieStore.set("session", session, {
    httpOnly: true,
    secure: true,
    maxAge: expiresIn,
    sameSite: "lax",
    path: "/",
  });
};

const loginBody = z.object({
  email: z.email({ error: "Please enter a valid email." }).trim().toLowerCase(),
  password: z
    .string()
    .min(8, { error: "Password must be at least 8 characters long. " }),
});

export type FormState =
  | { errors?: { email?: string[]; password?: string[] }; message?: string }
  | undefined;

export const login = async (_: FormState, formData: FormData) => {
  const validation = loginBody.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!validation.success) {
    return {
      errors: validation.error.flatten().fieldErrors,
    };
  }

  const { email, password } = validation.data;
  const hash = hashString(password);

  const admin = await getDB()
    .select()
    .from(admins)
    .where(and(eq(admins.email, email), eq(admins.hash, hash)))
    .then((res) => res.shift());

  if (!admin) {
    return { message: "Invalid email / password." };
  }

  await createSession(admin.id);
  redirect("/dashboard");
};

export const logout = async () => {
  const cookieStore = await cookies();
  cookieStore.delete("session");
  redirect("/");
};
