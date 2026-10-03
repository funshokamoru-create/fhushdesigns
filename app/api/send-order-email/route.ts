import { NextResponse } from "next/server";
import Mailgun from "mailgun.js";
import formData from "form-data";

const mailgun = new Mailgun(formData);

const mg = mailgun.client({
  username: "api",
  key: process.env.MAILGUN_API_KEY!,
});

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const {
      customerName,
      customerEmail,
      orderTotal,
      orderId,
    } = body;

    if (!customerName || !customerEmail || !orderTotal) {
      return NextResponse.json(
        {
          error: "Missing required email information.",
        },
        { status: 400 }
      );
    }

    const domain = process.env.MAILGUN_DOMAIN;

    if (!domain) {
      return NextResponse.json(
        {
          error: "Mailgun domain is not configured.",
        },
        { status: 500 }
      );
    }

    const message = await mg.messages.create(domain, {
      from: `FhushDesigns <postmaster@${domain}>`,
      to: [customerEmail],
      subject: `FhushDesigns Order Confirmation`,
      text: `Hello ${customerName},

Thank you for shopping with FhushDesigns.

Your order has been successfully received.

Order number: ${orderId || "Pending"}
Order total: ₦${Number(orderTotal).toLocaleString("en-NG")}

We appreciate your order and will be in touch with delivery information soon.

Thank you,
FhushDesigns`,
    });

    return NextResponse.json({
      success: true,
      messageId: message.id,
    });
  } catch (error) {
    console.error("Mailgun error:", error);

    return NextResponse.json(
      {
        error: "Unable to send order confirmation email.",
      },
      { status: 500 }
    );
  }
}