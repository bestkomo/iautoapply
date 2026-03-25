export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

const BASE_URL = process.env.NEXTAUTH_URL || "http://localhost:3001";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const userId = searchParams.get("state");
  const error = searchParams.get("error");

  if (error) {
    return NextResponse.redirect(new URL("/inbox?error=gmail_denied", BASE_URL));
  }

  if (!code || !userId) {
    return NextResponse.redirect(new URL("/inbox?error=gmail_invalid", BASE_URL));
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(new URL("/inbox?error=gmail_config", BASE_URL));
  }

  try {
    // Exchange authorization code for tokens
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: `${BASE_URL}/api/auth/gmail/callback`,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenRes.ok) {
      const errorText = await tokenRes.text();
      console.error("Token exchange failed:", errorText);
      return NextResponse.redirect(new URL("/inbox?error=gmail_token", BASE_URL));
    }

    const tokens = await tokenRes.json();
    const accessToken = tokens.access_token as string;
    const refreshToken = (tokens.refresh_token as string) || null;

    // Store tokens in database using Prisma
    await prisma.user.update({
      where: { id: userId },
      data: {
        gmailAccessToken: accessToken,
        gmailRefreshToken: refreshToken,
        gmailConnectedAt: new Date(),
      },
    });

    return NextResponse.redirect(new URL("/inbox?gmail=connected", BASE_URL));
  } catch (err) {
    console.error("Gmail OAuth callback error:", err);
    return NextResponse.redirect(new URL("/inbox?error=gmail_error", BASE_URL));
  }
}
