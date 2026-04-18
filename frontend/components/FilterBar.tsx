'use strict';
'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useCallback } from 'react';
import styles from './FilterBar.module.css';

export default function FilterBar() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const currentSort = searchParams.get('sort') || '';
  const inStockOnly = searchParams.get('inStock') === 'true';

  const createQueryString = useCallback(
    (name: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set(name, value);
      } else {
        params.delete(name);
      }
      return params.toString();
    },
    [searchParams]
  );

  const handleSortChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    router.push(pathname + '?' + createQueryString('sort', e.target.value));
  };

  const handleInStockToggle = (e: React.ChangeEvent<HTMLInputElement>) => {
    router.push(pathname + '?' + createQueryString('inStock', e.target.checked ? 'true' : ''));
  };

  return (
    <div className={styles.filterBar}>
      <div className={styles.filterGroup}>
        <label className={styles.filterLabel} htmlFor="sort-select">Sort By</label>
        <select 
          id="sort-select"
          className={styles.filterSelect}
          value={currentSort} 
          onChange={handleSortChange}
        >
          <option value="">Featured</option>
          <option value="createdAt:desc">Newest Arrivals</option>
          <option value="price:asc">Price: Low to High</option>
          <option value="price:desc">Price: High to Low</option>
        </select>
      </div>

      <div className={styles.filterGroupToggle}>
        <label className={styles.checkboxLabel}>
          <input 
            type="checkbox" 
            checked={inStockOnly}
            onChange={handleInStockToggle}
            className={styles.checkbox}
          />
          <span className={styles.checkboxText}>In Stock Only</span>
        </label>
      </div>
    </div>
  );
}
