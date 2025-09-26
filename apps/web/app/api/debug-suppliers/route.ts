import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');

    if (!companyId) {
      return NextResponse.json({ error: 'Company ID required' }, { status: 400 });
    }

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

    console.log('🔍 Debug suppliers for company:', companyId);

    // Get all invoices for this company
    const { data: invoices, error } = await supabase
      .from('invoices')
      .select(`
        id,
        supplier_name,
        supplier_tax_id,
        total_amount,
        status,
        issue_date,
        created_at,
        deleted_at
      `)
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Error fetching invoices:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log('📊 Found invoices:', invoices?.length || 0);

    // Group by supplier
    const supplierMap = new Map();

    (invoices || []).forEach(invoice => {
      const key = invoice.supplier_tax_id || invoice.supplier_name || 'UNKNOWN';

      if (!supplierMap.has(key)) {
        supplierMap.set(key, {
          supplier_name: invoice.supplier_name,
          supplier_tax_id: invoice.supplier_tax_id,
          invoices: [],
          total_amount: 0,
          statuses: new Set(),
          deleted_count: 0,
          active_count: 0
        });
      }

      const supplier = supplierMap.get(key);
      supplier.invoices.push({
        id: invoice.id,
        total_amount: invoice.total_amount,
        status: invoice.status,
        issue_date: invoice.issue_date,
        created_at: invoice.created_at,
        deleted_at: invoice.deleted_at
      });
      supplier.total_amount += invoice.total_amount || 0;
      supplier.statuses.add(invoice.status);

      if (invoice.deleted_at) {
        supplier.deleted_count++;
      } else {
        supplier.active_count++;
      }
    });

    const suppliers = Array.from(supplierMap.entries()).map(([key, data]) => ({
      key,
      supplier_name: data.supplier_name,
      supplier_tax_id: data.supplier_tax_id,
      total_invoices: data.invoices.length,
      active_invoices: data.active_count,
      deleted_invoices: data.deleted_count,
      total_amount: data.total_amount,
      statuses: Array.from(data.statuses),
      latest_invoice: data.invoices[0]?.created_at,
      sample_invoices: data.invoices.slice(0, 2)
    }));

    console.log('👥 Unique suppliers found:', suppliers.length);
    console.log('📋 Supplier names:', suppliers.map(s => s.supplier_name).slice(0, 10));

    return NextResponse.json({
      total_invoices: invoices?.length || 0,
      total_suppliers: suppliers.length,
      suppliers: suppliers.sort((a, b) => b.total_amount - a.total_amount)
    });

  } catch (error) {
    console.error('Debug suppliers error:', error);
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}