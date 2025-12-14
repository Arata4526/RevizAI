import * as pdfjsLib from 'pdfjs-dist';
import mammoth from 'mammoth';
import JSZip from 'jszip';

// Configuration du worker pour PDF.js (nécessaire pour le parsing)
// On utilise la version correspondant à l'import dans index.html
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://esm.sh/pdfjs-dist@4.0.379/build/pdf.worker.min.mjs';

export async function parseFile(file: File): Promise<string> {
  const fileType = file.type;
  const fileName = file.name.toLowerCase();

  if (fileType === 'application/pdf' || fileName.endsWith('.pdf')) {
    return await extractTextFromPDF(file);
  } else if (
    fileName.endsWith('.docx') || 
    fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) {
    return await extractTextFromDocx(file);
  } else if (
    fileName.endsWith('.odt') ||
    fileType === 'application/vnd.oasis.opendocument.text'
  ) {
    return await extractTextFromODT(file);
  } else if (
    fileType.startsWith('text/') || 
    fileName.endsWith('.txt') || 
    fileName.endsWith('.md') ||
    fileName.endsWith('.json')
  ) {
    return await extractTextFromTextFile(file);
  } else {
    throw new Error("Format non supporté. Veuillez utiliser PDF, Word (DOCX), ODT, TXT ou MD.");
  }
}

function extractTextFromTextFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      resolve(event.target?.result as string || "");
    };
    reader.onerror = (error) => reject(error);
    reader.readAsText(file);
  });
}

async function extractTextFromDocx(file: File): Promise<string> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value;
  } catch (error) {
    console.error("Erreur lecture DOCX:", error);
    throw new Error("Impossible de lire le fichier Word.");
  }
}

async function extractTextFromODT(file: File): Promise<string> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const zip = new JSZip();
    const loadedZip = await zip.loadAsync(arrayBuffer);
    
    const contentXml = await loadedZip.file("content.xml")?.async("string");
    if (!contentXml) {
        throw new Error("Fichier ODT invalide (content.xml manquant)");
    }
    
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(contentXml, "text/xml");
    
    // Stratégie simple : on récupère tout le texte du corps du document
    // Pour améliorer la lisibilité, on insère des sauts de ligne pour les paragraphes
    const body = xmlDoc.getElementsByTagNameNS("*", "body")[0];
    if (!body) return "";

    let text = "";
    
    const walk = (node: Node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        text += node.nodeValue;
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as Element;
        
        if (el.localName === 'tab') text += '\t';
        if (el.localName === 'line-break') text += '\n';
        
        node.childNodes.forEach(walk);
        
        // Ajout de saut de ligne après paragraphes et titres
        if (el.localName === 'p' || el.localName === 'h') {
          text += '\n';
        }
      }
    };

    walk(body);
    return text;
  } catch (error) {
    console.error("Erreur lecture ODT:", error);
    throw new Error("Impossible de lire le fichier ODT.");
  }
}

async function extractTextFromPDF(file: File): Promise<string> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    // Chargement du document
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;
    
    let fullText = "";
    
    // Itération sur toutes les pages
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      
      // Extraction des chaînes de caractères et concaténation
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ');
      
      fullText += `--- Page ${i} ---\n${pageText}\n\n`;
    }
    
    return fullText;
  } catch (error) {
    console.error("Erreur lors de la lecture du PDF:", error);
    throw new Error("Impossible de lire le fichier PDF. Il est peut-être corrompu ou protégé.");
  }
}