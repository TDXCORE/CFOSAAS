import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST() {
  try {
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

    // Insert sample retention records for the specific invoice
    const invoiceId = '5f3a4e03-0a93-48fb-a7a3-54aeb12fd832';
    const companyId = '550e8400-e29b-41d4-a716-446655440000';

    // Delete existing records first
    await supabase
      .from('invoice_taxes')
      .delete()
      .eq('invoice_id', invoiceId);

    // Insert sample retentions
    const retentions = [
      {
        invoice_id: invoiceId,
        company_id: companyId,
        tax_type: 'RETENCION_FUENTE',
        tax_category: 'Servicios',
        taxable_base: 1057038.17,
        tax_rate: 0.11, // 11%
        tax_amount: 116274.20,
        concept_code: '365',
        concept_description: 'Servicios en general',
        threshold_uvt: 27,
        supplier_type: 'Persona Natural',
        verification_status: 'automatic'
      },
      {
        invoice_id: invoiceId,
        company_id: companyId,
        tax_type: 'RETENCION_ICA',
        tax_category: 'Comercial',
        taxable_base: 1057038.17,
        tax_rate: 0.00966, // 9.66 por mil
        tax_amount: 10211.05,
        concept_code: 'ICA001',
        concept_description: 'Actividad comercial general',
        municipality: 'Bogotá',
        supplier_type: 'Persona Natural',
        verification_status: 'automatic'
      },
      {
        invoice_id: invoiceId,
        company_id: companyId,
        tax_type: 'RETENCION_IVA',
        tax_category: 'IVA General',
        taxable_base: 77107.89, // IVA amount
        tax_rate: 0.15, // 15%
        tax_amount: 11566.18,
        concept_code: 'RIV001',
        concept_description: 'Retención IVA 15%',
        supplier_type: 'Persona Natural',
        verification_status: 'automatic'
      }
    ];

    const { error } = await supabase
      .from('invoice_taxes')
      .insert(retentions);

    if (error) {
      console.error('Error inserting retentions:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Update invoice total retention
    const totalRetentions = retentions.reduce((sum, ret) => sum + ret.tax_amount, 0);

    await supabase
      .from('invoices')
      .update({
        total_retention: totalRetentions,
        supplier_tax_id: '80851613-7' // Update with correct NIT
      })
      .eq('id', invoiceId);

    return NextResponse.json({
      success: true,
      message: 'Sample retentions created successfully',
      retentions: retentions.length,
      total_retention: totalRetentions,
      breakdown: {
        retefuente: retentions.filter(r => r.tax_type === 'RETENCION_FUENTE').reduce((sum, r) => sum + r.tax_amount, 0),
        reteica: retentions.filter(r => r.tax_type === 'RETENCION_ICA').reduce((sum, r) => sum + r.tax_amount, 0),
        reteiva: retentions.filter(r => r.tax_type === 'RETENCION_IVA').reduce((sum, r) => sum + r.tax_amount, 0)
      }
    });
  } catch (error) {
    console.error('Error creating sample retentions:', error);
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}