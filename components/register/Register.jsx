"use client";

import React, { useState, useMemo, useEffect } from "react";
import axios from "axios";
import { useRouter } from "next/navigation";
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  User,
  Briefcase,
  ArrowRight,
  AlertCircle,
  X,
  Check,
  Sparkles,
  Phone,
} from "lucide-react";
import "./Register.scss";

const Register = () => {
  const router = useRouter();

  const [formData, setFormData] = useState({
    email: "",
    password: "",
    password2: "",
    first_name: "",
    last_name: "",
    phone: "",
    role: "FREELANCER",
  });

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showPassword2, setShowPassword2] = useState(false);
  const [guestSessionKey, setGuestSessionKey] = useState(null);

  const { email, password, password2, first_name, last_name, phone, role } = formData;

  useEffect(() => {
    const existingSession = localStorage.getItem("guestSessionKey");
    if (existingSession) {
        setGuestSessionKey(existingSession);
        return;
    }

    const createGuestSession = async () => {
        try {
            const res = await fetch("http://127.0.0.1:8000/api/users/csrf-and-session/", {
                method: "GET",
                credentials: "include",
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);

            const data = await res.json();
            const key = data.sessionId || data.session_key || data.sessionid;

            if (key) {
                localStorage.setItem("guestSessionKey", key);
                setGuestSessionKey(key);
            } else {
                console.error("No session key returned:", data);
            }
        } catch (err) {
            console.error("Failed to create guest session key:", err);
        }
    };
    
    createGuestSession();

  }, []);

  const passwordStrength = useMemo(() => {
    if (!password) return { score: 0, label: "", color: "", percent: 0 };
    let score = 0;
    if (password.length >= 8) score++;
    if (password.length >= 12) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;

    const levels = [
      { label: "", color: "transparent", percent: 0 },
      { label: "Weak", color: "var(--error-500, #ef4444)", percent: 20 },
      { label: "Fair", color: "var(--warning-500, #f97316)", percent: 40 },
      { label: "Good", color: "var(--warning-400, #fbbf24)", percent: 60 },
      { label: "Strong", color: "var(--success-500, #22c55e)", percent: 80 },
      { label: "Excellent", color: "var(--success-400, #10b981)", percent: 100 },
    ];
    return { score, ...levels[Math.min(score, 5)] };
  }, [password]);

  const passwordsMatch = password2 && password === password2;

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleClientRedirect = () => {
    const categoriesPath = guestSessionKey 
        ? `/categories?session_key=${guestSessionKey}` 
        : "/categories";
    router.push(categoriesPath);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    if (role === "CLIENT") {
      setError("Please use the 'Work as Freelancer' tab to register.");
      setLoading(false);
      return;
    }

    if (password !== password2) {
      setError("Passwords do not match.");
      setLoading(false);
      return;
    }

    if (passwordStrength.score < 3) {
      setError("Please choose a stronger password (minimum 8 characters, mix of cases/numbers/symbols).");
      setLoading(false);
      return;
    }

    try {
      const endpoint = "http://127.0.0.1:8000/api/users/onboarding/onboard_freelancer/";
      const payload = {
        email,
        password,
        role: "FREELANCER",
        first_name,
        last_name,
        phone,
      };

      await axios.post(endpoint, payload, {
        headers: { "Content-Type": "application/json" },
      });

      setSuccess("Freelancer account created successfully! Redirecting to setup...");
      setFormData({
        email: "",
        password: "",
        password2: "",
        first_name: "",
        last_name: "",
        phone: "",
        role: "FREELANCER",
      });

      setTimeout(() => {
        router.push("/login");
      }, 1500);
    } catch (err) {
      if (err.response && err.response.data) {
        if (err.response.data.detail) {
          setError(err.response.data.detail);
        } else if (typeof err.response.data === "object") {
          const messages = Object.entries(err.response.data)
            .map(([key, val]) => `${key}: ${Array.isArray(val) ? val.join(", ") : val}`)
            .join(". ");
          setError(messages);
        } else {
          setError("An unexpected error occurred during registration.");
        }
      } else {
        setError("Network error: Could not connect to the server.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="register">
      <div className="register__container">
        <div className="register__artwork">
          <div className="register__artwork-content">
            <div className="register__artwork-logo">
              <Sparkles className="register__artwork-icon" />
              <span className="register__artwork-brand">RemyInk</span>
            </div>
            <h1 className="register__artwork-title">
              Start your creative journey today
            </h1>
            <p className="register__artwork-subtitle">
              Join thousands of creators and clients collaborating on amazing
              projects worldwide.
            </p>
            <div className="register__artwork-features">
              <div className="register__artwork-feature">
                <Check size={18} />
                <span>Connect with top global talent</span>
              </div>
              <div className="register__artwork-feature">
                <Check size={18} />
                <span>Secure payments & contracts</span>
              </div>
              <div className="register__artwork-feature">
                <Check size={18} />
                <span>24/7 dedicated support</span>
              </div>
            </div>
          </div>
          <div className="register__artwork-decoration">
            <div className="register__artwork-circle register__artwork-circle--1" />
            <div className="register__artwork-circle register__artwork-circle--2" />
            <div className="register__artwork-circle register__artwork-circle--3" />
          </div>
        </div>

        <div className="register__form-section">
          <div className="register__form-wrapper">
            <div className="register__header">
              <h2 className="register__title">Create an account</h2>
              <p className="register__subtitle">
                Already have an account?{" "}
                <a href="/login" className="register__link">
                  Sign in
                </a>
              </p>
            </div>

            <div className="register__role-tabs">
              <button
                type="button"
                className={`register__role-tab ${role === "CLIENT" ? "register__role-tab--active" : ""}`}
                onClick={handleClientRedirect}
                disabled={loading}
              >
                <User size={18} />
                <span>Talk to an Expert</span>
              </button>
              <button
                type="button"
                className={`register__role-tab ${role === "FREELANCER" ? "register__role-tab--active" : ""}`}
                onClick={() => setFormData({ ...formData, role: "FREELANCER" })}
                disabled={loading}
              >
                <Briefcase size={18} />
                <span>Work as Freelancer</span>
              </button>
            </div>

            {error && (
              <div className="register__error">
                <AlertCircle size={18} />
                <span>{error}</span>
                <button
                  className="register__error-close"
                  onClick={() => setError("")}
                  type="button"
                >
                  <X size={16} />
                </button>
              </div>
            )}

            {success && (
              <div className="register__success">
                <Check size={18} />
                <span>{success}</span>
              </div>
            )}

            {role === "FREELANCER" && (
              <form className="register__form" onSubmit={handleSubmit}>
                <div className="register__field-row">
                  <div className="register__field">
                    <label className="register__label">First name</label>
                    <div className="register__input-wrapper">
                      <User size={18} className="register__input-icon" />
                      <input
                        type="text"
                        name="first_name"
                        placeholder="John"
                        value={first_name}
                        onChange={handleChange}
                        disabled={loading}
                        required
                      />
                    </div>
                  </div>
                  <div className="register__field">
                    <label className="register__label">Last name</label>
                    <div className="register__input-wrapper">
                      <User size={18} className="register__input-icon" />
                      <input
                        type="text"
                        name="last_name"
                        placeholder="Doe"
                        value={last_name}
                        onChange={handleChange}
                        disabled={loading}
                        required
                      />
                    </div>
                  </div>
                </div>

                <div className="register__field">
                  <label className="register__label">Email address</label>
                  <div className="register__input-wrapper">
                    <Mail size={18} className="register__input-icon" />
                    <input
                      type="email"
                      name="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={handleChange}
                      disabled={loading}
                      required
                    />
                  </div>
                </div>

                <div className="register__field">
                  <label className="register__label">Phone number</label>
                  <div className="register__input-wrapper">
                    <Phone size={18} className="register__input-icon" />
                    <input
                      type="tel"
                      name="phone"
                      placeholder="+254712345678"
                      value={phone}
                      onChange={handleChange}
                      disabled={loading}
                      required
                    />
                  </div>
                </div>

                <div className="register__field">
                  <label className="register__label">Password</label>
                  <div className="register__input-wrapper">
                    <Lock size={18} className="register__input-icon" />
                    <input
                      type={showPassword ? "text" : "password"}
                      name="password"
                      placeholder="Create a strong password"
                      value={password}
                      onChange={handleChange}
                      disabled={loading}
                      required
                    />
                    <button
                      type="button"
                      className="register__password-toggle"
                      onClick={() => setShowPassword(!showPassword)}
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  {password && (
                    <div className="register__strength">
                      <div className="register__strength-bar">
                        <div
                          className="register__strength-fill"
                          style={{
                            width: `${passwordStrength.percent}%`,
                            backgroundColor: passwordStrength.color,
                          }}
                        />
                      </div>
                      <span
                        className="register__strength-label"
                        style={{ color: passwordStrength.color }}
                      >
                        {passwordStrength.label}
                      </span>
                    </div>
                  )}
                </div>

                <div className="register__field">
                  <label className="register__label">Confirm password</label>
                  <div
                    className={`register__input-wrapper ${passwordsMatch ? "register__input-wrapper--valid" : ""}`}
                  >
                    <Lock size={18} className="register__input-icon" />
                    <input
                      type={showPassword2 ? "text" : "password"}
                      name="password2"
                      placeholder="Confirm your password"
                      value={password2}
                      onChange={handleChange}
                      disabled={loading}
                      required
                    />
                    <button
                      type="button"
                      className="register__password-toggle"
                      onClick={() => setShowPassword2(!showPassword2)}
                      tabIndex={-1}
                    >
                      {showPassword2 ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                    {passwordsMatch && (
                      <div className="register__match-badge">
                        <Check size={14} />
                      </div>
                    )}
                  </div>
                </div>

                <button
                  type="submit"
                  className="register__submit"
                  disabled={loading}
                >
                  {loading ? (
                    <div className="register__spinner" />
                  ) : (
                    <>
                      <span>Create account</span>
                      <ArrowRight size={18} />
                    </>
                  )}
                </button>
              </form>
            )}

            <p className="register__terms">
              By creating an account, you agree to our{" "}
              <a href="/terms">Terms of Service</a> and{" "}
              <a href="/privacy">Privacy Policy</a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Register;