import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { dialog } from 'electron';

export type ProcessedPdf = {
  id: string;
  name: string;
  storedPath: string;
  sourceUrl: string;
  hash: string;
  pageCount: number;
  pages: Array<{ page: number; text: string; imageUrl: string | null; imagePath: string | null }>;
  warnings: string[];
};

const toAssetUrl = (relativePath: string) =>
  `gate-helper://asset/${relativePath.split(path.sep).map(encodeURIComponent).join('/')}`;

export class PdfService {
  constructor(private readonly libraryRoot: string) {}

  async choosePdf(title: string) {
    const result = await dialog.showOpenDialog({
      title,
      properties: ['openFile'],
      filters: [{ name: 'PDF documents', extensions: ['pdf'] }],
    });
    return result.canceled ? null : result.filePaths[0] ?? null;
  }

  async processPdf(sourcePath: string, category: 'tests' | 'documents'): Promise<ProcessedPdf> {
    const sourceStats = await fs.stat(sourcePath);
    const maximumBytes = 100 * 1024 * 1024;
    if (!sourceStats.isFile()) throw new Error('The selected path is not a regular file.');
    if (sourceStats.size > maximumBytes) throw new Error('The selected PDF is larger than the 100 MB safety limit.');
    const bytes = await fs.readFile(sourcePath);
    if (bytes.length === 0) throw new Error('The selected PDF is empty.');
    const hash = createHash('sha256').update(bytes).digest('hex');
    const id = randomUUID();
    const relativeDirectory = path.join(category, id);
    const outputDirectory = path.join(this.libraryRoot, relativeDirectory);
    const pagesDirectory = path.join(outputDirectory, 'pages');
    await fs.mkdir(pagesDirectory, { recursive: true });
    const safeName = path.basename(sourcePath).replace(/[^a-zA-Z0-9._ -]/g, '_');
    const storedPath = path.join(outputDirectory, safeName);
    await fs.copyFile(sourcePath, storedPath);

    const warnings: string[] = [];
    try {
      const [canvasModule, pdfModule] = await Promise.all([
        import('@napi-rs/canvas'),
        import('pdfjs-dist/legacy/build/pdf.mjs'),
      ]);
      const { createCanvas, DOMMatrix, ImageData, Path2D } = canvasModule;
      Object.assign(globalThis, { DOMMatrix, ImageData, Path2D });
      const { getDocument } = pdfModule;
      const loadingTask = getDocument({ data: new Uint8Array(bytes), useSystemFonts: true });
      const document = await loadingTask.promise;
      const pageCount = document.numPages;
      if (pageCount === 0) throw new Error('The selected PDF contains no pages.');
      if (pageCount > 500) throw new Error('The selected PDF exceeds the 500-page safety limit.');
      const pages: ProcessedPdf['pages'] = [];
      for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
        const page = await document.getPage(pageNumber);
        const textContent = await page.getTextContent();
        const text = textContent.items
          .map((item) => ('str' in item ? item.str : ''))
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim();
        let imageUrl: string | null = null;
        let imagePath: string | null = null;
        try {
          const viewport = page.getViewport({ scale: 1.6 });
          const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
          const context = canvas.getContext('2d');
          await page.render({
            canvas: canvas as never,
            canvasContext: context as never,
            viewport,
          }).promise;
          const imageName = `${pageNumber}.png`;
          imagePath = path.join(pagesDirectory, imageName);
          await fs.writeFile(imagePath, await canvas.encode('png'));
          imageUrl = toAssetUrl(path.join(relativeDirectory, 'pages', imageName));
        } catch (error) {
          warnings.push(`Page ${pageNumber} preview could not be rendered: ${error instanceof Error ? error.message : 'unknown error'}`);
        }
        if (!text) warnings.push(`Page ${pageNumber} has no extractable text and may require OCR or manual transcription.`);
        pages.push({ page: pageNumber, text, imageUrl, imagePath });
      }
      await loadingTask.destroy();
      return {
        id,
        name: safeName,
        storedPath,
        sourceUrl: toAssetUrl(path.join(relativeDirectory, safeName)),
        hash,
        pageCount,
        pages,
        warnings,
      };
    } catch (error) {
      await fs.rm(outputDirectory, { recursive: true, force: true });
      throw new Error(`Could not process PDF: ${error instanceof Error ? error.message : 'unknown error'}`, { cause: error });
    }
  }

  async discard(pdf: ProcessedPdf) {
    const target = path.dirname(pdf.storedPath);
    const root = path.resolve(this.libraryRoot);
    const resolved = path.resolve(target);
    if (!resolved.startsWith(`${root}${path.sep}`)) {
      throw new Error('Refusing to remove a file outside the managed document library.');
    }
    await fs.rm(resolved, { recursive: true, force: true });
  }

  async discardByAssetUrl(assetUrl: string) {
    const url = new URL(assetUrl);
    if (url.protocol !== 'gate-helper:' || url.hostname !== 'asset') {
      throw new Error('The document does not reference a managed asset.');
    }
    const relative = decodeURIComponent(url.pathname).replace(/^\/+/, '');
    const filePath = path.resolve(this.libraryRoot, relative);
    const root = path.resolve(this.libraryRoot);
    if (!filePath.startsWith(`${root}${path.sep}`)) {
      throw new Error('Refusing to remove a file outside the managed document library.');
    }
    await fs.rm(path.dirname(filePath), { recursive: true, force: true });
  }

  static joinPageText(pdf: ProcessedPdf) {
    return pdf.pages.map((page) => `[PAGE ${page.page}]\n${page.text}`).join('\n\n');
  }

  static async pageImageBase64(page: ProcessedPdf['pages'][number]) {
    if (!page.imagePath) throw new Error(`Page ${page.page} has no rendered image available for OCR.`);
    return (await fs.readFile(page.imagePath)).toString('base64');
  }

  static chunkPages(pdf: ProcessedPdf, maxCharacters = 1800) {
    const chunks: Array<{ page: number; text: string }> = [];
    for (const page of pdf.pages) {
      const paragraphs = page.text.split(/(?<=[.!?])\s+/);
      let current = '';
      for (const paragraph of paragraphs) {
        if (current && current.length + paragraph.length > maxCharacters) {
          chunks.push({ page: page.page, text: current.trim() });
          current = '';
        }
        current += `${paragraph} `;
      }
      if (current.trim()) chunks.push({ page: page.page, text: current.trim() });
    }
    return chunks;
  }
}
