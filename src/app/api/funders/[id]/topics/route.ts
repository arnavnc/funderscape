import { NextRequest, NextResponse } from 'next/server';
import { getFunderTopics } from '../../../../../lib/openalex';
import { calculateFromYear } from '../../../../../lib/build';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const years = searchParams.get('years');
    
    if (!id) {
      return NextResponse.json(
        { error: 'Funder ID is required' },
        { status: 400 }
      );
    }

    const fromYear = calculateFromYear(years ? parseInt(years) : undefined);
    const topics = await getFunderTopics(id, fromYear);
    
    return NextResponse.json({
      topics,
      fromYear,
      funderId: id,
    });
  } catch (error) {
    console.error('Error in funder topics API:', error);
    
    return NextResponse.json(
      { error: 'Failed to fetch funder topics' },
      { status: 500 }
    );
  }
}
