import { NextRequest, NextResponse } from 'next/server';
import { buildGraph, calculateFromYear } from '../../../lib/build';
import { GraphRequestSchema } from '../../../lib/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { topicIds, years } = GraphRequestSchema.parse(body);

    if (topicIds.length === 0) {
      return NextResponse.json(
        { error: 'At least one topic ID must be provided' },
        { status: 400 }
      );
    }

    const fromYear = calculateFromYear(years);
    const graph = await buildGraph({
      topicIds,
      fromYear,
    });
    
    return NextResponse.json(graph);
  } catch (error) {
    console.error('Error in graph API:', error);
    
    if (error instanceof Error && error.message.includes('validation')) {
      return NextResponse.json(
        { error: 'Invalid request format' },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to build funder graph' },
      { status: 500 }
    );
  }
}
