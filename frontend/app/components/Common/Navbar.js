'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import styles from './Navbar.module.css';
import { buildApiUrl, API_ENDPOINTS } from '../../lib/config';

export default function Navbar({ onLogout }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const router = useRouter();
  const pathname = usePathname();
  const linkClass = (path) => `${styles.navLink} ${pathname === path || (path !== '/' && pathname.startsWith(`${path}/`)) ? styles.activeLink : ''}`;

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      setIsAuthenticated(true);
      // Fetch user info
      fetchUserInfo(token);
    }
  }, []);

  const fetchUserInfo = async (token) => {
    try {
      const response = await fetch(buildApiUrl(API_ENDPOINTS.ME), {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
      }
    } catch (err) {
      console.error('Error fetching user info:', err);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setIsAuthenticated(false);
    setUser(null);
    if (onLogout) {
      onLogout();
    } else {
      router.push('/login');
    }
  };

  return (
    <nav className={styles.navbar}>
      <div className={styles.logo}>
        <Link href="/dashboard"><span>News</span><span className={styles.logoAccent}>AI</span></Link>
      </div>
      <div className={styles.navLinks}>
        <Link href="/" className={linkClass('/')}>Home</Link>
        <Link href="/sectors" className={linkClass('/sectors')}>Sectors</Link>
        <Link href="/sector-profits" className={linkClass('/sector-profits')}>Sector Profits</Link>
        <Link href="/where-to-invest" className={linkClass('/where-to-invest')}>Where to Invest</Link>
        <Link href="/companies" className={linkClass('/companies')}>Companies</Link>
        <Link href="/news" className={linkClass('/news')}>News</Link>
        {isAuthenticated ? (
          <>
            <Link href="/dashboard" className={linkClass('/dashboard')}>Dashboard</Link>
            <Link href="/watchlist" className={linkClass('/watchlist')}>Watchlist</Link>
            <Link href="/finance" className={linkClass('/finance')}>Finance</Link>
            <div className={styles.userSection}>
              <Link href="/profile" className={styles.profileLink}>
                {user?.username || 'User'}
              </Link>
              <button onClick={handleLogout} className={styles.logoutBtn}>
                Logout
              </button>
            </div>
          </>
        ) : (
          <>
            <Link href="/login" className={styles.goldButton}>Sign In</Link>
            <Link href="/signup" className={styles.goldButton}>Sign Up</Link>
          </>
        )}
      </div>
    </nav>
  );
}
