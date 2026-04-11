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

    // We can selectively revalidate based on the model if needed
    if (model === 'product' && entry?.slug) {
      // Revalidate PDP
      revalidatePath(`/product/${entry.slug}`);
      // Revalidate all categories since we don't know exactly which category it might affect without deeply inspecting
      revalidatePath(`/category/[slug]`, 'page');
    } else if (model === 'category' && entry?.slug) {
      revalidatePath(`/category/${entry.slug}`);
    }

    // Always burst the homepage cache to be safe
    revalidatePath('/');
    
    // Also revalidate the main category page
    revalidatePath('/category/all');

    return NextResponse.json({ revalidated: true, now: Date.now() });
  } catch (err) {
    return NextResponse.json({ message: 'Error parsing body' }, { status: 400 });
  }
}
