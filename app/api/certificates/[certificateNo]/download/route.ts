import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { prisma } from "../../../../../lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: { certificateNo: string } }
) {
  try {
    const { certificateNo } = params;

    // Resolve delegate name, publicId, committee, portfolio, checkedInAt, issuedAt
    // from whichever certificate table holds this certificateNo
    let delegateName = "";
    let publicId = "";
    let committee = "";
    let portfolio = "";
    let checkedInAt: Date | null = null;
    let issuedAt: Date = new Date();

    const individualCert = await prisma.individualCertificate.findUnique({
      where: { certificateNo },
      include: { registration: true }
    });

    if (individualCert) {
      const reg = individualCert.registration;
      delegateName = reg.name;
      publicId = reg.publicId;
      committee = reg.allottedCommittee || reg.committee1 || "";
      portfolio = reg.allottedPortfolio || reg.portfolio1 || "Delegate";
      checkedInAt = reg.checkedInAt;
      issuedAt = individualCert.issuedAt;
    } else {
      const delegateCert = await prisma.delegateCertificate.findUnique({
        where: { certificateNo },
        include: { delegate: { include: { delegation: true } } }
      });

      if (!delegateCert) {
        return new Response("Certificate not found", { status: 404 });
      }

      const del = delegateCert.delegate;
      delegateName = del.name;
      publicId = del.publicId;
      committee = del.allottedCommittee || del.committee1 || del.delegation?.delegationName || "";
      portfolio = del.allottedPortfolio || del.portfolio1 || "Delegate";
      checkedInAt = del.checkedInAt;
      issuedAt = delegateCert.issuedAt;
    }

    // Create PDF
    const pdfDoc = await PDFDocument.create();
    // A4 landscape dimensions: 841.89 x 595.27
    const width = 841.89;
    const height = 595.27;
    const page = pdfDoc.addPage([width, height]);

    // Embed fonts
    const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const fontOblique = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

    // Color Palette
    const creamColor = rgb(253 / 255, 251 / 255, 247 / 255);
    const purpleColor = rgb(76 / 255, 29 / 255, 149 / 255);
    const goldColor = rgb(217 / 255, 160 / 255, 41 / 255);
    const darkGray = rgb(31 / 255, 41 / 255, 55 / 255);
    const lightGray = rgb(107 / 255, 114 / 255, 128 / 255);

    // 1. Draw Cream Background
    page.drawRectangle({ x: 0, y: 0, width, height, color: creamColor });

    // 2. Outer Purple Border
    page.drawRectangle({ x: 20, y: 20, width: width - 40, height: height - 40, borderColor: purpleColor, borderWidth: 3 });

    // 3. Inner Gold Border
    page.drawRectangle({ x: 26, y: 26, width: width - 52, height: height - 52, borderColor: goldColor, borderWidth: 1.5 });

    // Helpers
    const drawCenteredText = (text: string, size: number, y: number, font: any, color: any) => {
      const textWidth = font.widthOfTextAtSize(text, size);
      const x = (width - textWidth) / 2;
      page.drawText(text, { x, y, size, font, color });
    };

    // --- Header Branding ---
    drawCenteredText("INVICTUS MODEL UNITED NATIONS 2026", 14, 490, fontBold, purpleColor);

    // Draw small separator line below branding
    page.drawLine({
      start: { x: width / 2 - 60, y: 475 },
      end: { x: width / 2 + 60, y: 475 },
      color: goldColor,
      thickness: 1
    });

    // --- Title ---
    drawCenteredText("CERTIFICATE OF PARTICIPATION", 32, 410, fontBold, purpleColor);

    // --- Body ---
    drawCenteredText("This certifies that", 16, 350, fontOblique, darkGray);

    // Delegate Name
    drawCenteredText(delegateName, 28, 300, fontBold, purpleColor);

    // Participation details
    drawCenteredText(
      "has successfully participated in the conference in the committee",
      15, 250, fontRegular, darkGray
    );
    drawCenteredText(`${committee} as ${portfolio}`, 16, 220, fontBold, goldColor);

    // --- Metadata Grid ---
    const colY = 110;

    const options: Intl.DateTimeFormatOptions = { year: "numeric", month: "long", day: "numeric" };
    const checkedInDate = checkedInAt ? new Date(checkedInAt) : null;
    const checkedInStr = (checkedInDate && !isNaN(checkedInDate.getTime()))
      ? checkedInDate.toLocaleDateString("en-US", options)
      : "Not checked in";
    const issuedDate = issuedAt ? new Date(issuedAt) : null;
    const issuedStr = (issuedDate && !isNaN(issuedDate.getTime()))
      ? issuedDate.toLocaleDateString("en-US", options)
      : "—";

    // Column 1: Verification & Registration Code
    page.drawText("REGISTRATION CODE", { x: 70, y: colY + 30, size: 10, font: fontBold, color: lightGray });
    page.drawText(publicId, { x: 70, y: colY + 12, size: 12, font: fontRegular, color: darkGray });
    page.drawText("VERIFICATION CODE", { x: 70, y: colY - 10, size: 10, font: fontBold, color: lightGray });
    page.drawText(certificateNo, { x: 70, y: colY - 28, size: 9, font: fontRegular, color: darkGray });

    // Column 2: Check-in Details & Issuance
    const midX = width / 2;
    const drawCenteredGridText = (text: string, size: number, y: number, font: any, color: any) => {
      const textWidth = font.widthOfTextAtSize(text, size);
      page.drawText(text, { x: midX - textWidth / 2, y, size, font, color });
    };
    drawCenteredGridText("CONFERENCE CHECK-IN", 10, colY + 30, fontBold, lightGray);
    drawCenteredGridText(checkedInStr, 12, colY + 12, fontRegular, darkGray);
    drawCenteredGridText("DATE OF ISSUANCE", 10, colY - 10, fontBold, lightGray);
    drawCenteredGridText(issuedStr, 12, colY - 28, fontRegular, darkGray);

    // Column 3: Verification Note
    const rightAlignX = width - 270;
    page.drawText("VERIFICATION STATUS", { x: rightAlignX, y: colY + 30, size: 10, font: fontBold, color: lightGray });
    page.drawText("Officially Issued & Verified", { x: rightAlignX, y: colY + 12, size: 12, font: fontBold, color: purpleColor });
    page.drawText("Invictus MUN Secretariat", { x: rightAlignX, y: colY - 10, size: 10, font: fontBold, color: lightGray });
    page.drawText("Authenticity verifiable online", { x: rightAlignX, y: colY - 28, size: 10, font: fontOblique, color: lightGray });

    // --- Footer ---
    drawCenteredText("Excellence · Diplomacy · Institutional Integrity", 11, 55, fontRegular, purpleColor);

    // Serialize PDF to bytes
    const pdfBytes = await pdfDoc.save();

    return new Response(Buffer.from(pdfBytes) as any, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="invictus-participation-${publicId}.pdf"`,
        "Content-Length": pdfBytes.length.toString()
      }
    });
  } catch (error) {
    console.error("PDF generation failed:", error);
    return new Response("Could not generate PDF certificate", { status: 500 });
  }
}
