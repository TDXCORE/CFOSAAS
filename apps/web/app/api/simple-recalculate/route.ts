import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  try {
    console.log('🚀 Simple recalculate API called');

    const body = await request.json();
    const { invoiceId, companyId } = body;

    console.log('📥 Request parameters:', { invoiceId, companyId });

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

    // Get the invoice
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .select('*')
      .eq('id', invoiceId)
      .eq('company_id', companyId)
      .single();

    if (invoiceError || !invoice) {
      console.error('❌ Invoice not found:', invoiceError);
      return NextResponse.json({
        success: false,
        error: 'Invoice not found'
      }, { status: 404 });
    }

    console.log('📋 Invoice found:', {
      number: invoice.invoice_number,
      amount: invoice.total_amount,
      supplier: invoice.supplier_name
    });

    // Delete existing retentions
    await supabase
      .from('invoice_taxes')
      .delete()
      .eq('invoice_id', invoiceId);

    // Calculate retentions based on invoice amount
    const subtotal = invoice.subtotal || invoice.total_amount / 1.19;
    const totalAmount = invoice.total_amount;

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
      const iva = invoice.total_tax || (totalAmount - subtotal);
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

    console.log('🧮 Calculated retentions:', {
      count: retentions.length,
      total: retentions.reduce((sum, r) => sum + r.tax_amount, 0)
    });

    // Insert retentions
    if (retentions.length > 0) {
      const { error: insertError } = await supabase
        .from('invoice_taxes')
        .insert(retentions);

      if (insertError) {
        console.error('❌ Error inserting retentions:', insertError);
        return NextResponse.json({
          success: false,
          error: insertError.message
        }, { status: 500 });
      }

      // Update invoice total retention
      const totalRetention = retentions.reduce((sum, r) => sum + r.tax_amount, 0);

      await supabase
        .from('invoices')
        .update({ total_retention: totalRetention })
        .eq('id', invoiceId);

      console.log('✅ Retentions calculated and saved');

      return NextResponse.json({
        success: true,
        message: 'Retenciones recalculadas exitosamente',
        retentions: retentions.length,
        total_retention: totalRetention,
        breakdown: {
          retefuente: retentions.filter(r => r.tax_type === 'RETENCION_FUENTE').reduce((sum, r) => sum + r.tax_amount, 0),
          reteica: retentions.filter(r => r.tax_type === 'RETENCION_ICA').reduce((sum, r) => sum + r.tax_amount, 0),
          reteiva: retentions.filter(r => r.tax_type === 'RETENCION_IVA').reduce((sum, r) => sum + r.tax_amount, 0)
        }
      });

    } else {
      console.log('⚠️ No retentions calculated (amount too low or other criteria not met)');

      return NextResponse.json({
        success: true,
        message: 'No se calcularon retenciones (monto no cumple criterios)',
        retentions: 0,
        total_retention: 0
      });
    }

  } catch (error) {
    console.error('Simple recalculation error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}