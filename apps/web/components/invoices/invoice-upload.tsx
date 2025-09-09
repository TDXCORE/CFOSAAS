/**
 * Invoice Upload Component
 * Manual file upload interface for XML, PDF, and ZIP files
 */

'use client';

import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { 
  Upload, 
  FileText, 
  Archive, 
  Image, 
  AlertCircle, 
  CheckCircle2, 
  Loader2,
  X 
} from 'lucide-react';
import { Button } from '@kit/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@kit/ui/card';
// Simple progress component since @kit/ui doesn't export Progress
const Progress = ({ value, className }: { value: number; className?: string }) => (
  <div className={`w-full bg-gray-200 rounded-full h-1 ${className}`}>
    <div 
      className="bg-blue-600 h-1 rounded-full transition-all duration-300" 
      style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
    />
  </div>
);
import { Alert, AlertDescription } from '@kit/ui/alert';
import { Badge } from '@kit/ui/badge';
import { toast } from 'sonner';
import { useCurrentCompany } from '~/lib/companies/tenant-context';
import type { FileUploadProgress, InvoiceFileUpload } from '~/lib/invoices/types';

interface InvoiceUploadProps {
  onUploadComplete?: (invoiceIds: string[]) => void;
  maxFiles?: number;
  allowedTypes?: ('xml' | 'pdf' | 'zip')[];
}

export function InvoiceUpload({ 
  onUploadComplete, 
  maxFiles = 10,
  allowedTypes = ['xml', 'pdf', 'zip']
}: InvoiceUploadProps) {
  const [uploadFiles, setUploadFiles] = useState<FileUploadProgress[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const currentCompany = useCurrentCompany();

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (!currentCompany) {
      toast.error('Please select a company first');
      return;
    }

    if (acceptedFiles.length === 0) return;

    // Initialize upload progress
    const fileProgresses: FileUploadProgress[] = acceptedFiles.map(file => ({
      file_name: file.name,
      progress: 0,
      status: 'uploading',
    }));

    setUploadFiles(fileProgresses);
    setIsUploading(true);

    const processedInvoiceIds: string[] = [];

    try {
      // Process files sequentially using the new API
      for (let i = 0; i < acceptedFiles.length; i++) {
        const file = acceptedFiles[i];

        // Update progress to processing
        setUploadFiles(prev => prev.map((f, idx) => 
          idx === i ? { ...f, status: 'processing', progress: 50 } : f
        ));

        try {
          // Call the new processing API
          const formData = new FormData();
          formData.append('file', file);
          formData.append('companyId', currentCompany.id);

          const response = await fetch('/api/invoices/process', {
            method: 'POST',
            body: formData,
          });

          const result = await response.json();

          if (!response.ok || !result.success) {
            throw new Error(result.error || 'Processing failed');
          }

          // Handle the response based on file type
          if (result.results && result.results.length > 0) {
            const fileResult = result.results[0];
            
            if (fileResult.success) {
              // Success - extract invoice IDs
              if (fileResult.invoice?.id) {
                processedInvoiceIds.push(fileResult.invoice.id);
              }

              setUploadFiles(prev => prev.map((f, idx) => 
                idx === i ? { 
                  ...f, 
                  status: 'completed', 
                  progress: 100,
                  invoice_id: fileResult.invoice?.id || fileResult.fileName,
                  metadata: fileResult.metadata,
                  aiInsights: fileResult.metadata?.aiInsights
                } : f
              ));

              // Show AI insights if available
              if (fileResult.metadata?.aiInsights) {
                toast.success(`File processed successfully! AI insights: ${fileResult.metadata.aiInsights.slice(0, 100)}...`);
              }

            } else {
              // Processing failed
              throw new Error(fileResult.error || 'Processing failed');
            }
          } else {
            throw new Error('No processing results returned');
          }

        } catch (error) {
          console.error(`Error processing file ${file.name}:`, error);
          
          setUploadFiles(prev => prev.map((f, idx) => 
            idx === i ? { 
              ...f, 
              status: 'error', 
              progress: 100,
              error: error instanceof Error ? error.message : 'Processing failed'
            } : f
          ));
        }
      }

      // Show final success message
      if (processedInvoiceIds.length > 0) {
        toast.success(`Upload complete! ${processedInvoiceIds.length} invoice(s) processed successfully`);
        onUploadComplete?.(processedInvoiceIds);
      }

    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Upload failed: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setIsUploading(false);
    }
  }, [currentCompany, onUploadComplete]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/xml': ['.xml'],
      'text/xml': ['.xml'],
      'application/pdf': ['.pdf'],
      'application/zip': ['.zip'],
      'application/x-zip-compressed': ['.zip'],
    },
    maxFiles,
    disabled: isUploading,
  });

  const removeFile = (index: number) => {
    setUploadFiles(prev => prev.filter((_, i) => i !== index));
  };

  const clearAll = () => {
    setUploadFiles([]);
  };

  return (
    <div className="space-y-6">
      {/* Upload Dropzone */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Upload className="h-5 w-5" />
            <span>Upload Invoices</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div
            {...getRootProps()}
            className={`
              border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
              ${isDragActive ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}
              ${isUploading ? 'pointer-events-none opacity-50' : ''}
            `}
          >
            <input {...getInputProps()} />
            
            <div className="flex flex-col items-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <Upload className="w-8 h-8 text-primary" />
              </div>
              
              <div className="space-y-2">
                <p className="text-lg font-medium">
                  {isDragActive ? 'Drop files here' : 'Upload invoice files'}
                </p>
                <p className="text-sm text-muted-foreground">
                  Drag and drop files here, or click to browse
                </p>
                <p className="text-xs text-muted-foreground">
                  Supports XML, PDF, and ZIP files (max {maxFiles} files)
                </p>
              </div>

              <div className="flex items-center space-x-4 text-xs text-muted-foreground">
                <div className="flex items-center space-x-1">
                  <FileText className="w-4 h-4" />
                  <span>XML</span>
                </div>
                <div className="flex items-center space-x-1">
                  <Image className="w-4 h-4" />
                  <span>PDF</span>
                </div>
                <div className="flex items-center space-x-1">
                  <Archive className="w-4 h-4" />
                  <span>ZIP</span>
                </div>
              </div>
            </div>
          </div>

          {/* Supported Formats Info */}
          <div className="mt-4 p-3 bg-muted/50 rounded-lg">
            <h4 className="font-medium text-sm mb-2">Supported Formats:</h4>
            <ul className="text-xs text-muted-foreground space-y-1">
              <li>• <strong>XML:</strong> Colombian UBL electronic invoices (automatic processing)</li>
              <li>• <strong>PDF:</strong> Scanned invoices (manual entry required)</li>
              <li>• <strong>ZIP:</strong> Multiple invoices in compressed format</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Upload Progress */}
      {uploadFiles.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Upload Progress</CardTitle>
            {!isUploading && (
              <Button variant="outline" size="sm" onClick={clearAll}>
                Clear All
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-3">
            {uploadFiles.map((file, index) => (
              <FileUploadItem
                key={index}
                file={file}
                onRemove={() => removeFile(index)}
                showRemove={!isUploading}
              />
            ))}
          </CardContent>
        </Card>
      )}

      {/* Instructions */}
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          <strong>Processing Notes:</strong> XML files will be automatically processed and classified. 
          PDF files will require manual data entry. ZIP files containing multiple invoices will be 
          extracted and processed individually.
        </AlertDescription>
      </Alert>
    </div>
  );
}

