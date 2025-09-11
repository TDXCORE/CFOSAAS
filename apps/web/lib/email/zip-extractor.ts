/**
 * ZIP/RAR Extractor Service
 * Extracts XML and PDF files from compressed attachments received via email
 */

import AdmZip from 'adm-zip';
import StreamZip from 'node-stream-zip';

export interface ExtractedFile {
  name: string;
  extension: string;
  content: Buffer;
  size: number;
  mimeType: string;
  isInvoiceFile: boolean;
}

export interface ExtractionResult {
  success: boolean;
  files: ExtractedFile[];
  errors: string[];
  metadata: {
    totalFiles: number;
    extractedFiles: number;
    skippedFiles: number;
    archiveType: 'zip' | 'rar' | 'unknown';
  };
}

export class ZipExtractorService {
  private readonly ALLOWED_EXTENSIONS = ['.xml', '.pdf', '.xlsx', '.xls'];
  private readonly MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB per file
  private readonly MAX_TOTAL_SIZE = 100 * 1024 * 1024; // 100MB total

  /**
   * Extract files from ZIP/RAR archive
   */
  async extractFiles(archiveBuffer: Buffer, filename: string): Promise<ExtractionResult> {
    const result: ExtractionResult = {
      success: false,
      files: [],
      errors: [],
      metadata: {
        totalFiles: 0,
        extractedFiles: 0,
        skippedFiles: 0,
        archiveType: this.detectArchiveType(filename)
      }
    };

    try {
      // Validate archive size
      if (archiveBuffer.length > this.MAX_TOTAL_SIZE) {
        result.errors.push(`Archive too large: ${archiveBuffer.length} bytes (max: ${this.MAX_TOTAL_SIZE})`);
        return result;
      }

      // Extract based on archive type
      if (result.metadata.archiveType === 'zip') {
        return await this.extractZipFile(archiveBuffer, result);
      } else if (result.metadata.archiveType === 'rar') {
        // RAR support is more complex, for now we'll just handle ZIP
        result.errors.push('RAR files not supported yet. Please use ZIP format.');
        return result;
      } else {
        result.errors.push('Unknown archive format. Only ZIP files are supported.');
        return result;
      }

    } catch (error) {
      result.errors.push(`Extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return result;
    }
  }

  /**
   * Extract ZIP file using AdmZip
   */
  private async extractZipFile(buffer: Buffer, result: ExtractionResult): Promise<ExtractionResult> {
    try {
      const zip = new AdmZip(buffer);
      const entries = zip.getEntries();
      
      result.metadata.totalFiles = entries.length;

      for (const entry of entries) {
        try {
          // Skip directories
          if (entry.isDirectory) {
            result.metadata.skippedFiles++;
            continue;
          }

          const filename = entry.entryName;
          const extension = this.getFileExtension(filename);

          // Check if file type is allowed
          if (!this.isAllowedFileType(extension)) {
            result.metadata.skippedFiles++;
            console.log(`Skipping unsupported file: ${filename}`);
            continue;
          }

          // Check file size
          if (entry.header.size > this.MAX_FILE_SIZE) {
            result.errors.push(`File too large: ${filename} (${entry.header.size} bytes)`);
            result.metadata.skippedFiles++;
            continue;
          }

          // Extract file content
          const content = entry.getData();
          const extractedFile: ExtractedFile = {
            name: filename,
            extension: extension,
            content: content,
            size: entry.header.size,
            mimeType: this.getMimeType(extension),
            isInvoiceFile: this.isInvoiceFile(filename, extension)
          };

          result.files.push(extractedFile);
          result.metadata.extractedFiles++;

          console.log(`✅ Extracted: ${filename} (${entry.header.size} bytes)`);

        } catch (entryError) {
          result.errors.push(`Failed to extract ${entry.entryName}: ${entryError instanceof Error ? entryError.message : 'Unknown error'}`);
          result.metadata.skippedFiles++;
        }
      }

      result.success = result.files.length > 0;
      
      console.log(`🎯 ZIP Extraction Summary:
        - Total files in archive: ${result.metadata.totalFiles}
        - Successfully extracted: ${result.metadata.extractedFiles}
        - Skipped files: ${result.metadata.skippedFiles}
        - Errors: ${result.errors.length}`);

      return result;

    } catch (error) {
      result.errors.push(`ZIP extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return result;
    }
  }

  /**
   * Alternative ZIP extraction using node-stream-zip (for larger files)
   */
  private async extractZipFileStream(buffer: Buffer, result: ExtractionResult): Promise<ExtractionResult> {
    return new Promise((resolve) => {
      try {
        // Create a temporary file-like object from buffer
        const zip = new StreamZip.async({ 
          storeEntries: true,
          data: buffer 
        });

        zip.on('error', (error) => {
          result.errors.push(`Stream ZIP error: ${error.message}`);
          resolve(result);
        });

        zip.on('ready', async () => {
          try {
            const entries = Object.values(zip.entries());
            result.metadata.totalFiles = entries.length;

            for (const entry of entries) {
              try {
                if (entry.isDirectory) {
                  result.metadata.skippedFiles++;
                  continue;
                }

                const extension = this.getFileExtension(entry.name);
                
                if (!this.isAllowedFileType(extension)) {
                  result.metadata.skippedFiles++;
                  continue;
                }

                if (entry.size > this.MAX_FILE_SIZE) {
                  result.errors.push(`File too large: ${entry.name}`);
                  result.metadata.skippedFiles++;
                  continue;
                }

                const content = await zip.entryData(entry.name);
                const extractedFile: ExtractedFile = {
                  name: entry.name,
                  extension: extension,
                  content: Buffer.from(content),
                  size: entry.size,
                  mimeType: this.getMimeType(extension),
                  isInvoiceFile: this.isInvoiceFile(entry.name, extension)
                };

                result.files.push(extractedFile);
                result.metadata.extractedFiles++;

              } catch (entryError) {
                result.errors.push(`Failed to extract ${entry.name}: ${entryError instanceof Error ? entryError.message : 'Unknown error'}`);
                result.metadata.skippedFiles++;
              }
            }

            result.success = result.files.length > 0;
            await zip.close();
            resolve(result);

          } catch (error) {
            result.errors.push(`Stream extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
            resolve(result);
          }
        });

      } catch (error) {
        result.errors.push(`Stream ZIP initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        resolve(result);
      }
    });
  }

  /**
   * Detect archive type from filename
   */
  private detectArchiveType(filename: string): 'zip' | 'rar' | 'unknown' {
    const extension = this.getFileExtension(filename).toLowerCase();
    
    if (extension === '.zip') return 'zip';
    if (['.rar', '.7z'].includes(extension)) return 'rar';
    
    return 'unknown';
  }

  /**
   * Get file extension with dot
   */
  private getFileExtension(filename: string): string {
    const lastDot = filename.lastIndexOf('.');
    return lastDot > -1 ? filename.substring(lastDot).toLowerCase() : '';
  }

  /**
   * Check if file type is allowed for processing
   */
  private isAllowedFileType(extension: string): boolean {
    return this.ALLOWED_EXTENSIONS.includes(extension);
  }

  /**
   * Check if this is likely an invoice file
   */
  private isInvoiceFile(filename: string, extension: string): boolean {
    if (extension === '.xml') {
      // Common patterns for Colombian invoice XML files
      const invoicePatterns = [
        /factura/i,
        /invoice/i,
        /fe_/i, // Facturación Electrónica prefix
        /ubl/i, // UBL format
        /dian/i, // DIAN related
        /fv_/i, // Factura de Venta prefix
      ];
      
      return invoicePatterns.some(pattern => pattern.test(filename));
    }
    
    if (extension === '.pdf') {
      // PDF files are secondary priority (representation, not data)
      return false;
    }
    
    return false;
  }

  /**
   * Get MIME type for file extension
   */
  private getMimeType(extension: string): string {
    const mimeTypes: Record<string, string> = {
      '.xml': 'application/xml',
      '.pdf': 'application/pdf',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.xls': 'application/vnd.ms-excel'
    };
    
    return mimeTypes[extension] || 'application/octet-stream';
  }

  /**
   * Get invoice-specific files only (XMLs)
   */
  getInvoiceFiles(extractedFiles: ExtractedFile[]): ExtractedFile[] {
    return extractedFiles.filter(file => file.isInvoiceFile && file.extension === '.xml');
  }

  /**
   * Get supporting files (PDFs, Excel)
   */
  getSupportingFiles(extractedFiles: ExtractedFile[]): ExtractedFile[] {
    return extractedFiles.filter(file => !file.isInvoiceFile || file.extension !== '.xml');
  }

  /**
   * Validate extracted files for invoice processing
   */
  validateForInvoiceProcessing(extractedFiles: ExtractedFile[]): {
    valid: boolean;
    xmlFiles: ExtractedFile[];
    pdfFiles: ExtractedFile[];
    errors: string[];
  } {
    const xmlFiles = extractedFiles.filter(f => f.extension === '.xml' && f.isInvoiceFile);
    const pdfFiles = extractedFiles.filter(f => f.extension === '.pdf');
    const errors: string[] = [];

    if (xmlFiles.length === 0) {
      errors.push('No XML invoice files found in archive');
    }

    // Validate XML files are not empty
    xmlFiles.forEach(file => {
      if (file.size === 0) {
        errors.push(`Empty XML file: ${file.name}`);
      }
    });

    return {
      valid: errors.length === 0 && xmlFiles.length > 0,
      xmlFiles,
      pdfFiles,
      errors
    };
  }
}

export const zipExtractor = new ZipExtractorService();