/**
 * Invoice File Storage Service
 * Handles file uploads, storage, and retrieval for invoice attachments
 */

import { getSupabaseClient } from '../supabase/client-singleton';

type FileUploadResult = {
  success: boolean;
  filePath?: string;
  publicUrl?: string;
  error?: string;
};

type FileMetadata = {
  originalName: string;
  contentType: string;
  size: number;
  companyId: string;
  invoiceId?: string;
  fileType: 'xml' | 'pdf' | 'zip';
};

class InvoiceStorageService {
  private supabase = getSupabaseClient();

  private readonly BUCKET_NAME = 'invoice-files';
  private readonly MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

  /**
   * Upload invoice file to Supabase Storage
   */
  async uploadFile(
    file: File,
    metadata: FileMetadata
  ): Promise<FileUploadResult> {
    try {
      // Validate file size
      if (file.size > this.MAX_FILE_SIZE) {
        return {
          success: false,
          error: `File size exceeds maximum limit of ${this.MAX_FILE_SIZE / 1024 / 1024}MB`,
        };
      }

      // Generate unique file path
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const fileName = this.sanitizeFileName(metadata.originalName);
      const filePath = `${metadata.companyId}/${metadata.fileType}/${timestamp}_${fileName}`;

      // Upload file
      const { data, error } = await this.supabase.storage
        .from(this.BUCKET_NAME)
        .upload(filePath, file, {
          contentType: metadata.contentType,
          metadata: {
            companyId: metadata.companyId,
            invoiceId: metadata.invoiceId || '',
            fileType: metadata.fileType,
            originalName: metadata.originalName,
          },
        });

      if (error) {
        console.error('Storage upload error:', error);
        return {
          success: false,
          error: `Upload failed: ${error.message}`,
        };
      }

      // Get public URL
      const { data: publicData } = this.supabase.storage
        .from(this.BUCKET_NAME)
        .getPublicUrl(data.path);

      return {
        success: true,
        filePath: data.path,
        publicUrl: publicData.publicUrl,
      };

    } catch (error) {
      console.error('File upload error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown upload error',
      };
    }
  }

  /**
   * Download file from storage
   */
  async downloadFile(filePath: string): Promise<{
    success: boolean;
    data?: Blob;
    error?: string;
  }> {
    try {
      const { data, error } = await this.supabase.storage
        .from(this.BUCKET_NAME)
        .download(filePath);

      if (error) {
        return {
          success: false,
          error: `Download failed: ${error.message}`,
        };
      }

      return {
        success: true,
        data,
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Download error',
      };
    }
  }

