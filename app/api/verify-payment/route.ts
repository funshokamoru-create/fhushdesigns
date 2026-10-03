import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const { reference, expectedAmount } = body;

    if (!reference || !expectedAmount) {
      return NextResponse.json(
        {
          error: "Missing payment reference or amount.",
        },
        { status: 400 }
      );
    }

    const response = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(
        reference
      )}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    const data = await response.json();

    if (!response.ok || !data.status) {
      console.error("Paystack verification error:", data);

      return NextResponse.json(
        {
          error:
            data?.message ||
            "Unable to verify Paystack payment.",
        },
        { status: 400 }
      );
    }

    const transaction = data.data;

    const expectedAmountInKobo = Math.round(
      Number(expectedAmount) * 100
    );

    if (transaction.status !== "success") {
      return NextResponse.json(
        {
          error: "Payment was not successful.",
        },
        { status: 400 }
      );
    }

    if (Number(transaction.amount) !== expectedAmountInKobo) {
      return NextResponse.json(
        {
          error: "Payment amount does not match the order total.",
        },
        { status: 400 }
      );
    }

    if (transaction.currency !== "NGN") {
      return NextResponse.json(
        {
          error: "Unexpected payment currency.",
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      reference: transaction.reference,
      amount: transaction.amount,
      currency: transaction.currency,
      customer: transaction.customer,
    });
  } catch (error) {
    console.error("Payment verification error:", error);

    return NextResponse.json(
      {
        error: "Something went wrong while verifying payment.",
      },
      { status: 500 }
    );
  }
}