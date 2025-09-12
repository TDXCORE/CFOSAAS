import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '~/lib/supabase/client-singleton';

const COMPANY_ID = '550e8400-e29b-41d4-a716-446655440000';

export async function GET() {
  const supabase = getSupabaseClient();

  try {
    console.log('🔍 [DEBUG INVOICES PAGE] Starting diagnosis...');

    // Test the exact same query that the invoices page uses
    const { data: invoicesList, error: listError, count: listCount } = await supabase
      .from('invoices')
      .select(`
        *,
        line_items:invoice_line_items(*),
        taxes:invoice_taxes(*)
      `, { count: 'exact' })
      .eq('company_id', COMPANY_ID)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .range(0, 49); // First page of 50

    console.log('🔍 [DEBUG] Invoices page query result:', {
      error: listError?.message,
      count: listCount,
      dataLength: invoicesList?.length
    });

    // Also test without company_id filter to see ALL invoices
    const { data: allInvoices, error: allError, count: allCount } = await supabase
      .from('invoices')
      .select('id, company_id, invoice_number, supplier_name, status', { count: 'exact' })
      .is('deleted_at', null)
      .limit(10);

    console.log('🔍 [DEBUG] All invoices query result:', {
      error: allError?.message,
      count: allCount,
      dataLength: allInvoices?.length
    });

    // Check if RLS is blocking
    const { data: directQuery, error: directError } = await supabase
      .from('invoices')
      .select('count')
      .limit(1);

    console.log('🔍 [DEBUG] Direct count query:', {
      error: directError?.message,
      canAccess: !directError
    });

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      companyId: COMPANY_ID,
      invoicesPageQuery: {
        error: listError?.message,
        count: listCount,
        hasData: (invoicesList?.length || 0) > 0,
        firstInvoice: invoicesList?.[0] ? {
          id: invoicesList[0].id,
          invoice_number: invoicesList[0].invoice_number,
          supplier_name: invoicesList[0].supplier_name,
          status: invoicesList[0].status,
          company_id: invoicesList[0].company_id
        } : null
      },
      allInvoicesQuery: {
        error: allError?.message,
        count: allCount,
        hasData: (allInvoices?.length || 0) > 0,
        companyIds: allInvoices?.map(inv => inv.company_id) || []
      },
      directAccess: {
        error: directError?.message,
        canAccess: !directError
      },
      analysis: {
        issue: listCount === 0 && allCount === 0 ? 'NO_DATA_AT_ALL' :
               listCount === 0 && allCount > 0 ? 'COMPANY_ID_MISMATCH' :
               listCount > 0 ? 'DATA_EXISTS_CHECK_FRONTEND' : 'UNKNOWN',
        recommendation: listCount === 0 && allCount === 0 ? 'Database is empty, upload invoices' :
                       listCount === 0 && allCount > 0 ? 'Wrong company ID, check company management' :
                       listCount > 0 ? 'Data exists, check frontend rendering' : 'Need more investigation'
      }
    });

  } catch (error) {
    console.error('Debug invoices page error:', error);
    return NextResponse.json({
      error: 'Debug failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}