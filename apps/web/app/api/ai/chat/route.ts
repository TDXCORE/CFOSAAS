/**
 * AI Chat API Route - CFO Virtual
 * Handles OpenAI GPT-4 integration for Colombian financial intelligence
 */

import { NextRequest, NextResponse } from 'next/server';
import { openaiService } from '~/lib/ai/openai-service';

export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body = await request.json();
    const { message, context } = body;

    // Validate input
    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'Message is required and must be a string' },
        { status: 400 }
      );
    }

    if (message.length > 2000) {
      return NextResponse.json(
        { error: 'Message too long. Please keep it under 2000 characters.' },
        { status: 400 }
      );
    }

    // Generate AI response
    const aiResponse = await openaiService.generateCFOResponse(message, context);

    // Return successful response
    return NextResponse.json({
      success: true,
      response: aiResponse,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('AI Chat API Error:', error);

    // Return error response
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error. Please try again later.',
        fallback: {
          message: 'Lo siento, hay un problema temporal con el sistema de AI. Mientras tanto, puedo ayudarte con consultas financieras básicas usando responses predefinidas.',
          suggestions: [
            'Intentar nuevamente en unos momentos',
            'Usar el dashboard para ver métricas actuales',
            'Contactar soporte técnico si el problema persiste'
          ]
        }
      },
      { status: 500 }
    );
  }
}

// Handle OPTIONS for CORS
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}