import { jsPDF } from "jspdf";

export const generatePDF = (title: string, content: string) => {
  const doc = new jsPDF();
  
  // Configuration
  const margin = 20;
  const pageWidth = doc.internal.pageSize.getWidth();
  const maxLineWidth = pageWidth - margin * 2;
  let cursorY = 20;

  // Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(79, 70, 229); // Indigo color
  
  // Split title if too long
  const titleLines = doc.splitTextToSize(title, maxLineWidth);
  doc.text(titleLines, margin, cursorY);
  cursorY += titleLines.length * 10 + 10;

  // Subtitle / Header
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139); // Slate-500
  doc.text(`Généré par RévizIA - ${new Date().toLocaleDateString()}`, margin, cursorY);
  cursorY += 15;

  // Separator
  doc.setDrawColor(226, 232, 240);
  doc.line(margin, cursorY - 5, pageWidth - margin, cursorY - 5);
  cursorY += 5;

  // Content
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42); // Slate-900

  // Nettoyage basique du markdown pour le PDF (retirer les ** ou ## excessifs pour la lisibilité brute)
  // Note: jsPDF ne rend pas le Markdown, on fait un rendu texte propre.
  const cleanContent = content
    .replace(/\*\*/g, "") // Bold markers
    .replace(/##/g, "")   // Header markers
    .replace(/^#\s/gm, "")
    .replace(/`/g, "");

  const lines = doc.splitTextToSize(cleanContent, maxLineWidth);

  // Pagination loop
  const pageHeight = doc.internal.pageSize.getHeight();
  
  lines.forEach((line: string) => {
    if (cursorY + 10 > pageHeight - margin) {
      doc.addPage();
      cursorY = margin;
    }
    doc.text(line, margin, cursorY);
    cursorY += 6; // Line height
  });

  doc.save(`Fiche_Revision_${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`);
};
