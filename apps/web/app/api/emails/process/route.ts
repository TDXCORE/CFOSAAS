/**
 * API Endpoint for Automated Email Invoice Processing
 * POST /api/emails/process - Process emails and extract invoices
 */

import { NextRequest, NextResponse } from 'next/server';
import { createEmailInvoiceProcessor, type EmailProcessingConfig } from '~/lib/email';
import { requireUser } from '@kit/supabase/require-user';
import { getSupabaseServiceClient } from '~/lib/supabase/service-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

export async function POST(request: NextRequest) {
  try {
    // Get current user and validate authentication
    const supabaseClient = getSupabaseServerClient();
    const userResult = await requireUser(supabaseClient);
    
    if (userResult.error) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    const user = userResult.data;

    // Parse request body
    const body = await request.json();
    const { 
      companyId, 
      microsoftGraphConfig, 
      processingOptions = {},
      testMode = false 
    } = body;

    if (!companyId) {
      return NextResponse.json(
        { error: 'Company ID is required' },
        { status: 400 }
      );
    }

    if (!microsoftGraphConfig) {
      return NextResponse.json(
        { error: 'Microsoft Graph configuration is required' },
        { status: 400 }
      );
    }

    // Use server environment variables or provided credentials
    const clientId = microsoftGraphConfig.clientId || process.env.AZURE_CLIENT_ID;
    const clientSecret = microsoftGraphConfig.clientSecret || process.env.AZURE_CLIENT_SECRET;
    const tenantId = microsoftGraphConfig.tenantId || process.env.AZURE_TENANT_ID;
    
    if (!clientId || !clientSecret || !tenantId) {
      return NextResponse.json(
        { error: 'Missing Microsoft Graph credentials (clientId, clientSecret, tenantId)' },
        { status: 400 }
      );
    }

    // Verify user has access to the company
    const supabase = getSupabaseServiceClient();
    const { data: userCompany, error: companyError } = await supabase
      .from('user_companies')
      .select('*')
      .eq('user_id', user.id)
      .eq('company_id', companyId)
      .eq('status', 'active')
      .single();

    if (companyError || !userCompany) {
      return NextResponse.json(
        { error: 'Access denied to company' },
        { status: 403 }
      );
    }

    // Build email processing configuration
    const emailConfig: EmailProcessingConfig = {
      microsoftGraph: {
        clientId,
        clientSecret,
        tenantId,
        mailbox: microsoftGraphConfig.mailbox || process.env.USER_EMAIL // Optional specific mailbox
      },
      processingOptions: {
        maxEmails: processingOptions.maxEmails || (testMode ? 5 : 20),
        daysBack: processingOptions.daysBack || 7,
        includeRead: processingOptions.includeRead ?? false,
        autoMarkProcessed: processingOptions.autoMarkProcessed ?? true,
        subjectFilters: processingOptions.subjectFilters || [
          'factura', 'invoice', 'comprobante', 'fe_', 'fv_', 'dian'
        ],
        senderFilters: processingOptions.senderFilters || []
      },
      storageConfig: {
        bucketName: 'invoices', // Default Supabase bucket
        basePath: 'email-attachments'
      }
    };

    console.log(`🚀 Starting email processing for company ${companyId}`);
    console.log(`📧 Configuration: ${JSON.stringify({
      maxEmails: emailConfig.processingOptions.maxEmails,
      daysBack: emailConfig.processingOptions.daysBack,
      testMode
    })}`);

    // Create processor and test connection first
    const processor = createEmailInvoiceProcessor(emailConfig);
    
    // Test connection if in test mode
    if (testMode) {
      console.log('🧪 Testing Microsoft Graph connection...');
      console.log('🔑 Using credentials:', {
        clientId: clientId?.substring(0, 8) + '...',
        tenantId: tenantId?.substring(0, 8) + '...',
        hasClientSecret: !!clientSecret
      });

      try {
        const connectionTest = await processor.testConnection();
        console.log('📊 Connection test result:', {
          success: connectionTest.success,
          error: connectionTest.error,
          hasMailboxInfo: !!connectionTest.mailboxInfo
        });
        
        return NextResponse.json({
          success: connectionTest.success,
          testMode: true,
          connectionResult: connectionTest,
          message: connectionTest.success 
            ? 'Microsoft Graph connection successful' 
            : 'Microsoft Graph connection failed',
          debugInfo: {
            clientId: clientId?.substring(0, 8) + '...',
            tenantId: tenantId?.substring(0, 8) + '...',
            hasClientSecret: !!clientSecret
          }
        });
      } catch (testError) {
        console.error('❌ Connection test threw an error:', testError);
        return NextResponse.json({
          success: false,
          testMode: true,
          connectionResult: {
            success: false,
            error: testError instanceof Error ? testError.message : 'Connection test failed'
          },
          message: 'Microsoft Graph connection test failed',
          debugInfo: {
            errorType: testError?.constructor?.name || 'Unknown',
            errorMessage: testError instanceof Error ? testError.message : String(testError)
          }
        });
      }
    }

    // Process emails for invoices
    const processingResult = await processor.processEmailsForInvoices(companyId);

    // Log the result summary for monitoring
    console.log(`✅ Email processing completed for company ${companyId}:`, {
      success: processingResult.success,
      summary: processingResult.summary,
      processingTime: processingResult.processingTime
    });

    // Store processing result in database for audit trail
    try {
      await supabase
        .from('integration_logs')
        .insert({
          company_id: companyId,
          integration_type: 'microsoft_graph',
          operation: 'process_emails',
          status: processingResult.success ? 'success' : 'failed',
          request_data: {
            processingOptions: emailConfig.processingOptions,
            testMode
          },
          response_data: {
            summary: processingResult.summary,
            totalErrors: processingResult.errors.length
          },
          error_message: processingResult.errors.length > 0 ? processingResult.errors.join('; ') : null,
          duration_ms: processingResult.processingTime,
          triggered_by: user.id
        });
    } catch (logError) {
      console.error('Failed to log processing result:', logError);
      // Don't fail the main operation for logging errors
    }

    // Return processing result
    return NextResponse.json({
      success: processingResult.success,
      summary: processingResult.summary,
      results: processingResult.results,
      errors: processingResult.errors,
      processingTime: processingResult.processingTime,
      message: processingResult.success 
        ? `Successfully processed ${processingResult.summary.processedInvoices} invoices from ${processingResult.summary.totalEmails} emails`
        : 'Email processing completed with errors'
    });

  } catch (error) {
    console.error('Email processing API error:', error);
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/emails/process - Get processing status or test connection
 */
export async function GET(request: NextRequest) {
  try {
    const supabaseClient = getSupabaseServerClient();
    const userResult = await requireUser(supabaseClient);
    
    if (userResult.error) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    const user = userResult.data;

    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');
    const action = searchParams.get('action');

    if (!companyId) {
      return NextResponse.json(
        { error: 'Company ID is required' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServiceClient();

    // Verify user has access to the company
    const { data: userCompany, error: companyError } = await supabase
      .from('user_companies')
      .select('*')
      .eq('user_id', user.id)
      .eq('company_id', companyId)
      .eq('status', 'active')
      .single();

    if (companyError || !userCompany) {
      return NextResponse.json(
        { error: 'Access denied to company' },
        { status: 403 }
      );
    }

    if (action === 'stats') {
      // Get recent processing statistics
      const { data: recentLogs, error: logsError } = await supabase
        .from('integration_logs')
        .select('*')
        .eq('company_id', companyId)
        .eq('integration_type', 'microsoft_graph')
        .eq('operation', 'process_emails')
        .order('created_at', { ascending: false })
        .limit(10);

      if (logsError) {
        return NextResponse.json(
          { error: 'Failed to fetch processing stats' },
          { status: 500 }
        );
      }

      // Calculate summary statistics
      const stats = {
        totalRuns: recentLogs?.length || 0,
        successfulRuns: recentLogs?.filter(log => log.status === 'success').length || 0,
        failedRuns: recentLogs?.filter(log => log.status === 'failed').length || 0,
        lastRunAt: recentLogs?.[0]?.created_at || null,
        averageProcessingTime: recentLogs?.length > 0 
          ? Math.round(recentLogs.reduce((sum, log) => sum + (log.duration_ms || 0), 0) / recentLogs.length)
          : 0,
        totalInvoicesProcessed: recentLogs?.reduce((sum, log) => {
          const summary = log.response_data?.summary;
          return sum + (summary?.processedInvoices || 0);
        }, 0) || 0,
        recentLogs: recentLogs?.slice(0, 5).map(log => ({
          id: log.id,
          createdAt: log.created_at,
          status: log.status,
          summary: log.response_data?.summary || {},
          processingTime: log.duration_ms,
          errorMessage: log.error_message
        }))
      };

      return NextResponse.json({
        success: true,
        stats
      });
    }

    // Default: return integration status
    const { data: integrationConfig, error: configError } = await supabase
      .from('integration_configs')
      .select('*')
      .eq('company_id', companyId)
      .eq('integration_type', 'microsoft_graph')
      .single();

    return NextResponse.json({
      success: true,
      hasIntegration: !configError && integrationConfig !== null,
      integrationStatus: integrationConfig?.sync_status || 'not_configured',
      lastSyncAt: integrationConfig?.last_sync_at || null
    });

  } catch (error) {
    console.error('Email processing status API error:', error);
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}