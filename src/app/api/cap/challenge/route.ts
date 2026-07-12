import { NextResponse } from "next/server";
import { getCap } from "@/lib/cap";

export async function POST() {
  try {
    const challenge = await getCap().createChallenge({
      challengeCount: 40,
      challengeSize: 32,
      challengeDifficulty: 4,
      expiresMs: 10 * 60 * 1000,
    });
    return NextResponse.json(challenge);
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { success: false, message: "challenge failed" },
      { status: 500 },
    );
  }
}
