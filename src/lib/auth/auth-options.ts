import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import Database from "better-sqlite3";
import { resolve } from "path";
import { randomBytes } from "crypto";

const dbPath = resolve(process.cwd(), "dev.db");

function getDb() {
  return new Database(dbPath);
}

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
          const db = getDb();
          const user = db.prepare(
            "SELECT id, email, name, image, passwordHash FROM User WHERE email = ?"
          ).get(credentials.email) as {
            id: string;
            email: string;
            name: string | null;
            image: string | null;
            passwordHash: string | null;
          } | undefined;
          db.close();

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
      // For Google sign-in, create or update the user in our SQLite DB
      if (account?.provider === "google" && profile?.email) {
        const db = getDb();
        try {
          const existing = db.prepare(
            "SELECT id FROM User WHERE email = ?"
          ).get(profile.email) as { id: string } | undefined;

          if (existing) {
            // Update existing user with Google info
            db.prepare(
              "UPDATE User SET name = COALESCE(?, name), image = COALESCE(?, image), updatedAt = datetime('now') WHERE id = ?"
            ).run(profile.name || null, (profile as Record<string, unknown>).picture || null, existing.id);

            // Set the user.id so JWT callback can use it
            user.id = existing.id;
          } else {
            // Create new user
            const newId = generateCuid();
            const now = new Date().toISOString();
            db.prepare(
              `INSERT INTO User (id, email, name, image, emailVerified, createdAt, updatedAt)
               VALUES (?, ?, ?, ?, ?, ?, ?)`
            ).run(
              newId,
              profile.email,
              profile.name || null,
              (profile as Record<string, unknown>).picture || null,
              now,
              now,
              now
            );
            user.id = newId;
          }

          // Upsert Account record for Google
          const existingAccount = db.prepare(
            "SELECT id FROM Account WHERE provider = ? AND providerAccountId = ?"
          ).get("google", account.providerAccountId) as { id: string } | undefined;

          if (!existingAccount) {
            db.prepare(
              `INSERT INTO Account (id, userId, type, provider, providerAccountId, access_token, refresh_token, expires_at, token_type, scope, id_token)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
            ).run(
              generateCuid(),
              user.id,
              account.type || "oauth",
              "google",
              account.providerAccountId,
              account.access_token || null,
              account.refresh_token || null,
              account.expires_at || null,
              account.token_type || null,
              account.scope || null,
              account.id_token || null
            );
          }
        } catch (err) {
          console.error("Google sign-in DB error:", err);
          return false;
        } finally {
          db.close();
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
