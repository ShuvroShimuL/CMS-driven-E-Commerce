import Link from 'next/link';
import { getProducts, getHomepage, getTestimonials, getFaqs } from '@/lib/api';
import ProductCard from '@/components/ProductCard';
import ScrollReveal from '@/components/ScrollReveal';
import styles from './page.module.css';

export default async function Home() {
  // Fetch dynamic CMS data (with fallbacks to prevent breaking if not setup yet)
  let homeData: any = {};
  let strapiTestimonials: any[] = [];
  let strapiFaqs: any[] = [];
  
  try {
    const rawHome = await getHomepage();
    homeData = rawHome?.attributes || {};
    strapiTestimonials = await getTestimonials();
    strapiFaqs = await getFaqs();
  } catch (err) {
    console.error('CMS Data fetch error on homepage:', err);
  }

  // Fallback defaults
  const content = {
    hero_badge: homeData.hero_badge || "Now Accepting Pre-Orders",
    hero_title: homeData.hero_title || "Premium Essentials.",
    hero_subtitle: homeData.hero_subtitle || "Hand-curated, quality-verified products for those who refuse to compromise. Secure founding member pricing before stock runs out.",
    hero_cta_text: homeData.hero_cta_text || "Shop Collection",
    hero_cta_link: homeData.hero_cta_link || "/category/all",
    hero_image_url: homeData.hero_image?.data?.attributes?.url || "/images/hero-visual.jpg",
    stat_customers: homeData.stat_customers || "2,847+",
    stat_rating: homeData.stat_rating || "4.9",
    stat_delivery: homeData.stat_delivery || "24hr",
    marquee_items: homeData.marquee_items || ["Free Shipping Inside Dhaka", "24hr Fast Delivery", "Use Code WELCOME10", "Verified Reviews Only", "Secure bKash Checkout", "30-Day Returns"],
    value_prop_problem: homeData.value_prop_problem || "Most online stores overpromise and underdeliver.",
    value_prop_answer: homeData.value_prop_answer || "We built Premium around what actually matters — hand-curated quality, 24-hour rapid shipping, and dedicated human support. Every product earns its place through rigorous testing. No fluff. No fillers. No compromises. Just products that work exactly as advertised.",
    benefits: homeData.benefits || [
      { title: 'Local Warranty', desc: 'Your purchase is protected. No overseas runaround, no fine print, no exceptions.' },
      { title: '24hr Shipping', desc: 'Orders before 2 PM ship same day. Inside Dhaka delivery in under 24 hours.' },
      { title: 'Verified Reviews', desc: 'Real buyers, real results. Every review comes from a verified purchase only.' },
      { title: 'Secure Checkout', desc: '256-bit encryption with bKash and COD support. Your data stays locked.' },
      { title: 'Human Support', desc: 'Real people, fast responses. No chatbots, no ticket queues, no runaround.' },
      { title: 'Easy Returns', desc: '30-day no-questions-asked refund policy. Full protection on every order.' }
    ],
    offer_tag: homeData.offer_tag || "Limited Offer",
    offer_title: homeData.offer_title || "10% Off Your First Order",
    offer_subtitle: homeData.offer_subtitle || "Use code at checkout. Founding price — once stock runs out, it's gone.",
    offer_code: homeData.offer_code || "WELCOME10",
    cta_title: homeData.cta_title || "Founding Members Get:",
    cta_perks: homeData.cta_perks || [
      "Founding price locked in forever",
      "Priority same-day shipping",
      "Early access to new drops",
      "Direct line to our team"
    ],
    cta_button_text: homeData.cta_button_text || "Claim Your Founding Price →"
  };

  const formattedTestimonials = strapiTestimonials.length > 0 ? strapiTestimonials.map(t => ({
    quote: t.attributes.quote,
    author: t.attributes.author_name,
    meta: t.attributes.location || '',
    rating: t.attributes.rating,
    isVerified: t.attributes.is_verified !== false
  })) : [
    { quote: "Finally, a store that delivers what it promises. Ordered at night, had it by lunch. Quality blew me away.", author: 'Rafiq Ahmed', meta: 'Dhaka', rating: 5, isVerified: true },
    { quote: "Pre-ordered on day one. Zero regrets. Already recommended to 3 friends and they all converted.", author: 'Nusrat Jahan', meta: 'Chattogram', rating: 5, isVerified: true },
    { quote: "The difference is night and day compared to other stores. Premium quality, premium packaging. Worth every taka.", author: 'Tanvir Hasan', meta: 'Sylhet', rating: 5, isVerified: true },
  ];

  const formattedFaqs = strapiFaqs.length > 0 ? strapiFaqs.map(f => ({
    q: f.attributes.question,
    a: f.attributes.answer
  })) : [
    { q: "What if it doesn't meet my expectations?", a: "30-day no-questions-asked refund. Full protection on every order. We process returns within 48 hours." },
    { q: 'When does my order ship?', a: "Orders before 2 PM ship same day. Inside Dhaka: 24 hours. Outside Dhaka: 2-3 business days with tracking." },
    { q: 'Is my payment secure?', a: '256-bit SSL encryption. bKash verified. Cash on Delivery available. Your financial data never touches our servers.' },
    { q: 'How does the WELCOME10 code work?', a: 'Enter WELCOME10 at checkout for 10% off. First-time buyers only. No minimum purchase required.' },
  ];

  const products = await getProducts({ 'pagination[limit]': 8 });

  // Handle span splitting for hero title securely
  const titleParts = content.hero_title.split(' ');
  const firstTitleWord = titleParts[0];
  const remainingTitleWords = titleParts.slice(1).join(' ');

  return (
    <>
      <section className={styles.hero}>
        <div className={`container ${styles.heroInner}`}>
          <div>
            <div className={styles.heroBadge}>{content.hero_badge}</div>
            <h1 className={styles.heroTitle}>
              {firstTitleWord}
              {remainingTitleWords && <span> {remainingTitleWords}</span>}
            </h1>
            <p className={styles.heroSubtitle}>
              {content.hero_subtitle}
            </p>
            <div className={styles.heroCtas}>
              <Link href={content.hero_cta_link} className="btn-primary">{content.hero_cta_text}</Link>
              <Link href="#about" className="btn-secondary">Our Story</Link>
            </div>
            <div className={styles.heroStats}>
              <div className={styles.heroStat}>
                <span className={styles.heroStatNumber}>{content.stat_customers}</span>
                <span className={styles.heroStatLabel}>Customers</span>
              </div>
              <div className={styles.heroStat}>
                <span className={styles.heroStatNumber}>{content.stat_rating}</span>
                <span className={styles.heroStatLabel}>Avg Rating</span>
              </div>
              <div className={styles.heroStat}>
                <span className={styles.heroStatNumber}>{content.stat_delivery}</span>
                <span className={styles.heroStatLabel}>Delivery</span>
              </div>
            </div>
          </div>

          <div className={styles.heroVisual}>
            <img
              src={content.hero_image_url}
              alt="Premium lifestyle"
              className={styles.heroImage}
            />
          </div>
        </div>
      </section>

      <div className={styles.marquee}>
        <div className={styles.marqueeTrack}>
          {[...Array(2)].map((_, i) => (
            <div key={i} style={{ display: 'flex', gap: '4rem', flexShrink: 0 }}>
              {content.marquee_items.map((item: string, j: number) => (
                 <span key={j} className={styles.marqueeItem}>{item}<span>◆</span></span>
              ))}
            </div>
          ))}
        </div>
      </div>

      <section id="about" className={styles.valueProp}>
        <div className={`container ${styles.valuePropInner}`}>
          <ScrollReveal>
            <span className={styles.valuePropLabel}>The Problem</span>
            <h2 className={styles.valuePropTitle}>
              {content.value_prop_problem}
            </h2>
          </ScrollReveal>
          <ScrollReveal delay={200}>
            <span className={styles.valuePropLabel}>Our Answer</span>
            <p className={styles.valuePropText}>
              {content.value_prop_answer}
            </p>
          </ScrollReveal>
        </div>
      </section>

      <section className={styles.benefits}>
        <div className="container">
          <ScrollReveal>
            <span className={styles.sectionLabel}>Why Choose Us</span>
            <h2 className={styles.sectionTitle}>Every Detail, Covered</h2>
          </ScrollReveal>
          <div className={styles.benefitsGrid}>
            {content.benefits.map((b: any, i: number) => (
              <ScrollReveal key={b.title} delay={i * 80}>
                <div className={styles.benefitCard}>
                  <div className={styles.benefitIcon}>→</div>
                  <div className={styles.benefitTitle}>{b.title}</div>
                  <p className={styles.benefitDesc}>{b.desc}</p>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.featuredSection}>
        <div className="container">
          <div className={styles.sectionHeader}>
            <div>
              <span className={styles.sectionLabel}>Trending Now</span>
              <h2 className={styles.sectionTitle} style={{ marginBottom: 0 }}>
                Featured Products
              </h2>
            </div>
            <Link href="/category/all" className={styles.viewAllLink}>
              View All →
            </Link>
          </div>

          {products.length === 0 ? (
            <div className={styles.emptyState}>
              <p>No products found. Check back soon.</p>
            </div>
          ) : (
            <div className={styles.productGrid}>
              {products.map((product: any, i: number) => (
                <ScrollReveal key={product.id} delay={i * 100}>
                  <ProductCard product={product} />
                </ScrollReveal>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className={styles.socialProof}>
        <div className="container">
          <ScrollReveal>
            <span className={styles.sectionLabel}>Testimonials</span>
            <h2 className={styles.sectionTitle}>What Our Customers Say</h2>
          </ScrollReveal>

          <ScrollReveal delay={100}>
            <div className={styles.trustBar}>
              Trusted by <strong>{content.stat_customers}</strong> customers
            </div>
          </ScrollReveal>

          <div className={styles.testimonialGrid}>
            {formattedTestimonials.map((t, i) => (
              <ScrollReveal key={t.author + i} delay={i * 120}>
                <div className={styles.testimonialCard}>
                  <div className={styles.testimonialStars}>{'★'.repeat(t.rating)}</div>
                  <p className={styles.testimonialText}>&ldquo;{t.quote}&rdquo;</p>
                  <div className={styles.testimonialAuthor}>{t.author}</div>
                  <div className={styles.testimonialMeta}>
                    {t.meta && `${t.meta} · `}
                    {t.isVerified && 'Verified Buyer'}
                  </div>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.offerBelt}>
        <div className={`container ${styles.offerInner}`}>
          <ScrollReveal>
            <div className={styles.offerTag}>{content.offer_tag}</div>
            <h2 className={styles.offerTitle}>{content.offer_title}</h2>
            <p className={styles.offerSubtitle}>
              {content.offer_subtitle}
            </p>
          </ScrollReveal>
          <ScrollReveal delay={200}>
            <div className={styles.couponBadge}>
              <span className={styles.couponCode}>{content.offer_code}</span>
              <span className={styles.couponLabel}>Apply at Checkout</span>
            </div>
          </ScrollReveal>
          <ScrollReveal delay={300}>
            <Link href="/category/all" className={styles.ctaPrimaryDark}>
              Shop Now →
            </Link>
          </ScrollReveal>
        </div>
      </section>

      <section className={styles.faqSection}>
        <div className="container">
          <ScrollReveal>
            <span className={styles.sectionLabel}>FAQ</span>
            <h2 className={styles.sectionTitle}>Common Questions</h2>
          </ScrollReveal>
          <div className={styles.faqGrid}>
            {formattedFaqs.map((faq, i) => (
              <ScrollReveal key={i} delay={i * 80}>
                <div className={styles.faqItem}>
                  <div className={styles.faqQuestion}>{faq.q}</div>
                  <p className={styles.faqAnswer}>{faq.a}</p>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.finalCta}>
        <div className={`container ${styles.finalCtaInner}`}>
          <ScrollReveal>
            <h2 className={styles.finalCtaTitle}>
              {content.cta_title}
            </h2>
          </ScrollReveal>
          <ScrollReveal delay={150}>
            <ul className={styles.checkList}>
              {content.cta_perks.map((perk: string, count: number) => (
                <li key={count}><span className={styles.checkMark}>✓</span>{perk}</li>
              ))}
            </ul>
          </ScrollReveal>
          <ScrollReveal delay={300}>
            <Link href="/category/all" className="btn-primary">
              {content.cta_button_text}
            </Link>
          </ScrollReveal>
        </div>
      </section>
    </>
  );
}
