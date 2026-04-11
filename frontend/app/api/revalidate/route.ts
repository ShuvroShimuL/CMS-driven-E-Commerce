import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';

export async function POST(request: NextRequest) {
  const secret = request.headers.get('Authorization');
  const configuredSecret = process.env.REVALIDATION_SECRET;

  if (secret !== `Bearer ${configuredSecret}`) {
    return NextResponse.json({ message: 'Invalid token' }, { status: 401 });
  }

  try {
    const body = await request.json();

    // Strapi format is usually { event: 'entry.publish', model: 'product', entry: { slug: '...' } }
    const { event, model, entry } = body;

    // Execute a global layout cache burst to ensure stock numbers synchronize instantly everywhere
    revalidatePath('/', 'layout');

    return NextResponse.json({ revalidated: true, now: Date.now() });
  } catch (err) {
    return NextResponse.json({ message: 'Error parsing body' }, { status: 400 });
  }
}
