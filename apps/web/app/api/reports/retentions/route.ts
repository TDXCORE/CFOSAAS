/**
 * API route for retention reports generation
 */

import { NextRequest, NextResponse } from 'next/server';
import { retentionReportsService } from '~/lib/reports/retention-reports-service';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const format = searchParams.get('format') || 'json';
    const supplierTaxId = searchParams.get('supplierTaxId');

    if (!companyId || !startDate || !endDate) {
      return NextResponse.json({
        error: 'Missing required parameters: companyId, startDate, endDate'
      }, { status: 400 });
    }

    // Generate retention certificate for specific supplier
    if (supplierTaxId) {
      const certificate = await retentionReportsService.generateRetentionCertificate(
        companyId,
        supplierTaxId,
        `${startDate} - ${endDate}`
      );

      if (!certificate) {
        return NextResponse.json({
          error: 'No retention data found for the specified supplier and period'
        }, { status: 404 });
      }

      return NextResponse.json({
        success: true,
        data: certificate,
        type: 'retention_certificate'
      });
    }

    // Generate summary report
    const summary = await retentionReportsService.generateRetentionSummary(
      companyId,
      startDate,
      endDate
    );

    if (format === 'csv') {
      const csvData = retentionReportsService.exportToCSV(summary);

      return new NextResponse(csvData, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="retenciones_${startDate}_${endDate}.csv"`
        }
      });
    }

    return NextResponse.json({
      success: true,
      data: summary,
      type: 'retention_summary',
      period: `${startDate} - ${endDate}`,
      total_suppliers: summary.length,
      total_retentions: summary.reduce((sum, s) => sum + s.total_retentions, 0)
    });

  } catch (error) {
    console.error('Error generating retention report:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { companyId, taxYear, reportType } = body;

    if (!companyId || !taxYear) {
      return NextResponse.json({
        error: 'Missing required parameters: companyId, taxYear'
      }, { status: 400 });
    }

    if (reportType === 'form350') {
      const form350Data = await retentionReportsService.generateForm350Data(
        companyId,
        taxYear
      );

      return NextResponse.json({
        success: true,
        data: form350Data,
        type: 'form_350_dian',
        note: 'Basic Form 350 structure - requires full DIAN compliance implementation'
      });
    }

    return NextResponse.json({
      error: 'Invalid report type'
    }, { status: 400 });

  } catch (error) {
    console.error('Error generating DIAN report:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}