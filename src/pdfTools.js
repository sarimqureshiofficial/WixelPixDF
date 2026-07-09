/**
 * Wixel PixDF - Client-side PDF Utilities using pdf-lib
 */
import { PDFDocument, degrees } from 'pdf-lib';

/**
 * Parses page range string (e.g. "1-3, 5, 8-10") into page indices (0-indexed)
 * @param {string} rangeStr 
 * @param {number} maxPages 
 */
export function parseRanges(rangeStr, maxPages) {
  if (!rangeStr || rangeStr.trim() === '') {
    return Array.from({ length: maxPages }, (_, i) => i);
  }
  
  const pages = new Set();
  const parts = rangeStr.replace(/\s+/g, '').split(',');
  
  for (const part of parts) {
    if (part.includes('-')) {
      const [startStr, endStr] = part.split('-');
      const start = Number(startStr);
      const end = Number(endStr);
      
      if (!isNaN(start) && !isNaN(end)) {
        const from = Math.min(start, end);
        const to = Math.max(start, end);
        for (let i = from; i <= to; i++) {
          if (i >= 1 && i <= maxPages) {
            pages.add(i - 1); // convert to 0-index
          }
        }
      }
    } else {
      const page = Number(part);
      if (!isNaN(page) && page >= 1 && page <= maxPages) {
        pages.add(page - 1);
      }
    }
  }
  return Array.from(pages).sort((a, b) => a - b);
}

/**
 * Merges multiple PDFs into a single PDF
 * @param {File[]} files 
 */
export async function mergePDFs(files) {
  if (files.length === 0) return null;
  
  const mergedPdf = await PDFDocument.create();
  
  for (const file of files) {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await PDFDocument.load(arrayBuffer);
    const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
    copiedPages.forEach((page) => mergedPdf.addPage(page));
  }
  
  const pdfBytes = await mergedPdf.save();
  return new Blob([pdfBytes], { type: 'application/pdf' });
}

/**
 * Extracts specific pages from a PDF and returns the new PDF
 * @param {File} file 
 * @param {string} rangeStr 
 */
export async function splitPDF(file, rangeStr) {
  const arrayBuffer = await file.arrayBuffer();
  const originalPdf = await PDFDocument.load(arrayBuffer);
  const totalPages = originalPdf.getPageCount();
  
  const targetIndices = parseRanges(rangeStr, totalPages);
  
  if (targetIndices.length === 0) {
    throw new Error('No valid pages selected for splitting.');
  }
  
  const newPdf = await PDFDocument.create();
  const copiedPages = await newPdf.copyPages(originalPdf, targetIndices);
  copiedPages.forEach((page) => newPdf.addPage(page));
  
  const pdfBytes = await newPdf.save();
  return new Blob([pdfBytes], { type: 'application/pdf' });
}

/**
 * Converts a list of images into a single PDF document
 * @param {File[]} files 
 * @param {object} options - { pageSize, orientation, margin }
 */
export async function imagesToPDF(files, options) {
  if (files.length === 0) return null;
  
  const pdfDoc = await PDFDocument.create();
  const margin = Number(options.margin || 0);
  const pageSizeOpt = options.pageSize || 'a4';
  const orientation = options.orientation || 'portrait';
  
  for (const file of files) {
    const arrayBuffer = await file.arrayBuffer();
    let pdfImage;
    
    // Check file type to embed correctly
    if (file.type === 'image/png') {
      pdfImage = await pdfDoc.embedPng(arrayBuffer);
    } else {
      pdfImage = await pdfDoc.embedJpg(arrayBuffer);
    }
    
    let pageWidth, pageHeight;
    
    if (pageSizeOpt === 'fit') {
      pageWidth = pdfImage.width + margin * 2;
      pageHeight = pdfImage.height + margin * 2;
    } else {
      // standard sizes (A4: 595.28 x 841.89 pt, Letter: 612 x 792 pt)
      const baseSize = pageSizeOpt === 'letter' ? [612, 792] : [595.28, 841.89];
      pageWidth = orientation === 'landscape' ? baseSize[1] : baseSize[0];
      pageHeight = orientation === 'landscape' ? baseSize[0] : baseSize[1];
    }
    
    const page = pdfDoc.addPage([pageWidth, pageHeight]);
    
    // Fit image inside margins proportionally
    const maxDrawWidth = pageWidth - margin * 2;
    const maxDrawHeight = pageHeight - margin * 2;
    
    const imgRatio = pdfImage.width / pdfImage.height;
    const drawRatio = maxDrawWidth / maxDrawHeight;
    
    let drawWidth, drawHeight;
    if (imgRatio > drawRatio) {
      drawWidth = maxDrawWidth;
      drawHeight = maxDrawWidth / imgRatio;
    } else {
      drawHeight = maxDrawHeight;
      drawWidth = maxDrawHeight * imgRatio;
    }
    
    // Center the image inside the page margin box
    const x = margin + (maxDrawWidth - drawWidth) / 2;
    const y = margin + (maxDrawHeight - drawHeight) / 2;
    
    page.drawImage(pdfImage, {
      x,
      y,
      width: drawWidth,
      height: drawHeight
    });
  }
  
  const pdfBytes = await pdfDoc.save();
  return new Blob([pdfBytes], { type: 'application/pdf' });
}

/**
 * Rotates specific pages of a PDF by a given angle
 * @param {File} file 
 * @param {number} angleDegrees 
 * @param {string} rangeStr 
 */
export async function rotatePDF(file, angleDegrees, rangeStr) {
  const arrayBuffer = await file.arrayBuffer();
  const pdfDoc = await PDFDocument.load(arrayBuffer);
  const totalPages = pdfDoc.getPageCount();
  
  const targetIndices = parseRanges(rangeStr, totalPages);
  const pages = pdfDoc.getPages();
  
  for (const index of targetIndices) {
    const page = pages[index];
    const currentRotation = page.getRotation().angle;
    page.setRotation(degrees((currentRotation + Number(angleDegrees)) % 360));
  }
  
  const pdfBytes = await pdfDoc.save();
  return new Blob([pdfBytes], { type: 'application/pdf' });
}

/**
 * Utility to load a PDF and get its page count
 * @param {File} file 
 */
export async function getPDFPageCount(file) {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await PDFDocument.load(arrayBuffer);
  return pdf.getPageCount();
}
