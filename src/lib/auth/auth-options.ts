import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db/prisma";
import { randomBytes } from "crypto";

function generateCuid(): string {
  return "c" + randomBytes(12).toString("hex");
}

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
    newUser: "/onboarding",
  },
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    }),
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        try {
          const user = await prisma.user.findUnique({
            where: { email: credentials.email },
            select: { id: true, email: true, name: true, image: true, passwordHash: true },
          });

          if (!user || !user.passwordHash) return null;

          const isValid = await bcrypt.compare(credentials.password, user.passwordHash);
          if (!isValid) return null;

          return { id: user.id, email: user.email, name: user.name, image: user.image };
        } catch (err) {
          console.error("Auth error:", err);
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      // For Google sign-in, create or update the user in the database
      if (account?.provider === "google" && profile?.email) {
        try {
          const existing = await prisma.user.findUnique({
            where: { email: profile.email },
            select: { id: true },
          });

          if (existing) {
            // Update existing user with Google info
            await prisma.user.update({
              where: { id: existing.id },
              data: {
                name: profile.name || undefined,
                image: (profile as Record<string, unknown>).picture as string || undefined,
              },
            });

            // Set the user.id so JWT callback can use it
            user.id = existing.id;
          } else {
            // Create new user
            const newId = generateCuid();
            await prisma.user.create({
              data: {
                id: newId,
                email: profile.email,
                name: profile.name || null,
                image: ((profile as Record<string, unknown>).picture as string) || null,
                emailVerified: new Date(),
              },
            });
            user.id = newId;
          }

          // Upsert Account record for Google
          const existingAccount = await prisma.account.findFirst({
            where: {
              provider: "google",
              providerAccountId: account.providerAccountId,
            },
            select: { id: true },
          });

          if (!existingAccount) {
            await prisma.account.create({
              data: {
                id: generateCuid(),
                userId: user.id,
                type: account.type || "oauth",
                provider: "google",
                providerAccountId: account.providerAccountId,
                access_token: account.access_token || null,
                refresh_token: account.refresh_token || null,
                expires_at: account.expires_at || null,
                token_type: account.token_type || null,
                scope: account.scope || null,
                id_token: account.id_token || null,
              },
            });
          }
        } catch (err) {
          console.error("Google sign-in DB error:", err);
          return false;
        }
      }
      return true;
    },

    async session({ session, token }) {
      if (token.sub && session.user) {
        (session.user as { id: string }).id = token.sub;
      }
      return session;
    },

    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
      }
      return token;
    },
  },
};
