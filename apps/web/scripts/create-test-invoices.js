/**
 * Script to create test invoices for pagination testing
 */

import { createClient } from '@supabase/supabase-js';
import { randomInt, randomUUID } from 'crypto';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.development' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function createTestInvoices() {
  try {
    // Get the first company ID
    const { data: companies } = await supabase
      .from('companies')
      .select('id')
      .limit(1);

    if (!companies || companies.length === 0) {
      console.error('No companies found');
      return;
    }

    const companyId = companies[0].id;
    console.log(`Creating test invoices for company: ${companyId}`);

    const suppliers = [
      { name: 'Proveedor ABC S.A.S.', taxId: '900123456-1' },
      { name: 'Servicios XYZ Ltda.', taxId: '800234567-2' },
      { name: 'Comercial DEF S.A.', taxId: '900345678-3' },
      { name: 'Tecnología GHI S.A.S.', taxId: '800456789-4' },
      { name: 'Distribuidora JKL Ltda.', taxId: '900567890-5' },
      { name: 'Construcciones MNO S.A.', taxId: '800678901-6' },
      { name: 'Consultores PQR S.A.S.', taxId: '900789012-7' },
      { name: 'Logística STU Ltda.', taxId: '800890123-8' },
      { name: 'Manufacturas VWX S.A.', taxId: '900901234-9' },
      { name: 'Alimentos YZ S.A.S.', taxId: '800012345-0' }
    ];

    const statuses = ['pending', 'validated', 'error', 'review'];
    const invoices = [];

    // Create 50 test invoices
    for (let i = 1; i <= 50; i++) {
      const supplier = suppliers[Math.floor(Math.random() * suppliers.length)];
      const subtotal = randomInt(100000, 5000000);
      const totalTax = Math.floor(subtotal * 0.19);
      const totalRetention = Math.floor(subtotal * 0.025);
      const totalAmount = subtotal + totalTax;

      const invoice = {
        id: randomUUID(),
        company_id: companyId,
        invoice_number: `FAC-${String(i).padStart(4, '0')}`,
        issue_date: new Date(Date.now() - randomInt(1, 365) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        supplier_name: supplier.name,
        supplier_tax_id: supplier.taxId,
        subtotal: subtotal,
        total_tax: totalTax,
        total_retention: randomInt(0, 2) > 0 ? totalRetention : 0,
        total_amount: totalAmount,
        status: statuses[Math.floor(Math.random() * statuses.length)],
        processing_status: 'completed',
        puc_code: Math.random() > 0.3 ? `${randomInt(1000, 9999)}` : null,
        puc_name: Math.random() > 0.3 ? `Cuenta PUC ${randomInt(1000, 9999)}` : null,
        manual_review_required: Math.random() > 0.8,
        source_file_type: Math.random() > 0.5 ? 'xml' : 'pdf',
        raw_data: JSON.stringify({ test: true }),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      invoices.push(invoice);
    }

    // Insert invoices in batches
    const batchSize = 10;
    for (let i = 0; i < invoices.length; i += batchSize) {
      const batch = invoices.slice(i, i + batchSize);
      const { error } = await supabase
        .from('invoices')
        .insert(batch);

      if (error) {
        console.error(`Error inserting batch ${Math.floor(i / batchSize) + 1}:`, error);
        break;
      } else {
        console.log(`Inserted batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(invoices.length / batchSize)}`);
      }
    }

    console.log(`✅ Successfully created ${invoices.length} test invoices`);
  } catch (error) {
    console.error('Error creating test invoices:', error);
  }
}

createTestInvoices();