'use client'

import { useState, useEffect } from 'react';
import styles from './ReviewSection.module.css';

const COMMERCE_API = process.env.NEXT_PUBLIC_COMMERCE_API_URL || 'http://localhost:4000/api/v1';

interface Review {
  id: number;
  rating: number;
  comment: string;
  author_name: string;
  is_verified_purchase: boolean;
  created_at: string;
}

function StarRating({ rating, size = 18, interactive = false, onChange }: {
  rating: number;
  size?: number;
  interactive?: boolean;
  onChange?: (r: number) => void;
}) {
  const [hover, setHover] = useState(0);

  return (
    <div className={styles.stars} style={{ gap: `${size * 0.15}px` }}>
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = interactive ? star <= (hover || rating) : star <= rating;
        return (
          <svg
            key={star}
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill={filled ? '#f59e0b' : 'none'}
            stroke={filled ? '#f59e0b' : '#d1d5db'}
            strokeWidth="1.5"
            className={interactive ? styles.starInteractive : ''}
            onMouseEnter={() => interactive && setHover(star)}
            onMouseLeave={() => interactive && setHover(0)}
            onClick={() => interactive && onChange?.(star)}
            style={{ cursor: interactive ? 'pointer' : 'default' }}
          >
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
          </svg>
        );
      })}
    </div>
  );
}

function timeAgo(dateStr: string) {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

export default function ReviewSection({ productId, productSlug }: {
  productId: number;
  productSlug: string;
}) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [average, setAverage] = useState(0);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Fetch reviews on mount
  useEffect(() => {
    fetchReviews();
  }, [productId]);

  async function fetchReviews() {
    try {
      const res = await fetch(`${COMMERCE_API}/reviews/product/${productId}`);
      const data = await res.json();
      if (data.success) {
        setReviews(data.reviews);
        setAverage(data.average);
        setCount(data.count);
      }
    } catch (err) {
      console.error('Failed to fetch reviews:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (rating === 0) {
      setMessage({ type: 'error', text: 'Please select a star rating' });
      return;
    }
    if (comment.trim().length < 10) {
      setMessage({ type: 'error', text: 'Comment must be at least 10 characters' });
      return;
    }

    setSubmitting(true);
    setMessage(null);

    // Get token from localStorage (set during login)
    const token = localStorage.getItem('accessToken');
    if (!token) {
      setMessage({ type: 'error', text: 'Please log in to submit a review' });
      setSubmitting(false);
      return;
    }

    try {
      const res = await fetch(`${COMMERCE_API}/reviews`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          productId,
          productSlug,
          rating,
          comment: comment.trim(),
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setMessage({ type: 'success', text: 'Review submitted! It will appear after admin approval.' });
        setRating(0);
        setComment('');
        setShowForm(false);
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to submit review' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Network error — please try again' });
    } finally {
      setSubmitting(false);
    }
  }

  // Rating distribution
  const distribution = [5, 4, 3, 2, 1].map(star => ({
    star,
    count: reviews.filter(r => r.rating === star).length,
    pct: count > 0 ? (reviews.filter(r => r.rating === star).length / count) * 100 : 0,
  }));

  return (
    <section className={styles.section} id="reviews">
      <h2 className={styles.heading}>Customer Reviews</h2>

      {loading ? (
        <div className={styles.loading}>Loading reviews...</div>
      ) : (
        <>
          {/* ── Summary Bar ──────────────────────────────────────────── */}
          <div className={styles.summary}>
            <div className={styles.summaryLeft}>
              <div className={styles.averageBig}>{average.toFixed(1)}</div>
              <StarRating rating={Math.round(average)} size={22} />
              <div className={styles.countLabel}>
                Based on {count} review{count !== 1 ? 's' : ''}
              </div>
            </div>

            <div className={styles.summaryRight}>
              {distribution.map(d => (
                <div key={d.star} className={styles.distRow}>
                  <span className={styles.distStar}>{d.star}★</span>
                  <div className={styles.distBar}>
                    <div className={styles.distFill} style={{ width: `${d.pct}%` }} />
                  </div>
                  <span className={styles.distCount}>{d.count}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ── Write Review Button / Form ────────────────────────── */}
          {message && (
            <div className={`${styles.message} ${styles[message.type]}`}>
              {message.text}
            </div>
          )}

          {!showForm ? (
            <button
              className={styles.writeBtn}
              onClick={() => setShowForm(true)}
            >
              ✍️ Write a Review
            </button>
          ) : (
            <form className={styles.form} onSubmit={handleSubmit}>
              <div className={styles.formGroup}>
                <label className={styles.label}>Your Rating</label>
                <StarRating
                  rating={rating}
                  size={28}
                  interactive
                  onChange={setRating}
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="review-comment">Your Review</label>
                <textarea
                  id="review-comment"
                  className={styles.textarea}
                  rows={4}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Share your experience with this product..."
                  minLength={10}
                  required
                />
              </div>

              <div className={styles.formActions}>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={submitting}
                >
                  {submitting ? 'Submitting...' : 'Submit Review'}
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => { setShowForm(false); setMessage(null); }}
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          {/* ── Review List ───────────────────────────────────────── */}
          {reviews.length > 0 ? (
            <div className={styles.list}>
              {reviews.map(review => (
                <div key={review.id} className={styles.card}>
                  <div className={styles.cardHeader}>
                    <div className={styles.authorAvatar}>
                      {review.author_name.charAt(0).toUpperCase()}
                    </div>
                    <div className={styles.authorInfo}>
                      <div className={styles.authorRow}>
                        <span className={styles.authorName}>{review.author_name}</span>
                        {review.is_verified_purchase && (
                          <span className={styles.verifiedBadge}>✓ Verified Purchase</span>
                        )}
                      </div>
                      <div className={styles.cardMeta}>
                        <StarRating rating={review.rating} size={14} />
                        <span className={styles.timeAgo}>{timeAgo(review.created_at)}</span>
                      </div>
                    </div>
                  </div>
                  <p className={styles.comment}>{review.comment}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className={styles.empty}>
              No reviews yet — be the first to share your experience!
            </div>
          )}
        </>
      )}
    </section>
  );
}
