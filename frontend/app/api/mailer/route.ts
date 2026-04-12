import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('authorization');
    // Simple shared secret to prevent abuse (backend will pass JWT_SECRET)
    if (authHeader !== `Bearer ${process.env.JWT_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { to, subject, htmlContent } = await req.json();

    if (!to || !subject || !htmlContent) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    });

    await transporter.sendMail({
      from: `"Premium Store" <${process.env.GMAIL_USER}>`,
      to,
      subject,
      html: htmlContent,
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[Vercel Mailer API Failed]:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
