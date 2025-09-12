import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '~/lib/supabase/client-singleton';

const COMPANY_ID = '550e8400-e29b-41d4-a716-446655440000';

export async function GET() {
  const supabase = getSupabaseClient();

  try {
    const results = {
      diagnosis: 'DIRECT DATABASE DIAGNOSIS',
      timestamp: new Date().toISOString(),
      companyId: COMPANY_ID
    };

    // 1. Check total invoices
    console.log('🔍 Checking total invoices...');
    const { data: allInvoices, error: allError, count: totalCount } = await supabase
      .from('invoices')
      .select('*', { count: 'exact' })
      .limit(3);

    results.totalInvoices = {
      count: totalCount,
      error: allError?.message,
      sample: allInvoices?.map(inv => ({
        id: inv.id,
        company_id: inv.company_id,
        invoice_number: inv.invoice_number,
        supplier_name: inv.supplier_name,
        status: inv.status
      }))
    };

    // 2. Check company invoices
    console.log('🔍 Checking company invoices...');
    const { data: companyInvoices, error: companyError, count: companyCount } = await supabase
      .from('invoices')
      .select('*', { count: 'exact' })
      .eq('company_id', COMPANY_ID);

    results.companyInvoices = {
      count: companyCount,
      error: companyError?.message,
      data: companyInvoices?.map(inv => ({
        invoice_number: inv.invoice_number,
        supplier_name: inv.supplier_name,
        issue_date: inv.issue_date,
        status: inv.status
      }))
    };

    // 3. Check all company IDs
    console.log('🔍 Checking all company IDs...');
    const { data: companyIds, error: idsError } = await supabase
      .from('invoices')
      .select('company_id')
      .limit(10);

    const uniqueCompanyIds = [...new Set(companyIds?.map(inv => inv.company_id))];
    results.companyIds = {
      error: idsError?.message,
      unique: uniqueCompanyIds,
      targetExists: uniqueCompanyIds.includes(COMPANY_ID)
    };

    // 4. Check invoice_taxes table
    console.log('🔍 Checking invoice_taxes...');
    const { data: taxRecords, error: taxError, count: taxCount } = await supabase
      .from('invoice_taxes')
      .select('*', { count: 'exact' })
      .limit(3);

    results.taxRecords = {
      count: taxCount,
      error: taxError?.message,
      sample: taxRecords?.map(tax => ({
        invoice_id: tax.invoice_id,
        tax_type: tax.tax_type,
        tax_amount: tax.tax_amount
      }))
    };

    // 5. Test reports query
    console.log('🔍 Testing reports query...');
    const filters = {
      date_from: '2020-01-01', // Very wide date range
      date_to: '2030-12-31'
    };

    let query = supabase
      .from('invoices')
      .select(`
        invoice_number,
        issue_date,
        supplier_name,
        total_amount,
        status
      `)
      .eq('company_id', COMPANY_ID);

    if (filters.date_from) {
      query = query.gte('issue_date', filters.date_from);
    }
    if (filters.date_to) {
      query = query.lte('issue_date', filters.date_to);
    }

    const { data: reportData, error: reportError } = await query;

    results.reportsQuery = {
      error: reportError?.message,
      count: reportData?.length || 0,
      data: reportData?.slice(0, 3)
    };

    // 6. Analysis
    let issue = 'UNKNOWN';
    if (totalCount > 0 && companyCount === 0) {
      issue = 'COMPANY_ID_MISMATCH';
    } else if (companyCount > 0 && (!reportData || reportData.length === 0)) {
      issue = 'DATE_FILTER_ISSUE';
    } else if (companyCount > 0 && reportData?.length > 0) {
      issue = 'DATA_EXISTS_CHECK_FRONTEND';
    } else if (totalCount === 0) {
      issue = 'NO_INVOICES_IN_DATABASE';
    }

    results.analysis = {
      issue,
      summary: {
        totalInvoices: totalCount,
        companyInvoices: companyCount,
        taxRecords: taxCount,
        reportsResult: reportData?.length || 0
      }
    };

    return NextResponse.json(results);

  } catch (error) {
    console.error('Debug API error:', error);
    return NextResponse.json({
      error: 'Debug failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}