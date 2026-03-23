import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { prisma } from "@/lib/db/prisma";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const resume = await prisma.resume.findFirst({
    where: { id },
  });

  if (!resume)
    return NextResponse.json({ error: "Resume not found" }, { status: 404 });

  if (resume.userId !== session.user.id)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  return NextResponse.json(resume);
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const existing = await prisma.resume.findFirst({ where: { id } });
  if (!existing)
    return NextResponse.json({ error: "Resume not found" }, { status: 404 });
  if (existing.userId !== session.user.id)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { title, templateId, content, tailoredFor, atsScore, language, isDefault } = body;

  if (isDefault) {
    await prisma.resume.updateMany({
      where: { userId: session.user.id, isDefault: true },
      data: { isDefault: false },
    });
  }

  const resume = await prisma.resume.update({
    where: { id },
    data: {
      ...(title !== undefined && { title }),
      ...(templateId !== undefined && { templateId }),
      ...(content !== undefined && { content }),
      ...(tailoredFor !== undefined && { tailoredFor }),
      ...(atsScore !== undefined && { atsScore }),
      ...(language !== undefined && { language }),
      ...(isDefault !== undefined && { isDefault }),
    },
  });

  return NextResponse.json(resume);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const existing = await prisma.resume.findFirst({ where: { id } });
  if (!existing)
    return NextResponse.json({ error: "Resume not found" }, { status: 404 });
  if (existing.userId !== session.user.id)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await prisma.resume.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
