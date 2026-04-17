import Link from 'next/link';
import { getProducts } from '@/lib/api';
import ProductCard from '@/components/ProductCard';
import ScrollReveal from '@/components/ScrollReveal';
import styles from './page.module.css';

export default async function Home() {
  const products = await getProducts({ 'pagination[limit]': 8 });

  return (
    <>
      {/* ════════════════════════════════════════════════════════
          HERO — Asymmetric Editorial
          ════════════════════════════════════════════════════════ */}
      <section className={styles.hero}>
        <div className={`container ${styles.heroInner}`}>
          <div>
            <div className={styles.heroBadge}>Now Accepting Pre-Orders</div>
            <h1 className={styles.heroTitle}>
              Premium
              <span>Essentials.</span>
            </h1>
            <p className={styles.heroSubtitle}>
              Hand-curated, quality-verified products for those who refuse to compromise.
              Secure founding member pricing before stock runs out.
            </p>
            <div className={styles.heroCtas}>
              <Link href="/category/all" className="btn-primary">Shop Collection</Link>
              <Link href="#about" className="btn-secondary">Our Story</Link>
            </div>
            <div className={styles.heroStats}>
              <div className={styles.heroStat}>
                <span className={styles.heroStatNumber}>2,847+</span>
                <span className={styles.heroStatLabel}>Customers</span>
              </div>
              <div className={styles.heroStat}>
                <span className={styles.heroStatNumber}>4.9</span>
                <span className={styles.heroStatLabel}>Avg Rating</span>
              </div>
              <div className={styles.heroStat}>
                <span className={styles.heroStatNumber}>24hr</span>
                <span className={styles.heroStatLabel}>Delivery</span>
              </div>
            </div>
          </div>

          <div className={styles.heroVisual}>
            <img
              src="/images/hero-visual.jpg"
              alt="Premium lifestyle — dark moody scene"
              className={styles.heroImage}
            />
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════
          MARQUEE — Running Text
          ════════════════════════════════════════════════════════ */}
      <div className={styles.marquee}>
        <div className={styles.marqueeTrack}>
          {[...Array(2)].map((_, i) => (
            <div key={i} style={{ display: 'flex', gap: '4rem', flexShrink: 0 }}>
              <span className={styles.marqueeItem}>Free Shipping Inside Dhaka<span>◆</span></span>
              <span className={styles.marqueeItem}>24hr Fast Delivery<span>◆</span></span>
              <span className={styles.marqueeItem}>Use Code WELCOME10<span>◆</span></span>
              <span className={styles.marqueeItem}>Verified Reviews Only<span>◆</span></span>
              <span className={styles.marqueeItem}>Secure bKash Checkout<span>◆</span></span>
              <span className={styles.marqueeItem}>30-Day Returns<span>◆</span></span>
            </div>
          ))}
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════
          VALUE PROPOSITION
          ════════════════════════════════════════════════════════ */}
      <section id="about" className={styles.valueProp}>
        <div className={`container ${styles.valuePropInner}`}>
          <ScrollReveal>
            <span className={styles.valuePropLabel}>The Problem</span>
            <h2 className={styles.valuePropTitle}>
              Most online stores overpromise and underdeliver.
            </h2>
          </ScrollReveal>
          <ScrollReveal delay={200}>
            <span className={styles.valuePropLabel}>Our Answer</span>
            <p className={styles.valuePropText}>
              We built Premium around what actually matters — hand-curated quality,
              24-hour rapid shipping, and dedicated human support. Every product earns
              its place through rigorous testing. No fluff. No fillers. No compromises.
              Just products that work exactly as advertised.
            </p>
          </ScrollReveal>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════
          BENEFITS GRID
          ════════════════════════════════════════════════════════ */}
      <section className={styles.benefits}>
        <div className="container">
          <ScrollReveal>
            <span className={styles.sectionLabel}>Why Choose Us</span>
            <h2 className={styles.sectionTitle}>Every Detail, Covered</h2>
          </ScrollReveal>
          <div className={styles.benefitsGrid}>
            {[
              { icon: '→', title: 'Local Warranty', desc: 'Your purchase is protected. No overseas runaround, no fine print, no exceptions.' },
              { icon: '→', title: '24hr Shipping', desc: 'Orders before 2 PM ship same day. Inside Dhaka delivery in under 24 hours.' },
              { icon: '→', title: 'Verified Reviews', desc: 'Real buyers, real results. Every review comes from a verified purchase only.' },
              { icon: '→', title: 'Secure Checkout', desc: '256-bit encryption with bKash and COD support. Your data stays locked.' },
              { icon: '→', title: 'Human Support', desc: 'Real people, fast responses. No chatbots, no ticket queues, no runaround.' },
              { icon: '→', title: 'Easy Returns', desc: '30-day no-questions-asked refund policy. Full protection on every order.' },
            ].map((b, i) => (
              <ScrollReveal key={b.title} delay={i * 80}>
                <div className={styles.benefitCard}>
                  <div className={styles.benefitIcon}>{b.icon}</div>
                  <div className={styles.benefitTitle}>{b.title}</div>
                  <p className={styles.benefitDesc}>{b.desc}</p>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════
          FEATURED PRODUCTS
          ════════════════════════════════════════════════════════ */}
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

      {/* ════════════════════════════════════════════════════════
          SOCIAL PROOF
          ════════════════════════════════════════════════════════ */}
      <section className={styles.socialProof}>
        <div className="container">
          <ScrollReveal>
            <span className={styles.sectionLabel}>Testimonials</span>
            <h2 className={styles.sectionTitle}>What Our Customers Say</h2>
          </ScrollReveal>

          <ScrollReveal delay={100}>
            <div className={styles.trustBar}>
              Trusted by <strong>2,847+</strong> customers across <strong>38</strong> districts
            </div>
          </ScrollReveal>

          <div className={styles.testimonialGrid}>
            {[
              { text: "Finally, a store that delivers what it promises. Ordered at night, had it by lunch. Quality blew me away.", author: 'Rafiq Ahmed', meta: 'Dhaka' },
              { text: "Pre-ordered on day one. Zero regrets. Already recommended to 3 friends and they all converted.", author: 'Nusrat Jahan', meta: 'Chattogram' },
              { text: "The difference is night and day compared to other stores. Premium quality, premium packaging. Worth every taka.", author: 'Tanvir Hasan', meta: 'Sylhet' },
            ].map((t, i) => (
              <ScrollReveal key={t.author} delay={i * 120}>
                <div className={styles.testimonialCard}>
                  <div className={styles.testimonialStars}>★★★★★</div>
                  <p className={styles.testimonialText}>&ldquo;{t.text}&rdquo;</p>
                  <div className={styles.testimonialAuthor}>{t.author}</div>
                  <div className={styles.testimonialMeta}>{t.meta} · Verified Buyer</div>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════
          OFFER BELT — Inverted
          ════════════════════════════════════════════════════════ */}
      <section className={styles.offerBelt}>
        <div className={`container ${styles.offerInner}`}>
          <ScrollReveal>
            <div className={styles.offerTag}>Limited Offer</div>
            <h2 className={styles.offerTitle}>10% Off Your First Order</h2>
            <p className={styles.offerSubtitle}>
              Use code at checkout. Founding price — once stock runs out, it&#39;s gone.
            </p>
          </ScrollReveal>
          <ScrollReveal delay={200}>
            <div className={styles.couponBadge}>
              <span className={styles.couponCode}>WELCOME10</span>
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

      {/* ════════════════════════════════════════════════════════
          FAQ
          ════════════════════════════════════════════════════════ */}
      <section className={styles.faqSection}>
        <div className="container">
          <ScrollReveal>
            <span className={styles.sectionLabel}>FAQ</span>
            <h2 className={styles.sectionTitle}>Common Questions</h2>
          </ScrollReveal>
          <div className={styles.faqGrid}>
            {[
              { q: "What if it doesn't meet my expectations?", a: "30-day no-questions-asked refund. Full protection on every order. We process returns within 48 hours." },
              { q: 'When does my order ship?', a: "Orders before 2 PM ship same day. Inside Dhaka: 24 hours. Outside Dhaka: 2-3 business days with tracking." },
              { q: 'Is my payment secure?', a: '256-bit SSL encryption. bKash verified. Cash on Delivery available. Your financial data never touches our servers.' },
              { q: 'How does the WELCOME10 code work?', a: 'Enter WELCOME10 at checkout for 10% off. First-time buyers only. No minimum purchase required.' },
            ].map((faq, i) => (
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

      {/* ════════════════════════════════════════════════════════
          FINAL CTA
          ════════════════════════════════════════════════════════ */}
      <section className={styles.finalCta}>
        <div className={`container ${styles.finalCtaInner}`}>
          <ScrollReveal>
            <h2 className={styles.finalCtaTitle}>
              Founding Members Get:
            </h2>
          </ScrollReveal>
          <ScrollReveal delay={150}>
            <ul className={styles.checkList}>
              <li><span className={styles.checkMark}>✓</span>Founding price locked in forever</li>
              <li><span className={styles.checkMark}>✓</span>Priority same-day shipping</li>
              <li><span className={styles.checkMark}>✓</span>Early access to new drops</li>
              <li><span className={styles.checkMark}>✓</span>Direct line to our team</li>
            </ul>
          </ScrollReveal>
          <ScrollReveal delay={300}>
            <Link href="/category/all" className="btn-primary">
              Claim Your Founding Price →
            </Link>
          </ScrollReveal>
        </div>
      </section>
    </>
  );
}
