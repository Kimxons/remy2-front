"use client"

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation"
import Link from "next/link";
import { setAuthSessionCookie } from "../../utils/cookies";
import { requestPasswordSetupEmail } from "../../utils/clientOnboarding";
import "./Login.scss";
import { httpClient } from "../../api/httpClient"; // Adjust path if necessary

const getSearchParamValue = (searchParams, key) => {
  const value = searchParams?.[key]
  if (Array.isArray(value)) return value[0] || ""
  return typeof value === "string" ? value : ""
}

const Login = ({ onLoginSuccess, initialSearchParams = {} }) => {
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  const [role, setRole] = useState("FREELANCER");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [requiresPasswordSetup, setRequiresPasswordSetup] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendMessage, setResendMessage] = useState("");

  const router = useRouter();
  const emailFromQuery = getSearchParamValue(initialSearchParams, "email");
  const roleFromQuery = getSearchParamValue(initialSearchParams, "role").toUpperCase();
  const uidFromQuery =
    getSearchParamValue(initialSearchParams, "uid") ||
    getSearchParamValue(initialSearchParams, "uidb64");
  const tokenFromQuery = getSearchParamValue(initialSearchParams, "token");
  const redirectParam = getSearchParamValue(initialSearchParams, "redirect");
  const paymentStatus = getSearchParamValue(initialSearchParams, "payment");
  const paymentReference =
    getSearchParamValue(initialSearchParams, "reference") ||
    getSearchParamValue(initialSearchParams, "trxref");
  const showPaymentVerifiedBanner = paymentStatus === "verified";

  useEffect(() => {
    const savedEmail = localStorage.getItem("rememberedEmail");
    if (savedEmail) {
      setFormData((prev) => ({ ...prev, email: savedEmail }));
      setRememberMe(true);
    }
  }, []);

  useEffect(() => {
    if (emailFromQuery) {
      setFormData((prev) => ({ ...prev, email: emailFromQuery }));
    }
    if (roleFromQuery === "CLIENT" || roleFromQuery === "FREELANCER") {
      setRole(roleFromQuery)
    }
  }, [emailFromQuery, roleFromQuery]);

  useEffect(() => {
    if (!uidFromQuery || !tokenFromQuery) return;

    const params = new URLSearchParams();
    params.set("uid", uidFromQuery);
    params.set("token", tokenFromQuery);
    const email = emailFromQuery;
    if (email) {
      params.set("email", email);
    }
    router.replace(`/password/setup?${params.toString()}`);
  }, [router, uidFromQuery, tokenFromQuery, emailFromQuery]);

  useEffect(() => {
    if (error && !requiresPasswordSetup) {
      const timer = setTimeout(() => setError(""), 5000);
      return () => clearTimeout(timer);
    }
  }, [error, requiresPasswordSetup]);

  const validateForm = () => {
    const errors = {};

    if (!formData.email) {
      errors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = "Please enter a valid email";
    }

    if (!formData.password) {
      errors.password = "Password is required";
    } else if (formData.password.length < 6) {
      errors.password = "Password must be at least 6 characters";
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    if (fieldErrors[name]) {
      setFieldErrors((prev) => ({ ...prev, [name]: "" }));
    }
    if (error) setError("");
    if (requiresPasswordSetup) setRequiresPasswordSetup(false);
    if (resendMessage) setResendMessage("");
  };

  const handleResendSetupLink = async () => {
    if (!formData.email || resendLoading) return;

    setResendLoading(true);
    setResendMessage("");
    setError("");

    try {
      const response = await requestPasswordSetupEmail(formData.email)
      setResendMessage(
        response?.data?.detail || response?.data?.message || "Setup email sent. Check your inbox."
      )
    } catch (err) {
      setError(err.response?.data?.detail || err.message || "Unable to resend setup link right now. Please try again.");
    } finally {
      setResendLoading(false);
    }
  };


  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) return;

    setError("");
    setRequiresPasswordSetup(false);
    setResendMessage("");
    setLoading(true);

    try {
      // 1. We use relative paths. httpClient already knows the DigitalOcean base URL.
      const endpoint = role === "CLIENT" ? "/users/token/client/" : "/users/token/freelancer/";

      // 2. USE httpClient.post INSTEAD OF fetch
      const response = await httpClient.post(endpoint, {
        email: formData.email,
        password: formData.password,
      });

      // Axios puts the response data inside a .data object
      const { access, refresh } = response.data;

      localStorage.setItem("accessToken", access);
      localStorage.setItem("refreshToken", refresh);

      if (rememberMe) {
        localStorage.setItem("rememberedEmail", formData.email);
      } else {
        localStorage.removeItem("rememberedEmail");
      }

      // 3. FETCH PROFILE using httpClient.get
      // This is much cleaner and automatically includes your auth headers if set up
      const profileResponse = await httpClient.get("/users/me/");
      const user = profileResponse.data;

      localStorage.setItem("currentUser", JSON.stringify(user));
      window.dispatchEvent(new Event("auth:changed"));

      setAuthSessionCookie(7);

      if (onLoginSuccess) onLoginSuccess(user);

      const defaultRedirect = user.role === "ADMIN" ? "/admin" : "/dashboard";
      const redirectTo = redirectParam || defaultRedirect;

      router.push(redirectTo, { replace: true });
    } catch (err) {
      // Axios error handling: the message is usually in err.response.data
      const errorData = err.response?.data;
      const rawMessage = errorData?.detail || errorData?.error || err.message || "Login failed.";

      if (role === "CLIENT" && /no active account found/i.test(rawMessage)) {
        const verificationMessage = showPaymentVerifiedBanner
          ? "Your payment was received, but your client account must be verified before you can sign in. Check your email for the setup link to finish account setup."
          : "Your client account needs to be verified before you can sign in. Check your email for the setup link to finish account setup.";
        let resendFailed = false;

        try {
          await requestPasswordSetupEmail(formData.email);
          setResendMessage("Setup link sent. Check your email.");
        } catch (sendErr) {
          resendFailed = true;
          setResendMessage("");
          setError("We could not resend the setup link right now. Please try again in a moment.");
        }

        if (!resendFailed) {
          setError(verificationMessage);
        }
        setRequiresPasswordSetup(true);
        return;
      }

      console.error("Login error details:", rawMessage);

      setError(rawMessage);
      setRequiresPasswordSetup(/password setup required|no active/i.test(rawMessage));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login">
      <div className="login__container">
        <div className="login__artwork">
          <div className="login__artwork-content">
            <div className="login__artwork-logo">
              <span className="login__artwork-icon">✦</span>
              <span className="login__artwork-brand">RemyInk</span>
            </div>
            <h1 className="login__artwork-title">Welcome back to the creative marketplace</h1>
            <p className="login__artwork-subtitle">
              Connect with talented freelancers or find your next project. Your journey continues here.
            </p>
            <div className="login__artwork-features">
              <div className="login__artwork-feature">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
                <span>Secure & Fast Payments</span>
              </div>
              <div className="login__artwork-feature">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
                <span>Verified Professionals</span>
              </div>
              <div className="login__artwork-feature">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
                <span>24/7 Support</span>
              </div>
            </div>
          </div>
          <div className="login__artwork-decoration">
            <div className="login__artwork-circle login__artwork-circle--1" />
            <div className="login__artwork-circle login__artwork-circle--2" />
            <div className="login__artwork-circle login__artwork-circle--3" />
          </div>
        </div>

        <div className="login__form-section">
          <div className="login__form-wrapper">
            <div className="login__header">
              <h2 className="login__title">Sign in</h2>
            </div>

            {showPaymentVerifiedBanner && (
              <div className="login__notice login__notice--success">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
                <div>
                  <p className="login__notice-title">Payment verified, sign in to continue</p>
                  <p className="login__notice-text">
                    Your payment has been received. Sign in to continue to your client workspace.
                    {paymentReference ? ` Reference: ${paymentReference}` : ""}
                  </p>
                </div>
              </div>
            )}

            <div className="login__role-tabs">
              <button
                type="button"
                className={`login__role-tab ${role === "FREELANCER" ? "login__role-tab--active" : ""}`}
                onClick={() => setRole("FREELANCER")}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
                Freelancer
              </button>
              <button
                type="button"
                className={`login__role-tab ${role === "CLIENT" ? "login__role-tab--active" : ""}`}
                onClick={() => setRole("CLIENT")}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                  <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                </svg>
                Client
              </button>
            </div>

            {error && (
              <div className="login__error">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <span>{error}</span>
                <button
                  type="button"
                  className="login__error-close"
                  onClick={() => {
                    setError("");
                    setRequiresPasswordSetup(false);
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            )}

            {requiresPasswordSetup && (
              <div className="login__setup-help">
                <p className="login__setup-help-title">Password setup needed</p>
                <p className="login__setup-help-text">
                  Account created after payment - check your email to finish setup. We sent a secure setup link to <strong>{formData.email}</strong>.
                </p>
                <div className="login__setup-help-actions">
                  <button
                    type="button"
                    className="login__setup-help-btn"
                    onClick={handleResendSetupLink}
                    disabled={!formData.email || resendLoading}
                  >
                    {resendLoading ? "Sending..." : "Resend setup link"}
                  </button>
                  {resendMessage ? (
                    <p className="login__setup-help-success">{resendMessage}</p>
                  ) : null}
                </div>
                <Link
                  href={`/password/setup?email=${encodeURIComponent(formData.email)}`}
                  className="login__setup-help-link"
                >
                  I have my setup link
                </Link>
              </div>
            )}

            <form className="login__form" onSubmit={handleSubmit} noValidate>
              <div className={`login__field ${fieldErrors.email ? "login__field--error" : ""}`}>
                <label htmlFor="email" className="login__label">
                  Email address
                </label>
                <div className="login__input-wrapper">
                  <svg
                    className="login__input-icon"
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                    <polyline points="22,6 12,13 2,6" />
                  </svg>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    placeholder="you@example.com"
                    autoComplete="email"
                    disabled={loading}
                  />
                </div>
                {fieldErrors.email && <span className="login__field-error">{fieldErrors.email}</span>}
              </div>

              <div className={`login__field ${fieldErrors.password ? "login__field--error" : ""}`}>
                <div className="login__label-row">
                  <label htmlFor="password" className="login__label">
                    Password
                  </label>
                  <Link href="/forgot-password" className="login__forgot">
                    Forgot password?
                  </Link>
                </div>
                <div className="login__input-wrapper">
                  <svg
                    className="login__input-icon"
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                  <input
                    type={showPassword ? "text" : "password"}
                    id="password"
                    name="password"
                    value={formData.password}
                    onChange={handleInputChange}
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    disabled={loading}
                  />
                  <button
                    type="button"
                    className="login__password-toggle"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                  >
                    {showPassword ? (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                      </svg>
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                </div>
                {fieldErrors.password && <span className="login__field-error">{fieldErrors.password}</span>}
              </div>

              <div className="login__remember">
                <label className="login__checkbox">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    disabled={loading}
                  />
                  <span className="login__checkbox-mark">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </span>
                  <span className="login__checkbox-label">Remember me</span>
                </label>
              </div>

              <button type="submit" className="login__submit" disabled={loading}>
                {loading ? (
                  <>
                    <span className="login__spinner" />
                    Signing in...
                  </>
                ) : (
                  <>
                    Sign in as {role === "FREELANCER" ? "Freelancer" : "Client"}
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="5" y1="12" x2="19" y2="12" />
                      <polyline points="12 5 19 12 12 19" />
                    </svg>
                  </>
                )}
              </button>
            </form>

            <p className="login__terms">
              By signing in, you agree to our{" "}
              <Link href="/terms">Terms of Service</Link> and{" "}
              <Link href="/privacy">Privacy Policy</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
