"use client"

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation"
import Link from "next/link";
import "./Home.scss";

const Home = () => {
    const [currentUser, setCurrentUser] = useState(null);
    const [guestSessionKey, setGuestSessionKey] = useState(null);
    const router = useRouter();

    useEffect(() => {
    const userString = localStorage.getItem("currentUser");
    if (userString) {
        try {
            const user = JSON.parse(userString);
            if (["CLIENT", "FREELANCER"].includes(user.role)) {
                setCurrentUser(user);
            }
        } catch (error) {
            console.error("Failed to parse user data from localStorage:", error);
        }
    }

    const existingSession = localStorage.getItem("guestSessionKey");
    if (existingSession) {
        setGuestSessionKey(existingSession);
           return;
    }

    const createGuestSession = async () => {
        try {
            const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";
            
            const res = await fetch(`${API_BASE}/api/users/csrf-and-session/`, {
                method: "GET",
                credentials: "include", 
            });
    
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
    
            const data = await res.json();
            const key = data.sessionId || data.session_key || data.sessionid;
    
            if (key) {
                localStorage.setItem("guestSessionKey", key);
                setGuestSessionKey(key);
            }
        } catch (err) {
            console.error("Guest session failed:", err);
        }
    };
    
    createGuestSession();

    }, []);
    
    const isClient = currentUser?.role === "CLIENT";
    const isFreelancer = currentUser?.role === "FREELANCER";

    const getDashboardPath = (role) => {
        switch (role) {
            case "CLIENT":
                return "/dashboard";
            case "FREELANCER":
                return "/dashboard";
            default:
                return "/";
        }
    };

    return (
        <div className="home">
            <section className="hero">
                <div className="hero-content"> 
                    <span className="badge">Premium Content & Writing Services</span>
                    <h1 className="brand">
                        <span className="highlight">Professional Writing & Creative</span> Platform
                    </h1>
                    <p className="tagline">
                        Elevate your brand with vetted experts in SEO articles, blog management, ghostwriting, and professional document design.
                    </p>
                    <p className="description">
                        We connect you with high-caliber writers to craft compelling narratives, from authority-building whitepapers to industry-leading CVs and corporate profiles.
                    </p>
                    <div className="cta-buttons">
                        {isFreelancer && (
                            <Link href="/dashboard" className="btn primary">
                                Go to Dashboard →
                            </Link>
                        )}
                    
                        {(isClient || !currentUser) && (
                            <Link
                                href={
                                    guestSessionKey
                                        ? `/categories?session_key=${String(guestSessionKey)}`
                                        : "/categories"
                                }
                                className="btn primary"
                            >
                                Browse Services →
                            </Link>
                        )}
                    </div>
                </div>
            </section>

            <section className="value-strip">
                <div className="value-item">
                    <span className="value-icon">✍️</span>
                    <p className="value-text">Expert Ghostwriters & Copywriters</p>
                </div>
                <div className="value-item">
                    <span className="value-icon">🚀</span>
                    <p className="value-text">SEO-Optimized Content Delivery</p>
                </div>
                <div className="value-item">
                    <span className="value-icon">🔒</span>
                    <p className="value-text">100% Confidential & IP Secure</p>
                </div>
            </section>

            <section className="features">
                <h2 className="section-title">The Foundation of Creative Excellence</h2>
                <div className="features-grid">
                    <div className="feature-card">
                        <span className="icon">🖋️</span>
                        <h3>Bespoke Content Creation</h3>
                        <p>Receive tailor-made articles and blogs designed to resonate with your specific audience and industry.</p>
                    </div>
                    <div className="feature-card">
                        <span className="icon">💼</span>
                        <h3>Corporate Branding</h3>
                        <p>Professional CV preparation, LinkedIn optimization, and executive bios that open doors to new opportunities.</p>
                    </div>
                    <div className="feature-card">
                        <span className="icon">📖</span>
                        <h3>Ghostwriting & Books</h3>
                        <p>Bring your ideas to life with professional ghostwriters specialized in non-fiction, memoirs, and digital guides.</p>
                    </div>
                    <div className="feature-card">
                        <span className="icon">✨</span>
                        <h3>Editing & Polishing</h3>
                        <p>Refine your existing drafts with expert proofreading, ensuring your message is crisp, professional, and error-free.</p>
                    </div>
                </div>
            </section>
            
            <section className="client-testimonials">
                <h2 className="section-title">Trusted by Professionals Globally</h2>
                <div className="testimonial-grid">
                    <div className="testimonial-card">
                        <p className="quote">“The blog series written for my startup significantly increased our organic traffic. Professional and insightful.”</p>
                        <p className="author">— Sarah J., Tech Founder</p>
                    </div>
                    <div className="testimonial-card">
                        <p className="quote">“The ghostwriting service captured my voice perfectly for my latest book. I couldn't have finished it without them.”</p>
                        <p className="author">— David K., Author & Speaker</p>
                    </div>
                    <div className="testimonial-card">
                        <p className="quote">“My new CV and LinkedIn profile were game-changers. I secured three interviews within the first week.”</p>
                        <p className="author">— Michael L., Executive Director</p>
                    </div>
                </div>
            </section>

            <section className="final-cta">
                <div className="cta-content">
                    <h2>Ready to Scale Your Content Strategy?</h2>
                    <p>Connect with professional writers who help you communicate clearly and build your digital authority.</p>
                    <p>High-quality, original content crafted specifically for your professional and business needs.</p>
                    <Link
                        href={guestSessionKey ? `/categories?session_key=${String(guestSessionKey)}` : "/categories"}
                        className="btn primary large-cta-btn"
                    >
                        Start Your Project →
                    </Link>
                </div>
            </section>
        </div>
    );
};

export default Home;