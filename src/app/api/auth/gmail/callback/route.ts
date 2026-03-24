export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const userId = searchParams.get("state");
  const error = searchParams.get("error");

  if (error) {
    return NextResponse.redirect(
      new URL("/inbox?error=gmail_denied", "http://localhost:3001")
    );
  }

  if (!code || !userId) {
    return NextResponse.redirect(
      new URL("/inbox?error=gmail_invalid", "http://localhost:3001")
    );
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(
      new URL("/inbox?error=gmail_config", "http://localhost:3001")
    );
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
        redirect_uri: "http://localhost:3001/api/auth/gmail/callback",
        grant_type: "authorization_code",
      }),
    });

    if (!tokenRes.ok) {
      const errorText = await tokenRes.text();
      console.error("Token exchange failed:", errorText);
      return NextResponse.redirect(
        new URL("/inbox?error=gmail_token", "http://localhost:3001")
      );
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

    return NextResponse.redirect(
      new URL("/inbox?gmail=connected", "http://localhost:3001")
    );
  } catch (err) {
    console.error("Gmail OAuth callback error:", err);
    return NextResponse.redirect(
      new URL("/inbox?error=gmail_error", "http://localhost:3001")
    );
  }
}
