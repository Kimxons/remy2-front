"use client"

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { clearAuthSessionCookie } from "../../utils/cookies";
import "./Navbar.scss";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";

const Navbar = () => {
  const [user, setUser] = useState(null);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [loading, setLoading] = useState(true);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const dropdownRef = useRef(null);
  const mobileMenuRef = useRef(null);
  const router = useRouter();
  const pathname = usePathname();

  const fetchUserProfile = useCallback(async () => {
    const token = localStorage.getItem("accessToken");
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/api/users/me/`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (response.ok) {
        const data = await response.json();
        setUser(data);
        localStorage.setItem("currentUser", JSON.stringify(data));
      } else if (response.status === 401) {
        localStorage.removeItem("accessToken");
        localStorage.removeItem("refreshToken");
        localStorage.removeItem("currentUser");
        clearAuthSessionCookie();
        setUser(null);
      }
    } catch (error) {
      const isNetworkError =
        error instanceof TypeError ||
        /failed to fetch|networkerror|load failed/i.test(String(error?.message || ""));
      if (!isNetworkError && process.env.NODE_ENV === "development") {
        console.error("Failed to fetch user profile:", error);
      }
      const cachedUser = localStorage.getItem("currentUser");
      if (cachedUser) {
        try {
          setUser(JSON.parse(cachedUser));
        } catch {
          setUser(null);
        }
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchUnreadNotifications = useCallback(async () => {
    const token = localStorage.getItem("accessToken");
    if (!token) {
      setUnreadNotifications(0);
      return;
    }

    const endpointCandidates = [
      `${API_BASE}/api/users/dashboard/notifications/`,
      `${API_BASE}/api/users/notifications/`,
      `${API_BASE}/api/notifications/`,
    ];

    for (const endpoint of endpointCandidates) {
      try {
        const response = await fetch(endpoint, {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        });

        if (response.status === 404 || response.status === 405) {
          continue;
        }
        if (!response.ok) {
          return;
        }

        const payload = await response.json();
        const toArray = (value) => {
          if (Array.isArray(value)) return value;
          if (Array.isArray(value?.results)) return value.results;
          return [];
        };

        const notifications = [
          ...toArray(payload?.notifications),
          ...toArray(payload?.recent_notifications),
          ...toArray(payload?.results),
          ...toArray(payload),
        ];

        setUnreadNotifications(
          notifications.reduce((count, item) => (item?.is_read === false ? count + 1 : count), 0)
        );
        return;
      } catch (error) {
        const isNetworkError =
          error instanceof TypeError ||
          /failed to fetch|networkerror|load failed/i.test(String(error?.message || ""));
        if (!isNetworkError && process.env.NODE_ENV === "development") {
          console.error("Failed to fetch notifications:", error);
        }
        setUnreadNotifications(0);
        return;
      }
    }

    setUnreadNotifications(0);
  }, []);

  useEffect(() => {
    fetchUserProfile();
  }, [fetchUserProfile]);

  useEffect(() => {
    fetchUnreadNotifications();
    const interval = window.setInterval(fetchUnreadNotifications, 30000);
    return () => window.clearInterval(interval);
  }, [fetchUnreadNotifications]);

  useEffect(() => {
    window.addEventListener("auth:changed", fetchUnreadNotifications);
    return () => {
      window.removeEventListener("auth:changed", fetchUnreadNotifications);
    };
  }, [fetchUnreadNotifications]);

  useEffect(() => {
    const syncAuthState = () => {
      const userString = localStorage.getItem("currentUser");
      if (!userString) {
        setUser(null);
        setUnreadNotifications(0);
        setLoading(false);
        return;
      }

      try {
        setUser(JSON.parse(userString));
      } catch (err) {
        console.error("Failed to parse currentUser from storage:", err);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    window.addEventListener("storage", syncAuthState);
    window.addEventListener("auth:changed", syncAuthState);

    return () => {
      window.removeEventListener("storage", syncAuthState);
      window.removeEventListener("auth:changed", syncAuthState);
    };
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
      if (
        mobileMenuRef.current &&
        !mobileMenuRef.current.contains(event.target) &&
        !event.target.closest(".navbar__mobile-toggle")
      ) {
        setMobileMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    setDropdownOpen(false);
    setMobileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = mobileMenuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileMenuOpen]);

  const handleLogout = async () => {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("currentUser");
    localStorage.removeItem("guestSessionKey");
    clearAuthSessionCookie();
    window.dispatchEvent(new Event("auth:changed"));
    setUser(null);
    setUnreadNotifications(0);
    setDropdownOpen(false);
    router.push("/");
  };

  const getDashboardPath = () => {
    if (!user) return "/login";
    if (user.role === "ADMIN") return "/admin";
    return "/dashboard";
  };

  const formatCurrency = (amount) => {
    const num = parseFloat(amount) || 0;
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(num);
  };

  const getInitials = (name) => {
    if (!name) return "U";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const navLinks = [
    { path: "/categories", label: "Categories" },
    {path: "/about", label: "About"},
  ];

  const isActivePath = (path) => pathname === path;

  return (
    <>
      <nav className={`navbar ${scrolled ? "navbar--scrolled" : ""}`}>
        <div className="navbar__container">
          <Link href="/" className="navbar__logo">
            <span className="navbar__logo-icon">✦</span>
            <span className="navbar__logo-text">RemyInk</span>
          </Link>

          {!user && (
            <div className="navbar__nav">
              {navLinks.map((link) => (
                <Link
                  key={link.path}
                  href={link.path}
                  className={`navbar__nav-link ${isActivePath(link.path) ? "navbar__nav-link--active" : ""}`}
                >
                  {link.label}
                </Link>
              ))}
            </div>
          )}

          <div className="navbar__actions">
            {loading ? (
              <div className="navbar__skeleton">
                <div className="navbar__skeleton-item" />
              </div>
            ) : user ? (
              <>
                <Link href="/messages" className="navbar__icon-btn" aria-label="Messages">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                  {user.unread_messages > 0 && (
                    <span className="navbar__badge">
                      {user.unread_messages > 99 ? "99+" : user.unread_messages}
                    </span>
                  )}
                </Link>

                <Link href="/notifications" className="navbar__icon-btn" aria-label="Notifications">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                  </svg>
                  {unreadNotifications > 0 && (
                    <span className="navbar__badge">
                      {unreadNotifications > 99 ? "99+" : unreadNotifications}
                    </span>
                  )}
                </Link>

                <div className="navbar__user" ref={dropdownRef}>
                  <button
                    className="navbar__user-trigger"
                    onClick={() => setDropdownOpen(!dropdownOpen)}
                    aria-expanded={dropdownOpen}
                    aria-haspopup="true"
                  >
                    <div className="navbar__avatar">
                      {user.avatar ? (
                        <img src={user.avatar} alt={user.username} />
                      ) : (
                        <span>{getInitials(user.username)}</span>
                      )}
                    </div>
                    <div className="navbar__user-info">
                      <span className="navbar__user-name">{user.username}</span>
                      <span className={`navbar__user-role navbar__user-role--${user.role?.toLowerCase()}`}>
                        {user.role}
                      </span>
                    </div>
                    <svg
                      className={`navbar__chevron ${dropdownOpen ? "navbar__chevron--open" : ""}`}
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </button>

                  {dropdownOpen && (
                    <div className="navbar__dropdown">
                      <div className="navbar__dropdown-menu">
                        <Link href={getDashboardPath()} className="navbar__dropdown-item">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="3" y="3" width="7" height="7" />
                            <rect x="14" y="3" width="7" height="7" />
                            <rect x="14" y="14" width="7" height="7" />
                            <rect x="3" y="14" width="7" height="7" />
                          </svg>
                          Dashboard
                        </Link>

                        <Link href="/profile" className="navbar__dropdown-item">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                            <circle cx="12" cy="7" r="4" />
                          </svg>
                          Profile
                        </Link>
                        
                        {user.role !== "CLIENT" && (
                          <Link href="/orders" className="navbar__dropdown-item">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                              <polyline points="14 2 14 8 20 8" />
                              <line x1="16" y1="13" x2="8" y2="13" />
                              <line x1="16" y1="17" x2="8" y2="17" />
                            </svg>
                            Orders
                          </Link>
                        )}

                        
                        {user.is_freelancer && (
                          <Link href="/earnings" className="navbar__dropdown-item">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <line x1="12" y1="1" x2="12" y2="23" />
                              <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                            </svg>
                            Earnings
                          </Link>
                        )}

                        <Link href="/settings" className="navbar__dropdown-item">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="3" />
                            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                          </svg>
                          Settings
                        </Link>
                      </div>

                      <div className="navbar__dropdown-footer">
                        <button onClick={handleLogout} className="navbar__dropdown-logout">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                            <polyline points="16 17 21 12 16 7" />
                            <line x1="21" y1="12" x2="9" y2="12" />
                          </svg>
                          Sign Out
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <Link href="/login" className="navbar__btn navbar__btn--ghost">
                  Sign In
                </Link>
                {/* REMOVED GET STARTED BUTTON */}
              </>
            )}

            <button
              className="navbar__mobile-toggle"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle menu"
              aria-expanded={mobileMenuOpen}
            >
              <span className={`navbar__hamburger ${mobileMenuOpen ? "navbar__hamburger--open" : ""}`}>
                <span />
                <span />
                <span />
              </span>
            </button>
          </div>
        </div>
      </nav>

      <div
        className={`navbar__mobile-overlay ${mobileMenuOpen ? "navbar__mobile-overlay--open" : ""}`}
        onClick={() => setMobileMenuOpen(false)}
      />

      <div
        ref={mobileMenuRef}
        className={`navbar__mobile-menu ${mobileMenuOpen ? "navbar__mobile-menu--open" : ""}`}
      >
        <div className="navbar__mobile-header">
          <Link href="/" className="navbar__logo" onClick={() => setMobileMenuOpen(false)}>
            <span className="navbar__logo-icon">✦</span>
            <span className="navbar__logo-text">RemyInk</span>
          </Link>
          <button
            className="navbar__mobile-close"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Close menu"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {user && (
          <div className="navbar__mobile-user">
            <div className="navbar__mobile-avatar">
              {user.avatar ? (
                <img src={user.avatar} alt={user.username} />
              ) : (
                <span>{getInitials(user.username)}</span>
              )}
            </div>
            <div className="navbar__mobile-user-info">
              <span className="navbar__mobile-user-name">{user.username}</span>
              <span className={`navbar__mobile-user-role navbar__mobile-user-role--${user.role?.toLowerCase()}`}>
                {user.role}
              </span>
            </div>
            {user.is_freelancer && (
              <div className="navbar__mobile-balance">{formatCurrency(user.current_balance)}</div>
            )}
          </div>
        )}

        <nav className="navbar__mobile-nav">
          {!user &&
            navLinks.map((link) => (
              <Link
                key={link.path}
                href={link.path}
                className="navbar__mobile-link"
                onClick={() => setMobileMenuOpen(false)}
              >
                {link.label}
              </Link>
            ))}

          {user && (
            <>
              <Link
                href={getDashboardPath()}
                className="navbar__mobile-link"
                onClick={() => setMobileMenuOpen(false)}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="7" height="7" />
                  <rect x="14" y="3" width="7" height="7" />
                  <rect x="14" y="14" width="7" height="7" />
                  <rect x="3" y="14" width="7" height="7" />
                </svg>
                Dashboard
              </Link>

              <Link href="/messages" className="navbar__mobile-link" onClick={() => setMobileMenuOpen(false)}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
                Messages
                {user.unread_messages > 0 && (
                  <span className="navbar__mobile-badge">{user.unread_messages}</span>
                )}
              </Link>

              <Link href="/notifications" className="navbar__mobile-link" onClick={() => setMobileMenuOpen(false)}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
                Notifications
                {unreadNotifications > 0 && (
                  <span className="navbar__mobile-badge">
                    {unreadNotifications > 99 ? "99+" : unreadNotifications}
                  </span>
                )}
              </Link>

              <Link href="/orders" className="navbar__mobile-link" onClick={() => setMobileMenuOpen(false)}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
                Orders
              </Link>

              <Link href="/profile" className="navbar__mobile-link" onClick={() => setMobileMenuOpen(false)}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
                Profile
              </Link>

              {user.is_freelancer && (
                <Link href="/earnings" className="navbar__mobile-link" onClick={() => setMobileMenuOpen(false)}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="12" y1="1" x2="12" y2="23" />
                    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                  </svg>
                  Earnings
                </Link>
              )}

              <Link href="/settings" className="navbar__mobile-link" onClick={() => setMobileMenuOpen(false)}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
                Settings
              </Link>
            </>
          )}
        </nav>

        <div className="navbar__mobile-footer">
          {user ? (
            <button
              onClick={() => {
                handleLogout();
                setMobileMenuOpen(false);
              }}
              className="navbar__mobile-logout"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              Sign Out
            </button>
          ) : (
            <div className="navbar__mobile-auth">
              <Link
                href="/login"
                className="navbar__mobile-btn navbar__mobile-btn--ghost"
                onClick={() => setMobileMenuOpen(false)}
              >
                Sign In
              </Link>
              {/* REMOVED GET STARTED BUTTON IN MOBILE VIEW */}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default Navbar;