import { NextRequest, NextResponse } from 'next/server';
import { getFunderProfile } from '../../../../lib/openalex';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    if (!id) {
      return NextResponse.json(
        { error: 'Funder ID is required' },
        { status: 400 }
      );
    }

    const funder = await getFunderProfile(id);
    
    return NextResponse.json(funder);
  } catch (error) {
    console.error('Error in funder profile API:', error);
    
    return NextResponse.json(
      { error: 'Failed to fetch funder profile' },
      { status: 500 }
    );
  }
}
