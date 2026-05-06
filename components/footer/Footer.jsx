import React from "react";
import Link from "next/link";
import "./Footer.scss";

const Footer = () => {
  return (
    <footer className="footer">
      <div className="footer-container">
        {/* Logo & Tagline */}
        <div className="footer-brand">
          <h2 className="logo">RemyInk!</h2>
          <p>Excellence guaranteed.</p>
        </div>

        {/* Quick Links */}
        <div className="footer-links">
          <h3>Quick Links</h3>
          <ul>
            <li><Link href="/">Home</Link></li>
            <li><Link href="/categories">Categories</Link></li>
          </ul>
        </div>

        {/* User Links */}
        <div className="footer-links">
          <h3>For Users</h3>
          <ul>
            <li><Link href="/login?role=client">Client Login</Link></li>
            <li><Link href="/login?role=expert">Expert Login</Link></li>
          </ul>
        </div>

        {/* Socials / Contact */}
        <div className="footer-social">
          <h3>Connect</h3>
          <ul>
            <li><a href="mailto:support@remyink.com">support@remyink.com</a></li>
          </ul>
        </div>
      </div>

      <div className="footer-bottom">
        <p>© {new Date().getFullYear()} RemyInk. All rights reserved.</p>
      </div>
    </footer>
  );
};

export default Footer;
