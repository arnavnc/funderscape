import { NextRequest, NextResponse } from 'next/server';
import { getTextTopics } from '../../../lib/openalex';
import { AnnotateRequestSchema } from '../../../lib/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, abstract } = AnnotateRequestSchema.parse(body);

    if (!title && !abstract) {
      return NextResponse.json(
        { error: 'Either title or abstract must be provided' },
        { status: 400 }
      );
    }

    const response = await getTextTopics(title, abstract);
    
    return NextResponse.json({
      topics: response.topics,
      primary_topic: response.primary_topic,
    });
  } catch (error) {
    console.error('Error in annotate API:', error);
    
    if (error instanceof Error && error.message.includes('validation')) {
      return NextResponse.json(
        { error: 'Invalid request format' },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to process text annotation' },
      { status: 500 }
    );
  }
}
