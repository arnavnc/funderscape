import { NextRequest, NextResponse } from 'next/server';
import { getFunderCountries } from '../../../../../lib/openalex';
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
    const countries = await getFunderCountries(id, fromYear);
    
    return NextResponse.json({
      countries,
      fromYear,
      funderId: id,
    });
  } catch (error) {
    console.error('Error in funder institutions API:', error);
    
    return NextResponse.json(
      { error: 'Failed to fetch funder institutions' },
      { status: 500 }
    );
  }
}
