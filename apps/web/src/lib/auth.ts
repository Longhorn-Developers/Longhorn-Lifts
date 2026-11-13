import crypto from "crypto";
import { eq } from "drizzle-orm";
import jwt from "jsonwebtoken";
import { NextResponse } from "next/server";

import { getDB } from "./db";
import { Account, accounts } from "./db/schema/accounts";
import { refreshTokens } from "./db/schema/refresh-tokens";

export const ACCESS_TOKEN_TTL = "15m";
export const REFRESH_TOKEN_TTL = "30d";

export const hashString = (token: string) => {
  return crypto.createHash("sha256").update(token).digest("hex");
};

export const generateJti = () => {
  return crypto.randomBytes(16).toString("hex");
};

export const generateAccessToken = (account: Account) => {
  const payload = { accountID: account.id };
  return jwt.sign(payload, process.env.JWT_SECRET!, {
    expiresIn: ACCESS_TOKEN_TTL,
  });
};

export const generateRefreshToken = async (account: Account) => {
  const jti = generateJti();
  const payload = { accountID: account.id, jti };
  const token = jwt.sign(payload, process.env.REFRESH_TOKEN_SECRET!, {
    expiresIn: REFRESH_TOKEN_TTL,
  });
  const hash = hashString(token);
  await getDB().insert(refreshTokens).values({
    jti,
    accountID: account.id,
    hash,
  });
  return token;
};

export const rotateRefreshToken = async (jti: string, account: Account) => {
  await getDB().delete(refreshTokens).where(eq(refreshTokens.jti, jti));
  const accessToken = generateAccessToken(account);
  const refreshToken = await generateRefreshToken(account);
  return { accessToken, refreshToken };
};

export interface AccessTokenVerificationResult {
  valid: boolean;
  expired: boolean;
  accountID?: string;
}

export const verifyAccessToken = (
  token: string,
): AccessTokenVerificationResult => {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
      accountID: string;
    };
    return { valid: true, expired: false, accountID: decoded.accountID };
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      return { valid: false, expired: true };
    }
    return { valid: false, expired: false };
  }
};

export const verifyRefreshToken = async (token: string) => {
  try {
    const decoded = jwt.verify(token, process.env.REFRESH_TOKEN_SECRET!) as {
      accountID: string;
      jti: string;
    };
    const hash = hashString(token);
    const { refreshToken, account } = await getDB()
      .select()
      .from(refreshTokens)
      .where(eq(refreshTokens.jti, decoded.jti))
      .leftJoin(accounts, eq(refreshTokens.accountID, accounts.id))
      .then(([result]) => ({
        refreshToken: result.refresh_tokens,
        account: result.accounts,
      }));
    if (!refreshToken || refreshToken.hash !== hash) {
      return null;
    }
    return { refreshToken, account };
  } catch {
    return null;
  }
};

export interface AuthenticationResult {
  success: boolean;
  failResponse?: NextResponse;
  accountID?: string;
}

export const ensureAuthenticated = (request: Request): AuthenticationResult => {
  const authenticationHeader = request.headers.get("authorization") || "";
  const [scheme, token] = authenticationHeader.split(" ");

  if (scheme !== "Bearer" || !token) {
    return {
      success: false,
      failResponse: NextResponse.json(
        { message: "Unauthorized." },
        { status: 401 },
      ),
    };
  }

  const { valid, expired, accountID } = verifyAccessToken(token);
  if (!valid) {
    return {
      success: false,
      failResponse: NextResponse.json(
        { message: expired ? "Token expired." : "Invalid token." },
        { status: 401 },
      ),
    };
  }

  return { success: true, accountID };
};
