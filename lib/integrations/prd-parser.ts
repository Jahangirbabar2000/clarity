import { prisma } from "@/lib/db/client";

export async function parsePRDBuffer(buffer: Buffer, mimeType: string): Promise<string> {
  if (mimeType === "application/pdf") {
    try {
      const pdfParse = (await import("pdf-parse")).default;
      const data = await pdfParse(buffer);
      return data.text;
    } catch {
      return buffer.toString("utf8");
    }
  }
  return buffer.toString("utf8");
}

export async function getLatestPRD(orgId: string) {
  return prisma.prdUpload.findFirst({
    where: { orgId },
    orderBy: { uploadedAt: "desc" },
  });
}
