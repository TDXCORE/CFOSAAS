/**
 * Invoice Processing API Route
 * Handles file upload and XML UBL processing for Colombian invoices
 */

import { NextRequest, NextResponse } from 'next/server';
import { xmlProcessor } from '~/lib/invoices/xml-processor';
import { invoicesService } from '~/lib/invoices/invoices-service';
import { invoiceStorage } from '~/lib/storage/invoice-storage';
import { openaiService } from '~/lib/ai/openai-service';

export async function POST(request: NextRequest) {
  try {
    // Parse form data
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const companyId = formData.get('companyId') as string;
    
    // Validate input
    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    if (!companyId) {
      return NextResponse.json(
        { error: 'Company ID is required' },
        { status: 400 }
      );
    }

    // Validate file type
    if (!invoiceStorage.isValidFileType(file)) {
      return NextResponse.json(
        { error: 'Invalid file type. Only XML, PDF, and ZIP files are supported.' },
        { status: 400 }
      );
    }

    const startTime = Date.now();
    let processedFiles: any[] = [];

    try {
      // Handle different file types
      if (file.name.toLowerCase().endsWith('.zip')) {
        // Process ZIP file
        const zipResult = await invoiceStorage.processZipFile(file, {
          originalName: file.name,
          contentType: file.type,
          size: file.size,
          companyId,
          fileType: 'zip',
        });

        if (!zipResult.success) {
          return NextResponse.json(
            { error: zipResult.error },
            { status: 400 }
          );
        }

        // Process each extracted XML file
        for (const extractedFile of zipResult.extractedFiles || []) {
          if (extractedFile.type === 'xml') {
            const result = await processXMLContent(
              extractedFile.content,
              extractedFile.name,
              companyId
            );
            processedFiles.push(result);
          }
        }

      } else if (file.name.toLowerCase().endsWith('.xml')) {
        // Process single XML file
        const content = await file.text();
        const result = await processXMLContent(content, file.name, companyId);
        processedFiles.push(result);

        // Store the file
        await invoiceStorage.uploadFile(file, {
          originalName: file.name,
          contentType: file.type,
          size: file.size,
          companyId,
          fileType: 'xml',
          invoiceId: result.invoice?.id,
        });

      } else if (file.name.toLowerCase().endsWith('.pdf')) {
        // For PDF files, store and mark for manual processing
        const uploadResult = await invoiceStorage.uploadFile(file, {
          originalName: file.name,
          contentType: file.type,
          size: file.size,
          companyId,
          fileType: 'pdf',
        });

        if (!uploadResult.success) {
          return NextResponse.json(
            { error: uploadResult.error },
            { status: 500 }
          );
        }

        processedFiles.push({
          success: false,
          fileName: file.name,
          fileType: 'pdf',
          message: 'PDF processing not yet implemented. File stored for manual review.',
          requiresManualReview: true,
          filePath: uploadResult.filePath,
        });
      }

      const processingTime = Date.now() - startTime;
      const successCount = processedFiles.filter(f => f.success).length;
      const errorCount = processedFiles.filter(f => !f.success).length;

      // Return processing results
      return NextResponse.json({
        success: successCount > 0,
        summary: {
          totalFiles: processedFiles.length,
          successfullyProcessed: successCount,
          errors: errorCount,
          processingTimeMs: processingTime,
        },
        results: processedFiles,
        timestamp: new Date().toISOString(),
      });

    } catch (processingError) {
      console.error('Processing error:', processingError);
      return NextResponse.json(
        {
          success: false,
          error: 'Error processing file',
          details: processingError instanceof Error ? processingError.message : 'Unknown error',
        },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Invoice processing API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        message: 'There was an error processing your request. Please try again.',
      },
      { status: 500 }
    );
  }
}

/**
 * Process XML content and create invoice record
 */
async function processXMLContent(
  xmlContent: string,
  fileName: string,
  companyId: string
) {
  try {
    // Process XML with the Colombian processor
    const processingResult = await xmlProcessor.processXMLInvoice(xmlContent);

    if (processingResult.error || !processingResult.invoice) {
      return {
        success: false,
        fileName,
        fileType: 'xml',
        error: processingResult.error,
        validationErrors: processingResult.validationErrors,
        metadata: processingResult.metadata,
      };
    }

    // Add file information to invoice data
    const invoiceData = {
      ...processingResult.invoice,
      source_file_name: fileName,
      source_file_type: 'xml' as const,
    };

    // Create invoice in database
    const createResult = await invoicesService.createInvoice(invoiceData, companyId);

    if (createResult.error || !createResult.data) {
      return {
        success: false,
        fileName,
        fileType: 'xml',
        error: createResult.error,
        validationErrors: processingResult.validationErrors,
        metadata: processingResult.metadata,
      };
    }

    // Auto-classify PUC if confidence is high enough
    if (processingResult.metadata.extraction_confidence! > 0.8) {
      await invoicesService.classifyInvoicePUC(createResult.data.id, companyId);
    } else {
      // Mark for manual review if confidence is low
      await invoicesService.markForReview(
        createResult.data.id,
        companyId,
        `Low extraction confidence: ${(processingResult.metadata.extraction_confidence! * 100).toFixed(1)}%`
      );
    }

    // Generate AI analysis if OpenAI is available
    let aiInsights;
    try {
      const analysisPrompt = `Analiza esta factura colombiana y proporciona insights clave:
        
Factura: ${invoiceData.invoice_number}
Proveedor: ${invoiceData.supplier_name} (${invoiceData.supplier_tax_id})
Valor: ${new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(invoiceData.total_amount)}
Fecha: ${invoiceData.issue_date}

Productos/Servicios: ${invoiceData.line_items?.map(item => item.product_name).join(', ') || 'No especificados'}

Proporciona:
1. Clasificación sugerida del gasto
2. Posibles optimizaciones fiscales
3. Alertas o consideraciones importantes`;

      const aiResponse = await openaiService.generateCFOResponse(analysisPrompt, {
        company: { name: 'Current Company', taxId: companyId }
      });

      aiInsights = aiResponse.message;
    } catch (aiError) {
      console.log('AI analysis not available:', aiError);
    }

    return {
      success: true,
      fileName,
      fileType: 'xml',
      invoice: createResult.data,
      validationErrors: processingResult.validationErrors,
      metadata: {
        ...processingResult.metadata,
        aiInsights,
      },
      extractionConfidence: processingResult.metadata.extraction_confidence,
    };

  } catch (error) {
    console.error('Error processing XML content:', error);
    return {
      success: false,
      fileName,
      fileType: 'xml',
      error: error instanceof Error ? error.message : 'Processing failed',
    };
  }
}

// Handle OPTIONS for CORS
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}