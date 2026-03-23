import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { prisma } from "@/lib/db/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sessions = await prisma.interviewSession.findMany({
    where: { userId: session.user.id },
    select: {
      id: true,
      jobTitle: true,
      company: true,
      type: true,
      score: true,
      duration: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return Response.json(sessions);
}
