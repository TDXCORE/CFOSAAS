/**
 * Direct diagnosis of reports issue
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://ruqxximzgwkdxsskbflg.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ1cXh4aW16Z3drZHhzc2tiZmxnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzU3MzUwMDUsImV4cCI6MjA1MTMxMTAwNX0.uKMgBJjZVr7zRhAbKrRFmk4p-_Wov2FmmJadv6_ZnZc'
);

const COMPANY_ID = '550e8400-e29b-41d4-a716-446655440000'; // From the logs

async function debugReports() {
  console.log('🔍 DIRECT DATABASE DIAGNOSIS');
  console.log('=' .repeat(50));
  
  try {
    // 1. Check if invoices table exists and has data
    console.log('\n1️⃣ Checking invoices table...');
    const { data: allInvoices, error: allError, count: totalCount } = await supabase
      .from('invoices')
      .select('*', { count: 'exact' })
      .limit(3);

    if (allError) {
      console.error('❌ Error accessing invoices table:', allError);
      return;
    }

    console.log(`📊 Total invoices in database: ${totalCount}`);
    console.log(`📄 Sample invoices:`, allInvoices?.map(inv => ({
      id: inv.id,
      company_id: inv.company_id,
      invoice_number: inv.invoice_number,
      supplier_name: inv.supplier_name,
      total_amount: inv.total_amount,
      status: inv.status,
      created_at: inv.created_at
    })));

    // 2. Check for the specific company
    console.log(`\n2️⃣ Checking invoices for company: ${COMPANY_ID}`);
    const { data: companyInvoices, error: companyError, count: companyCount } = await supabase
      .from('invoices')
      .select('*', { count: 'exact' })
      .eq('company_id', COMPANY_ID);

    if (companyError) {
      console.error('❌ Error querying company invoices:', companyError);
    } else {
      console.log(`📊 Invoices for company ${COMPANY_ID}: ${companyCount}`);
      console.log('📄 Company invoices:', companyInvoices?.map(inv => ({
        invoice_number: inv.invoice_number,
        supplier_name: inv.supplier_name,
        total_amount: inv.total_amount,
        status: inv.status
      })));
    }

    // 3. Check all company IDs that exist
    console.log('\n3️⃣ Checking all company IDs in database...');
    const { data: companyIds, error: idsError } = await supabase
      .from('invoices')
      .select('company_id')
      .limit(10);

    if (idsError) {
      console.error('❌ Error getting company IDs:', idsError);
    } else {
      const uniqueCompanyIds = [...new Set(companyIds?.map(inv => inv.company_id))];
      console.log('📋 Unique company IDs found:', uniqueCompanyIds);
      console.log('🎯 Target company ID:', COMPANY_ID);
      console.log('✅ Company ID exists:', uniqueCompanyIds.includes(COMPANY_ID));
    }

    // 4. Check invoice_taxes table
    console.log('\n4️⃣ Checking invoice_taxes table...');
    const { data: taxRecords, error: taxError, count: taxCount } = await supabase
      .from('invoice_taxes')
      .select('*', { count: 'exact' })
      .limit(3);

    if (taxError) {
      console.error('❌ Error accessing invoice_taxes table:', taxError);
    } else {
      console.log(`📊 Total tax records: ${taxCount}`);
      console.log('📄 Sample tax records:', taxRecords?.map(tax => ({
        invoice_id: tax.invoice_id,
        tax_type: tax.tax_type,
        tax_amount: tax.tax_amount,
        company_id: tax.company_id
      })));
    }

    // 5. Check if there are taxes for our company
    const { data: companyTaxes, error: companyTaxError, count: companyTaxCount } = await supabase
      .from('invoice_taxes')
      .select('*', { count: 'exact' })
      .eq('company_id', COMPANY_ID);

    if (companyTaxError) {
      console.error('❌ Error querying company taxes:', companyTaxError);
    } else {
      console.log(`📊 Tax records for company ${COMPANY_ID}: ${companyTaxCount}`);
    }

    // 6. Test the exact same query as reports service
    console.log('\n6️⃣ Testing exact reports service query...');
    const filters = {
      date_from: '2025-03-01',
      date_to: '2025-09-12'
    };

    let query = supabase
      .from('invoices')
      .select(`
        invoice_number,
        issue_date,
        due_date,
        supplier_name,
        supplier_tax_id,
        customer_name,
        subtotal,
        total_tax,
        total_retention,
        total_amount,
        puc_code,
        status,
        processing_status,
        source_file_type,
        manual_review_required,
        created_at
      `)
      .eq('company_id', COMPANY_ID);

    if (filters.date_from) {
      query = query.gte('issue_date', filters.date_from);
    }
    if (filters.date_to) {
      query = query.lte('issue_date', filters.date_to);
    }

    query = query.order('issue_date', { ascending: false });

    const { data: reportData, error: reportError } = await query;

    console.log('🔍 Reports service query result:', {
      error: reportError?.message,
      count: reportData?.length || 0,
      data: reportData?.slice(0, 2)
    });

    // 7. Summary
    console.log('\n📋 SUMMARY:');
    console.log('=' .repeat(30));
    console.log(`Total invoices in DB: ${totalCount}`);
    console.log(`Invoices for target company: ${companyCount}`);
    console.log(`Tax records in DB: ${taxCount}`);
    console.log(`Company taxes: ${companyTaxCount}`);
    console.log(`Reports query result: ${reportData?.length || 0} invoices`);

    if (totalCount > 0 && companyCount === 0) {
      console.log('\n❗ ISSUE IDENTIFIED: Company ID mismatch!');
      console.log('   - Database has invoices but not for this company ID');
      console.log('   - Need to check company management system');
    } else if (companyCount > 0 && (!reportData || reportData.length === 0)) {
      console.log('\n❗ ISSUE IDENTIFIED: Date filter issue!');
      console.log('   - Company has invoices but outside date range');
    } else if (companyCount > 0 && reportData?.length > 0) {
      console.log('\n✅ REPORTS SHOULD WORK: Data found, check frontend');
    }

  } catch (error) {
    console.error('💥 Unexpected error:', error);
  }
}

debugReports().then(() => {
  console.log('\n🏁 Diagnosis complete!');
  process.exit(0);
}).catch(error => {
  console.error('💥 Script failed:', error);
  process.exit(1);
});