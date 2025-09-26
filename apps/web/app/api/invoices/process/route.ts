/**
 * Invoice Processing API Route
 * Handles file upload and XML UBL processing for Colombian invoices
 */

import { NextRequest, NextResponse } from 'next/server';
import { xmlProcessor } from '~/lib/invoices/xml-processor';
import { invoicesService } from '~/lib/invoices/invoices-service';
import { invoiceStorage } from '~/lib/storage/invoice-storage';
import { openaiService } from '~/lib/ai/openai-service';
import { retentionService } from '~/lib/taxes/retention-service';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  console.log('🚀 API ROUTE HIT: Invoice processing request received!');
  try {
    console.log('🚀 Processing invoice upload request...');
    
    // Parse form data
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const companyId = formData.get('companyId') as string;
    
    console.log('📄 File info:', {
      name: file?.name,
      type: file?.type,
      size: file?.size,
      companyId
    });
    
    // Validate input
    if (!file) {
      console.error('❌ No file provided');
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    if (!companyId) {
      console.error('❌ Company ID is required');
      return NextResponse.json(
        { error: 'Company ID is required' },
        { status: 400 }
      );
    }

    // Simple file type validation
    const fileName = file.name.toLowerCase();
    const isValidFile = fileName.endsWith('.xml') || fileName.endsWith('.pdf') || fileName.endsWith('.zip');
    
    if (!isValidFile) {
      console.error('❌ Invalid file type:', fileName);
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
        console.log('📝 Processing XML file...');
        try {
          const content = await file.text();
          console.log('✅ File content loaded, length:', content.length);
          
          const result = await processXMLContent(content, file.name, companyId);
          console.log('✅ XML processing result:', { success: result.success, fileName: result.fileName });
          
          processedFiles.push(result);

          // Skip file storage for now to isolate the issue
          console.log('⚠️ Skipping file storage for debugging');
          
        } catch (xmlError) {
          console.error('❌ Error processing XML:', xmlError);
          processedFiles.push({
            success: false,
            fileName: file.name,
            fileType: 'xml',
            error: xmlError instanceof Error ? xmlError.message : 'Unknown XML processing error',
          });
        }

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
    console.log('🔍 Starting XML content processing...');
    
    // Process XML with the Colombian processor
    console.log('📊 Processing with XML processor...');
    const processingResult = await xmlProcessor.processXMLInvoice(xmlContent);
    console.log('✅ XML processor result:', { 
      hasInvoice: !!processingResult.invoice, 
      hasError: !!processingResult.error,
      validationErrorsCount: processingResult.validationErrors?.length || 0
    });

    if (processingResult.error || !processingResult.invoice) {
      console.error('❌ XML processing failed:', processingResult.error);
      return {
        success: false,
        fileName,
        fileType: 'xml',
        error: processingResult.error || 'No invoice data extracted',
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
    console.log('📋 Invoice data prepared:', {
      invoiceNumber: invoiceData.invoice_number,
      supplierName: invoiceData.supplier_name,
      totalAmount: invoiceData.total_amount
    });

    // Create invoice in database
    console.log('💾 Creating invoice in database...');
    const createResult = await invoicesService.createInvoice(invoiceData, companyId);
    console.log('✅ Database creation result:', { 
      success: !createResult.error, 
      hasData: !!createResult.data,
      error: createResult.error 
    });

    if (createResult.error || !createResult.data) {
      console.error('❌ Database creation failed:', createResult.error);
      return {
        success: false,
        fileName,
        fileType: 'xml',
        error: createResult.error || 'Failed to create invoice in database',
        validationErrors: processingResult.validationErrors,
        metadata: processingResult.metadata,
      };
    }

    // Classify invoice automatically using PUC classifier
    console.log('🏷️ Attempting PUC classification...');
    try {
      const classificationResult = await invoicesService.classifyInvoicePUC(
        createResult.data.id,
        companyId
      );

      if (classificationResult.success) {
        console.log('✅ PUC classification successful:', {
          puc_code: classificationResult.puc_code,
          confidence: classificationResult.confidence
        });
      } else {
        console.log('⚠️ PUC classification failed:', classificationResult.error);
      }
    } catch (classificationError) {
      console.error('❌ Error during PUC classification:', classificationError);
      // Continue without failing the entire operation
    }

    // Calculate retentions automatically using simplified logic
    console.log('📊 Calculating retentions using simplified logic...');
    try {
      await calculateSimpleRetentions(createResult.data.id, companyId, createResult.data);
      console.log('✅ Retentions calculated successfully');
    } catch (retentionError) {
      console.error('❌ Error calculating retentions:', retentionError);
      // Continue without failing the entire operation - retentions can be calculated later manually
    }

    return {
      success: true,
      fileName,
      fileType: 'xml',
      invoice: createResult.data,
      validationErrors: processingResult.validationErrors,
      metadata: processingResult.metadata,
      extractionConfidence: processingResult.metadata.extraction_confidence,
    };

  } catch (error) {
    console.error('❌ Error processing XML content:', error);
    return {
      success: false,
      fileName,
      fileType: 'xml',
      error: error instanceof Error ? error.message : 'Processing failed',
    };
  }
}

/**
 * Calculate simple retentions for newly created invoice
 */
async function calculateSimpleRetentions(invoiceId: string, companyId: string, invoiceData: any) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );

  const subtotal = invoiceData.subtotal || invoiceData.total_amount / 1.19;
  const totalAmount = invoiceData.total_amount;

  console.log('🧮 Calculating retentions for:', {
    invoiceId,
    totalAmount,
    subtotal
  });

  // Simple retention calculations
  let retentions = [];

  // Only calculate retentions for invoices over $100,000
  if (totalAmount >= 100000) {
    // Retención en la Fuente: 11% for services, 3.5% for goods
    const retefuente = Math.floor(subtotal * 0.11); // 11% for services
    retentions.push({
      invoice_id: invoiceId,
      company_id: companyId,
      tax_type: 'RETENCION_FUENTE',
      tax_category: 'Servicios Generales',
      taxable_base: subtotal,
      tax_rate: 0.11,
      tax_amount: retefuente,
      concept_code: '365',
      concept_description: 'Otros servicios',
      verification_status: 'automatic'
    });

    // Retención ICA: 9.66 por mil (only if over $300,000)
    if (totalAmount >= 300000) {
      const reteica = Math.floor(subtotal * 0.00966);
      retentions.push({
        invoice_id: invoiceId,
        company_id: companyId,
        tax_type: 'RETENCION_ICA',
        tax_category: 'Servicios Comerciales',
        taxable_base: subtotal,
        tax_rate: 0.00966,
        tax_amount: reteica,
        concept_code: 'ICA001',
        concept_description: 'Actividad comercial general',
        municipality: 'Bogotá',
        verification_status: 'automatic'
      });
    }

    // Retención IVA: 15% of IVA (if there's IVA)
    const iva = invoiceData.total_tax || (totalAmount - subtotal);
    if (iva > 0 && totalAmount >= 500000) {
      const reteiva = Math.floor(iva * 0.15);
      retentions.push({
        invoice_id: invoiceId,
        company_id: companyId,
        tax_type: 'RETENCION_IVA',
        tax_category: 'IVA General',
        taxable_base: iva,
        tax_rate: 0.15,
        tax_amount: reteiva,
        concept_code: 'RIV001',
        concept_description: 'Retención IVA 15%',
        verification_status: 'automatic'
      });
    }
  }

  console.log('📊 Calculated retentions:', {
    count: retentions.length,
    total: retentions.reduce((sum, r) => sum + r.tax_amount, 0)
  });

  // Insert retentions if any were calculated
  if (retentions.length > 0) {
    const { error: insertError } = await supabase
      .from('invoice_taxes')
      .insert(retentions);

    if (insertError) {
      console.error('❌ Error inserting retentions:', insertError);
      throw new Error(`Failed to insert retentions: ${insertError.message}`);
    }

    // Update invoice total retention
    const totalRetention = retentions.reduce((sum, r) => sum + r.tax_amount, 0);

    const { error: updateError } = await supabase
      .from('invoices')
      .update({ total_retention: totalRetention })
      .eq('id', invoiceId);

    if (updateError) {
      console.error('❌ Error updating invoice total retention:', updateError);
      throw new Error(`Failed to update invoice: ${updateError.message}`);
    }

    console.log('✅ Retentions saved successfully:', {
      count: retentions.length,
      totalRetention
    });
  } else {
    console.log('ℹ️ No retentions calculated (amount below thresholds)');
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