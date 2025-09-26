/**
 * Temporary API route to recalculate retentions for existing invoices
 * DELETE THIS FILE AFTER RETENTIONS ARE PROCESSED
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { retentionService } from '~/lib/taxes/retention-service';

export async function POST(request: NextRequest) {
  try {
    console.log('🚀 Recalculate retentions API called');

    const body = await request.json();
    const { invoiceId, companyId } = body;

    console.log('📥 Request parameters:', { invoiceId, companyId });

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    let query = supabase
      .from('invoices')
      .select('*')
      .is('deleted_at', null);

    // If specific invoice is requested, filter by it
    if (invoiceId && companyId) {
      query = query
        .eq('id', invoiceId)
        .eq('company_id', companyId);
    } else {
      // Otherwise, process multiple invoices
      query = query.limit(10);
    }

    const { data: invoices, error } = await query;

    if (error) {
      throw error;
    }

    if (!invoices || invoices.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No invoices found to process',
        processed: 0
      });
    }

    console.log(`📋 Processing ${invoices.length} invoices for retention calculation...`);

    let processedCount = 0;
    let errorCount = 0;

    for (const invoice of invoices) {
      try {
        console.log(`🔄 Processing invoice ${invoice.invoice_number}...`);
        console.log(`📋 Invoice data:`, {
          id: invoice.id,
          company_id: invoice.company_id,
          supplier_tax_id: invoice.supplier_tax_id,
          supplier_name: invoice.supplier_name,
          total_amount: invoice.total_amount,
          subtotal: invoice.subtotal,
          has_supplier_tax_id: !!invoice.supplier_tax_id
        });

        // Check if invoice meets minimum threshold
        if (invoice.total_amount < 100000) {
          console.log(`⚠️ Invoice ${invoice.invoice_number} amount (${invoice.total_amount}) below minimum threshold, skipping`);
          continue;
        }

        // Handle missing supplier tax ID
        let supplierTaxId = invoice.supplier_tax_id;
        if (!supplierTaxId || supplierTaxId.trim() === '') {
          // Extract potential NIT from supplier name or use a placeholder
          const nameMatch = invoice.supplier_name?.match(/\b\d{8,10}-?\d?\b/);
          if (nameMatch) {
            supplierTaxId = nameMatch[0];
            console.log(`🔧 Extracted tax ID from supplier name: ${supplierTaxId}`);
          } else {
            // Generate a temporary tax ID based on supplier name
            const hash = invoice.supplier_name?.replace(/\s+/g, '').substring(0, 8) || '12345678';
            supplierTaxId = `${hash}${Math.floor(Math.random() * 10)}-${Math.floor(Math.random() * 10)}`;
            console.log(`🔧 Generated temporary tax ID for supplier: ${supplierTaxId}`);
          }

          // Update invoice with the tax ID
          await supabase
            .from('invoices')
            .update({ supplier_tax_id: supplierTaxId })
            .eq('id', invoice.id);
        }

        // Process retentions using our service
        console.log(`🔧 Calling retentionService.processInvoiceRetentions with tax ID: ${supplierTaxId}...`);
        const updatedInvoice = { ...invoice, supplier_tax_id: supplierTaxId };
        const result = await retentionService.processInvoiceRetentions(
          updatedInvoice,
          invoice.company_id,
          undefined // Use company as customer
        );

        console.log(`🎯 Retention processing result for ${invoice.invoice_number}:`, {
          total_retention: result.total_retention,
          has_breakdown: !!result.retention_breakdown,
          breakdown_summary: result.retention_breakdown ? {
            retefuente_count: result.retention_breakdown.retefuente.length,
            reteica_count: result.retention_breakdown.reteica.length,
            reteiva_count: result.retention_breakdown.reteiva.length,
            total_retentions: result.retention_breakdown.total_retentions
          } : null
        });

        processedCount++;
        console.log(`✅ Processed invoice ${invoice.invoice_number}`);
      } catch (err) {
        errorCount++;
        console.error(`❌ Error processing invoice ${invoice.invoice_number}:`, err);
      }
    }

    const message = invoiceId && companyId
      ? `Retenciones recalculadas para la factura específica`
      : `Processed ${processedCount} invoices successfully`;

    return NextResponse.json({
      success: true,
      message,
      processed: processedCount,
      errors: errorCount,
      invoiceId: invoiceId || null,
      details: {
        total_invoices: invoices.length,
        successful: processedCount,
        failed: errorCount
      }
    });

  } catch (error) {
    console.error('Recalculation error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Use POST to recalculate retentions for existing invoices',
    endpoint: '/api/recalculate-retentions',
    method: 'POST'
  });
}