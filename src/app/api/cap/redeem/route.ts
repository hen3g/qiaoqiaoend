import { NextResponse } from "next/server";
import { getCap } from "@/lib/cap";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      token?: string;
      solutions?: number[];
    };
    if (!body.token || !body.solutions) {
      return NextResponse.json({ success: false }, { status: 400 });
    }
    const result = await getCap().redeemChallenge({
      token: body.token,
      solutions: body.solutions,
    });
    return NextResponse.json(result);
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { success: false, message: "redeem failed" },
      { status: 500 },
    );
  }
}
