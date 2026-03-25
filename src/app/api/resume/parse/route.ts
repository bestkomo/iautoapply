export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get("file") as File;
  if (!file)
    return NextResponse.json({ error: "No file provided" }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());
  let text = "";

  if (file.name.endsWith(".pdf")) {
    try {
      const { extractText } = await import("unpdf");
      const result = await extractText(new Uint8Array(buffer));
      text = result.text || "";
    } catch (pdfErr) {
      console.error("[Parse] PDF parse error:", pdfErr);
      text = "";
    }
  } else if (file.name.endsWith(".docx")) {
    try {
      const mammoth = await import("mammoth");
      const result = await mammoth.extractRawText({ buffer });
      text = result.value;
    } catch {
      text = buffer.toString("utf-8");
    }
  } else if (file.name.endsWith(".txt")) {
    text = buffer.toString("utf-8");
  } else {
    return NextResponse.json(
      { error: "Unsupported file type. Use PDF, DOCX, or TXT." },
      { status: 400 }
    );
  }

  if (!text || text.trim().length < 10) {
    return NextResponse.json(
      { error: "Could not extract text from file." },
      { status: 400 }
    );
  }

  return NextResponse.json({ text });
}