// File Upload Item Component
interface FileUploadItemProps {
  file: FileUploadProgress;
  onRemove: () => void;
  showRemove: boolean;
}

function FileUploadItem({ file, onRemove, showRemove }: FileUploadItemProps) {
  const getFileIcon = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'xml': return <FileText className="w-4 h-4 text-blue-500" />;
      case 'pdf': return <Image className="w-4 h-4 text-red-500" />;
      case 'zip': return <Archive className="w-4 h-4 text-yellow-500" />;
      default: return <FileText className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusIcon = () => {
    switch (file.status) {
      case 'uploading': return <Loader2 className="w-4 h-4 animate-spin text-blue-500" />;
      case 'processing': return <Loader2 className="w-4 h-4 animate-spin text-orange-500" />;
      case 'completed': return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case 'error': return <AlertCircle className="w-4 h-4 text-red-500" />;
    }
  };

  const getStatusText = () => {
    switch (file.status) {
      case 'uploading': return 'Uploading...';
      case 'processing': return 'Processing...';
      case 'completed': return 'Completed';
      case 'error': return 'Error';
    }
  };

  return (
    <div className="flex items-center space-x-3 p-3 border rounded-lg">
      {getFileIcon(file.file_name)}
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <p className="text-sm font-medium truncate">{file.file_name}</p>
          <div className="flex items-center space-x-2">
            <Badge variant={file.status === 'completed' ? 'default' : 
                           file.status === 'error' ? 'destructive' : 'secondary'}>
              {getStatusText()}
            </Badge>
            {showRemove && (
              <Button variant="ghost" size="sm" onClick={onRemove}>
                <X className="w-3 h-3" />
              </Button>
            )}
          </div>
        </div>
        
        {file.status !== 'error' && (
          <Progress value={file.progress} className="h-1" />
        )}
        
        {file.error && (
          <p className="text-xs text-red-500 mt-1">{file.error}</p>
        )}
        
        {file.invoice_id && (
          <p className="text-xs text-green-600 mt-1">
            Invoice created: {file.invoice_id.slice(0, 8)}...
          </p>
        )}
      </div>
      
      <div className="flex-shrink-0">
        {getStatusIcon()}
      </div>
    </div>
  );
}

// Helper functions
function getFileType(file: File): 'xml' | 'pdf' | 'zip' | 'unknown' {
  const ext = file.name.split('.').pop()?.toLowerCase();
  
  if (ext === 'xml' || file.type.includes('xml')) return 'xml';
  if (ext === 'pdf' || file.type === 'application/pdf') return 'pdf';
  if (ext === 'zip' || file.type.includes('zip')) return 'zip';
  
  return 'unknown';
}

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}