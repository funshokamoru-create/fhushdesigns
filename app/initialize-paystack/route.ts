import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    status: true,
    message: "FhushDesigns Paystack API is working.",
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const {
      email,
      amount,
      reference,
      callback_url,
    } = body;

    if (!email || !amount || !reference) {
      return NextResponse.json(
        {
          error: "Missing required payment information.",
        },
        { status: 400 }
      );
    }

    if (!process.env.PAYSTACK_SECRET_KEY) {
      console.error("PAYSTACK_SECRET_KEY is missing.");

      return NextResponse.json(
        {
          error: "Paystack secret key is not configured.",
        },
        { status: 500 }
      );
    }

    const response = await fetch(
      "https://api.paystack.co/transaction/initialize",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          amount: Math.round(Number(amount) * 100),
          reference,
          callback_url,
        }),
      }
    );

    const data = await response.json();

    if (!response.ok || !data.status) {
      console.error("Paystack initialization error:", data);

      return NextResponse.json(
        {
          error:
            data?.message ||
            "Unable to initialize Paystack payment.",
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      status: true,
      authorization_url: data.data.authorization_url,
      access_code: data.data.access_code,
      reference: data.data.reference,
    });
  } catch (error) {
    console.error("Payment initialization error:", error);

    return NextResponse.json(
      {
        error: "Something went wrong while starting your payment.",
      },
      { status: 500 }
    );
  }
}