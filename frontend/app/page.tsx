import Link from 'next/link';
import { getProducts } from '@/lib/api';
import ProductCard from '@/components/ProductCard';
import HeroCanvas from '@/components/HeroCanvas';
import ScrollReveal from '@/components/ScrollReveal';
import styles from './page.module.css';

export default async function Home() {
  const products = await getProducts({ 'pagination[limit]': 8 });

  return (
    <>
      {/* ════════════════════════════════════════════════════════
          HERO — WebGL Fluid Gradient + The Hook
          ════════════════════════════════════════════════════════ */}
      <section className={styles.hero}>
        <HeroCanvas />
        <div className={`container ${styles.heroInner}`}>
          <div className={styles.heroBadge}>🔥 Limited Early Access — Founding Prices</div>

          <h1 className={styles.heroTitle}>
            Premium Essentials.<br/>
            <span>Built Different. Ships First.</span>
          </h1>

          <p className={styles.heroSubtitle}>
            Secure hand-picked, quality-verified products before the crowd.
            Pre-order now and lock in founding member pricing.
          </p>

          <div className={styles.heroCtas}>
            <Link href="/category/all" className={styles.ctaPrimary}>
              Reserve Your Spot — Shop Now →
            </Link>
            <Link href="#benefits" className={styles.ctaSecondary}>
              See Why We&#39;re Different
            </Link>
          </div>

          <div className={styles.heroStats}>
            <div className={styles.heroStat}>
              <span className={styles.heroStatNumber}>2,847+</span>
              <span className={styles.heroStatLabel}>Early Adopters</span>
            </div>
            <div className={styles.heroStat}>
              <span className={styles.heroStatNumber}>4.9★</span>
              <span className={styles.heroStatLabel}>Avg Rating</span>
            </div>
            <div className={styles.heroStat}>
              <span className={styles.heroStatNumber}>24hr</span>
              <span className={styles.heroStatLabel}>Fast Shipping</span>
            </div>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════
          VALUE PROPOSITION — Problem / Solution
          ════════════════════════════════════════════════════════ */}
      <section className={styles.valueProp}>
        <div className={`container ${styles.valuePropInner}`}>
          <ScrollReveal>
            <span className={styles.valuePropLabel}>Why Premium?</span>
          </ScrollReveal>

          <ScrollReveal delay={100}>
            <div className={styles.valueProblem}>
              <strong>The Problem:</strong> Most online stores overpromise and underdeliver.
              Slow shipping. Weak support. Generic products nobody actually vetted.
              You end up paying premium prices for mediocre quality.
            </div>
          </ScrollReveal>

          <ScrollReveal delay={200}>
            <div className={styles.valueSolution}>
              <strong>Our Solution:</strong> We built Premium Store around what actually matters —
              <strong> hand-curated quality</strong>, <strong>24-hour rapid shipping</strong>,
              and <strong>dedicated human support</strong>. No fluff. No fillers. Just products
              that earn their place in your life.
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════
          BENEFITS GRID — Trust Building
          ════════════════════════════════════════════════════════ */}
      <section id="benefits" className={styles.benefits}>
        <div className="container">
          <ScrollReveal>
            <span className={styles.sectionLabel}>Why Choose Us</span>
            <h2 className={styles.sectionTitle}>Every Detail, Covered</h2>
          </ScrollReveal>

          <div className={styles.benefitsGrid}>
            {[
              { icon: '🚚', title: 'Local Warranty', desc: 'Your purchase is protected right here — no overseas runaround, no fine print.' },
              { icon: '⚡', title: '24hr Fast Shipping', desc: 'Orders placed before 2 PM ship same day. Dhaka delivery in under 24 hours.' },
              { icon: '⭐', title: '4.9★ Verified Reviews', desc: 'Real buyers, real results. Every review is from a verified purchase.' },
              { icon: '🔒', title: 'Secure Checkout', desc: '256-bit encryption. bKash & COD supported. Your data never leaves our vault.' },
              { icon: '💬', title: 'Dedicated Support', desc: "Real humans, fast responses. We don't hide behind chatbots or ticket queues." },
              { icon: '🔄', title: 'Easy Returns', desc: "30-day no-questions-asked refund policy. If it doesn't work, we make it right." },
            ].map((b, i) => (
              <ScrollReveal key={b.title} delay={i * 100}>
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
          SOCIAL PROOF — Testimonials
          ════════════════════════════════════════════════════════ */}
      <section className={styles.socialProof}>
        <div className="container">
          <ScrollReveal>
            <span className={styles.sectionLabel}>Real Feedback</span>
            <h2 className={styles.sectionTitle}>What Our Customers Say</h2>
          </ScrollReveal>

          <ScrollReveal delay={100}>
            <div className={styles.trustBar}>
              Trusted by <strong>2,847+</strong> early adopters across <strong>38</strong> districts nationwide
            </div>
          </ScrollReveal>

          <div className={styles.testimonialGrid}>
            {[
              { text: "Finally, a store that actually delivers what it promises. Ordered at night, had it by lunch. The quality blew me away.", author: 'Rafiq Ahmed', meta: 'Dhaka · Verified Buyer' },
              { text: "Pre-ordered on day one. Zero regrets. Already recommended to 3 friends and they all converted.", author: 'Nusrat Jahan', meta: 'Chattogram · Verified Buyer' },
              { text: "The difference is night and day compared to other stores. Premium quality, premium packaging, worth every taka.", author: 'Tanvir Hasan', meta: 'Sylhet · Verified Buyer' },
            ].map((t, i) => (
              <ScrollReveal key={t.author} delay={i * 150}>
                <div className={styles.testimonialCard}>
                  <div className={styles.testimonialStars}>★★★★★</div>
                  <p className={styles.testimonialText}>&ldquo;{t.text}&rdquo;</p>
                  <div className={styles.testimonialAuthor}>{t.author}</div>
                  <div className={styles.testimonialMeta}>{t.meta}</div>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════
          FEATURED PRODUCTS — The Offer
          ════════════════════════════════════════════════════════ */}
      <section className={styles.featuredSection}>
        <div className="container">
          <div className={styles.sectionHeader}>
            <ScrollReveal>
              <div>
                <span className={styles.sectionLabel} style={{ textAlign: 'left' }}>Trending Now</span>
                <h2 className={styles.sectionTitle} style={{ textAlign: 'left', marginBottom: 0 }}>
                  Featured Products
                </h2>
              </div>
            </ScrollReveal>
            <Link href="/category/all" className={styles.viewAllLink}>
              View All →
            </Link>
          </div>

          {products.length === 0 ? (
            <div className={styles.emptyState}>
              <h3>No products found</h3>
              <p>Looks like our catalog is currently empty. Check back soon!</p>
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
          OFFER BELT — Coupon / Urgency
          ════════════════════════════════════════════════════════ */}
      <section className={styles.offerBelt}>
        <div className={`container ${styles.offerInner}`}>
          <ScrollReveal>
            <div className={styles.offerTag}>⏳ Limited Time Offer</div>

            <h2 className={styles.offerTitle}>
              First-Time Buyer? Get 10% Off Instantly.
            </h2>
            <p className={styles.offerSubtitle}>
              Use code at checkout. Founding price — once it&#39;s gone, it&#39;s gone.
            </p>
          </ScrollReveal>

          <ScrollReveal delay={200}>
            <div className={styles.couponBadge}>
              <span className={styles.couponCode}>WELCOME10</span>
              <span className={styles.couponLabel}>← Apply at Checkout</span>
            </div>
          </ScrollReveal>

          <ScrollReveal delay={300}>
            <Link href="/category/all" className={styles.ctaPrimary}>
              Claim Your Discount — Shop Now →
            </Link>
          </ScrollReveal>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════
          FAQ — Trust Reinforcement
          ════════════════════════════════════════════════════════ */}
      <section className={styles.faqSection}>
        <div className="container">
          <ScrollReveal>
            <span className={styles.sectionLabel}>Got Questions?</span>
            <h2 className={styles.sectionTitle}>Frequently Asked Questions</h2>
          </ScrollReveal>

          <div className={styles.faqGrid}>
            {[
              { q: "💡 What if it doesn't meet my expectations?", a: "30-day no-questions-asked refund. You're fully protected. We'll process your return within 48 hours of receiving the item." },
              { q: '📦 When does it ship?', a: "Orders placed before 2 PM ship same day. Inside Dhaka: 24 hours. Outside Dhaka: 2-3 business days. You'll get tracking updates every step." },
              { q: '🔐 Is my payment secure?', a: '256-bit SSL encryption. bKash verified. Cash on Delivery available. Your financial data never touches our servers directly.' },
              { q: '🎁 How does the WELCOME10 coupon work?', a: 'Simply enter WELCOME10 at checkout and get 10% off your entire order. Valid for first-time buyers only. No minimum purchase required.' },
            ].map((faq, i) => (
              <ScrollReveal key={i} delay={i * 100}>
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
          FINAL CTA — The Closer
          ════════════════════════════════════════════════════════ */}
      <section className={styles.finalCta}>
        <div className={`container ${styles.finalCtaInner}`}>
          <ScrollReveal>
            <h2 className={styles.finalCtaTitle}>
              Don&#39;t Wait. Founding Members Get:
            </h2>
          </ScrollReveal>

          <ScrollReveal delay={150}>
            <ul className={styles.checkList}>
              <li>
                <span className={styles.checkMark}>✓</span>
                Founding price locked in forever
              </li>
              <li>
                <span className={styles.checkMark}>✓</span>
                Priority same-day shipping
              </li>
              <li>
                <span className={styles.checkMark}>✓</span>
                Exclusive early access to new drops
              </li>
              <li>
                <span className={styles.checkMark}>✓</span>
                Direct line to our support team
              </li>
            </ul>
          </ScrollReveal>

          <ScrollReveal delay={300}>
            <Link href="/category/all" className={styles.ctaPrimary} style={{ fontSize: '1.1rem', padding: '18px 40px' }}>
              → Claim Your Founding Price — Ships in 24hrs
            </Link>
          </ScrollReveal>
        </div>
      </section>
    </>
  );
}
