import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { prisma } from "@/lib/db/prisma";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_req: Request, { params }: RouteParams) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const coverLetter = await prisma.coverLetter.findFirst({
    where: { id, userId: session.user.id },
  });

  if (!coverLetter)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(coverLetter);
}

export async function PUT(req: Request, { params }: RouteParams) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const { title, content, jobTitle, company } = body;

  const existing = await prisma.coverLetter.findFirst({
    where: { id, userId: session.user.id },
  });

  if (!existing)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const coverLetter = await prisma.coverLetter.update({
    where: { id },
    data: {
      ...(title !== undefined && { title }),
      ...(content !== undefined && { content }),
      ...(jobTitle !== undefined && { jobTitle }),
      ...(company !== undefined && { company }),
    },
  });

  return NextResponse.json(coverLetter);
}

export async function DELETE(_req: Request, { params }: RouteParams) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const existing = await prisma.coverLetter.findFirst({
    where: { id, userId: session.user.id },
  });

  if (!existing)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.coverLetter.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
