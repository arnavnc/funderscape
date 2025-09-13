import { NextRequest, NextResponse } from 'next/server';
import { getTopFunders } from '../../../lib/openalex';
import { LeaderboardRequestSchema } from '../../../lib/types';
import { calculateFromYear } from '../../../lib/build';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { topicIds, years } = LeaderboardRequestSchema.parse(body);

    if (topicIds.length === 0) {
      return NextResponse.json(
        { error: 'At least one topic ID must be provided' },
        { status: 400 }
      );
    }

    const fromYear = calculateFromYear(years);
    const groups = await getTopFunders(topicIds, fromYear);
    
    return NextResponse.json({
      funders: groups,
      fromYear,
      topicIds,
    });
  } catch (error) {
    console.error('Error in leaderboard API:', error);
    
    if (error instanceof Error && error.message.includes('validation')) {
      return NextResponse.json(
        { error: 'Invalid request format' },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to fetch funder leaderboard' },
      { status: 500 }
    );
  }
}