  /**
   * Delete file from storage
   */
  async deleteFile(filePath: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      const { error } = await this.supabase.storage
        .from(this.BUCKET_NAME)
        .remove([filePath]);

      if (error) {
        return {
          success: false,
          error: `Delete failed: ${error.message}`,
        };
      }

      return { success: true };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Delete error',
      };
    }
  }

  /**
   * Get file metadata from storage
   */
  async getFileMetadata(filePath: string) {
    try {
      const { data, error } = await this.supabase.storage
        .from(this.BUCKET_NAME)
        .list(filePath.split('/').slice(0, -1).join('/'), {
          limit: 100,
          search: filePath.split('/').pop(),
        });

      if (error || !data || data.length === 0) {
        return null;
      }

      const fileData = data[0];
      return {
        name: fileData.name,
        size: fileData.metadata?.size || 0,
        contentType: fileData.metadata?.mimetype || '',
        lastModified: fileData.updated_at,
        metadata: fileData.metadata,
      };

    } catch (error) {
      console.error('Error getting file metadata:', error);
      return null;
    }
  }

  /**
   * List files for a company
   */
  async listCompanyFiles(
    companyId: string,
    fileType?: 'xml' | 'pdf' | 'zip',
    limit = 50
  ) {
    try {
      const path = fileType ? `${companyId}/${fileType}` : companyId;
      
      const { data, error } = await this.supabase.storage
        .from(this.BUCKET_NAME)
        .list(path, {
          limit,
          sortBy: { column: 'updated_at', order: 'desc' },
        });

      if (error) {
        return {
          success: false,
          error: error.message,
          files: [],
        };
      }

      const files = data.map(file => ({
        name: file.name,
        path: `${path}/${file.name}`,
        size: file.metadata?.size || 0,
        contentType: file.metadata?.mimetype || '',
        lastModified: file.updated_at,
        publicUrl: this.supabase.storage
          .from(this.BUCKET_NAME)
          .getPublicUrl(`${path}/${file.name}`).data.publicUrl,
      }));

      return {
        success: true,
        files,
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'List error',
        files: [],
      };
    }
  }

  /**
   * Process ZIP file and extract contents
   */
  async processZipFile(
    zipFile: File,
    metadata: FileMetadata
  ): Promise<{
    success: boolean;
    extractedFiles?: { name: string; content: string; type: string }[];
    error?: string;
  }> {
    try {
      // Import JSZip dynamically to avoid SSR issues
      const JSZip = (await import('jszip')).default;
      
      const zip = new JSZip();
      const zipData = await zip.loadAsync(zipFile);
      const extractedFiles: { name: string; content: string; type: string }[] = [];

      // Process each file in the ZIP
      for (const [filename, file] of Object.entries(zipData.files)) {
        if (file.dir) continue; // Skip directories

        const extension = filename.split('.').pop()?.toLowerCase();
        
        // Only process XML and PDF files
        if (extension === 'xml' || extension === 'pdf') {
          const content = await file.async('string');
          
          extractedFiles.push({
            name: filename,
            content,
            type: extension,
          });

          // Upload extracted file individually
          const extractedBlob = new Blob([content], {
            type: extension === 'xml' ? 'application/xml' : 'application/pdf',
          });
          
          const extractedFile = new File([extractedBlob], filename, {
            type: extractedBlob.type,
          });

          await this.uploadFile(extractedFile, {
            ...metadata,
            originalName: filename,
            fileType: extension as 'xml' | 'pdf',
          });
        }
      }

      return {
        success: true,
        extractedFiles,
      };

    } catch (error) {
      console.error('ZIP processing error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'ZIP processing failed',
      };
    }
  }

  /**
   * Sanitize filename for storage
   */
  private sanitizeFileName(filename: string): string {
    return filename
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .replace(/_{2,}/g, '_')
      .toLowerCase();
  }

  /**
   * Get file type from extension
   */
  getFileType(filename: string): 'xml' | 'pdf' | 'zip' | 'unknown' {
    const ext = filename.split('.').pop()?.toLowerCase();
    
    if (ext === 'xml') return 'xml';
    if (ext === 'pdf') return 'pdf';
    if (ext === 'zip') return 'zip';
    
    return 'unknown';
  }

  /**
   * Validate file type
   */
  isValidFileType(file: File): boolean {
    const allowedTypes = [
      'application/xml',
      'text/xml',
      'application/pdf',
      'application/zip',
      'application/x-zip-compressed',
    ];

    return allowedTypes.includes(file.type) || 
           ['xml', 'pdf', 'zip'].includes(this.getFileType(file.name));
  }

  /**
   * Create storage bucket if it doesn't exist (admin only)
   */
  async initializeBucket(): Promise<{ success: boolean; error?: string }> {
    try {
      // Check if bucket exists
      const { data: buckets } = await this.supabase.storage.listBuckets();
      const bucketExists = buckets?.find(bucket => bucket.name === this.BUCKET_NAME);

      if (!bucketExists) {
        // Create bucket
        const { error } = await this.supabase.storage.createBucket(this.BUCKET_NAME, {
          public: false, // Private bucket - files accessed via signed URLs
          allowedMimeTypes: [
            'application/xml',
            'text/xml',
            'application/pdf',
            'application/zip',
            'application/x-zip-compressed',
          ],
          fileSizeLimit: this.MAX_FILE_SIZE,
        });

        if (error) {
          return {
            success: false,
            error: `Failed to create bucket: ${error.message}`,
          };
        }
      }

      return { success: true };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Bucket initialization error',
      };
    }
  }
}

export const invoiceStorage = new InvoiceStorageService();