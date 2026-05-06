"use client"

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import httpClient from "../../api/httpClient"
import './Settings.scss';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:8000';

const Settings = () => {
  const [activeTab, setActiveTab] = useState('account');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  const [accountData, setAccountData] = useState({
    email: '',
    phone: '',
  });

  const [passwordData, setPasswordData] = useState({
    current_password: '',
    new_password: '',
    confirm_password: '',
  });

  const [notifications, setNotifications] = useState({
    email_new_message: true,
    email_new_offer: true,
    email_offer_accepted: true,
    email_job_completed: true,
    email_payment_received: true,
    email_marketing: false,
    app_new_message: true,
    app_new_offer: true,
    app_offer_accepted: true,
    app_job_completed: true,
    app_payment_received: true,
  });

  const [profileInfo, setProfileInfo] = useState({
    display_name: '',
    tagline: '',
    location: '',
    languages: [],
    is_public: true,
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    const token = localStorage.getItem('accessToken');
    if (!token) {
      window.location.href = '/login';
      return;
    }

    try {
      setLoading(true);

      const accountRes = await fetch(`${API_BASE}/api/users/settings/account/`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (accountRes.ok) {
        const accountInfo = await accountRes.json();
        setAccountData(accountInfo);
      }

      try {
        const notifRes = await httpClient.get("/users/settings/notifications/")
        if (notifRes?.data && typeof notifRes.data === "object") {
          setNotifications((prev) => ({ ...prev, ...notifRes.data }))
        }
      } catch (notifError) {
        console.error("Error fetching notification settings:", notifError)
      }

      const profileRes = await fetch(`${API_BASE}/api/users/profile/`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (profileRes.ok) {
        const profileData = await profileRes.json();
        setProfileInfo(profileData);
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
      showMessage('Failed to load settings', 'error');
    } finally {
      setLoading(false);
    }
  };

  const showMessage = (text, type = 'success') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 5000);
  };

  const handleAccountUpdate = async (e) => {
    e.preventDefault();
    setSaving(true);

    const token = localStorage.getItem('accessToken');

    try {
      const res = await fetch(`${API_BASE}/api/users/settings/account/`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ phone: accountData.phone }),
      });

      if (res.ok) {
        showMessage('Account settings updated successfully');
      } else {
        const error = await res.json();
        showMessage(error.detail || 'Failed to update settings', 'error');
      }
    } catch (error) {
      console.error('Error updating account:', error);
      showMessage('Failed to update settings', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();

    if (passwordData.new_password !== passwordData.confirm_password) {
      showMessage('New passwords do not match', 'error');
      return;
    }

    if (passwordData.new_password.length < 8) {
      showMessage('Password must be at least 8 characters', 'error');
      return;
    }

    setSaving(true);
    const token = localStorage.getItem('accessToken');

    try {
      const res = await fetch(`${API_BASE}/api/users/settings/password/`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(passwordData),
      });

      if (res.ok) {
        showMessage('Password changed successfully');
        setPasswordData({
          current_password: '',
          new_password: '',
          confirm_password: '',
        });
      } else {
        const error = await res.json();
        showMessage(error.current_password?.[0] || error.detail || 'Failed to change password', 'error');
      }
    } catch (error) {
      console.error('Error changing password:', error);
      showMessage('Failed to change password', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleNotificationsUpdate = async (e) => {
    e.preventDefault();
    setSaving(true);

    const token = localStorage.getItem('accessToken');

    try {
      const res = await httpClient.patch("/users/settings/notifications/", notifications)
      if (res?.data && typeof res.data === "object") {
        setNotifications((prev) => ({ ...prev, ...res.data }))
      }
      showMessage('Notification preferences updated successfully');
    } catch (error) {
      console.error('Error updating notifications:', error);
      showMessage(error?.response?.data?.detail || 'Failed to update preferences', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    setSaving(true);

    const token = localStorage.getItem('accessToken');

    try {
      const res = await fetch(`${API_BASE}/api/users/profile/`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(profileInfo),
      });

      if (res.ok) {
        showMessage('Profile information updated successfully');
      } else {
        const error = await res.json();
        showMessage(error.detail || 'Failed to update profile', 'error');
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      showMessage('Failed to update profile', 'error');
    } finally {
      setSaving(false);
    }
  };

  const maskEmail = (email) => {
    if (!email) return '';
    const [local, domain] = email.split('@');
    if (!local || !domain) return email;

    const maskedLocal = local.charAt(0) + '*'.repeat(Math.max(local.length - 2, 0)) + local.charAt(local.length - 1);
    const [domainName, tld] = domain.split('.');
    const maskedDomain = domainName.charAt(0) + '*'.repeat(Math.max(domainName.length - 2, 0)) + domainName.charAt(domainName.length - 1);

    return `${maskedLocal}@${maskedDomain}.${tld}`;
  };

  const tabs = [
    { id: 'account', label: 'Account Settings', icon: '👤' },
    { id: 'security', label: 'Security', icon: '🔒' },
    { id: 'notifications', label: 'Notifications', icon: '🔔' },
    { id: 'profile', label: 'Profile Info', icon: '📝' },
  ];

  if (loading) {
    return (
      <div className="settings-page">
        <div className="settings-loading">
          <div className="spinner" />
          <p>Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="settings-page">
      <div className="settings-container">
        <header className="settings-header">
          <div className="header-content">
            <h1 className="page-title">Settings</h1>
            <p className="page-subtitle">Manage your account settings and preferences</p>
          </div>
          <Link href="/profile" className="view-profile-btn">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
            View Profile
          </Link>
        </header>

        {message && (
          <div className={`message-toast ${message.type}`}>
            <span>{message.text}</span>
            <button onClick={() => setMessage(null)} className="close-btn">×</button>
          </div>
        )}

        <div className="settings-content">
          <aside className="settings-sidebar">
            <nav className="settings-nav">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`nav-item ${activeTab === tab.id ? 'active' : ''}`}
                >
                  <span className="nav-icon">{tab.icon}</span>
                  <span className="nav-label">{tab.label}</span>
                  {activeTab === tab.id && <span className="active-indicator" />}
                </button>
              ))}
            </nav>
          </aside>

          <main className="settings-main">
            {activeTab === 'account' && (
              <div className="settings-section">
                <div className="section-header">
                  <h2>Account Settings</h2>
                  <p>View and update your account information</p>
                </div>

                <div className="email-display">
                  <div className="display-label">Email Address</div>
                  <div className="display-value">{maskEmail(accountData.email)}</div>
                  <div className="display-hint">Your email address is used for authentication and notifications</div>
                </div>

                <form onSubmit={handleAccountUpdate} className="settings-form">
                  <div className="form-group">
                    <label htmlFor="phone">Phone Number</label>
                    <input
                      type="tel"
                      id="phone"
                      value={accountData.phone || ''}
                      onChange={(e) => setAccountData({ ...accountData, phone: e.target.value })}
                      placeholder="+254712345678"
                    />
                    <span className="form-hint">Optional - for account recovery and notifications</span>
                  </div>

                  <button type="submit" className="save-btn" disabled={saving}>
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                </form>
              </div>
            )}

            {activeTab === 'security' && (
              <div className="settings-section">
                <div className="section-header">
                  <h2>Account Security</h2>
                  <p>Update your password and manage security settings</p>
                </div>

                <form onSubmit={handlePasswordChange} className="settings-form">
                  <div className="form-group">
                    <label htmlFor="current_password">Current Password</label>
                    <input
                      type="password"
                      id="current_password"
                      value={passwordData.current_password}
                      onChange={(e) => setPasswordData({ ...passwordData, current_password: e.target.value })}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="new_password">New Password</label>
                    <input
                      type="password"
                      id="new_password"
                      value={passwordData.new_password}
                      onChange={(e) => setPasswordData({ ...passwordData, new_password: e.target.value })}
                      required
                      minLength={8}
                    />
                    <span className="form-hint">At least 8 characters</span>
                  </div>

                  <div className="form-group">
                    <label htmlFor="confirm_password">Confirm New Password</label>
                    <input
                      type="password"
                      id="confirm_password"
                      value={passwordData.confirm_password}
                      onChange={(e) => setPasswordData({ ...passwordData, confirm_password: e.target.value })}
                      required
                      minLength={8}
                    />
                  </div>

                  <button type="submit" className="save-btn" disabled={saving}>
                    {saving ? 'Updating...' : 'Update Password'}
                  </button>
                </form>
              </div>
            )}

            {activeTab === 'notifications' && (
              <div className="settings-section">
                <div className="section-header">
                  <h2>Notification Preferences</h2>
                  <p>Choose how you want to be notified</p>
                </div>

                <form onSubmit={handleNotificationsUpdate} className="settings-form">
                  <div className="notification-group">
                    <h3>Email Notifications</h3>

                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={notifications.email_new_message}
                        onChange={(e) => setNotifications({ ...notifications, email_new_message: e.target.checked })}
                      />
                      <span>New messages</span>
                    </label>

                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={notifications.email_new_offer}
                        onChange={(e) => setNotifications({ ...notifications, email_new_offer: e.target.checked })}
                      />
                      <span>New offers</span>
                    </label>

                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={notifications.email_offer_accepted}
                        onChange={(e) => setNotifications({ ...notifications, email_offer_accepted: e.target.checked })}
                      />
                      <span>Offer accepted</span>
                    </label>

                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={notifications.email_job_completed}
                        onChange={(e) => setNotifications({ ...notifications, email_job_completed: e.target.checked })}
                      />
                      <span>Job completed</span>
                    </label>

                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={notifications.email_payment_received}
                        onChange={(e) => setNotifications({ ...notifications, email_payment_received: e.target.checked })}
                      />
                      <span>Payment received</span>
                    </label>

                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={notifications.email_marketing}
                        onChange={(e) => setNotifications({ ...notifications, email_marketing: e.target.checked })}
                      />
                      <span>Marketing emails and updates</span>
                    </label>
                  </div>

                  <div className="notification-group">
                    <h3>In-App Notifications</h3>

                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={notifications.app_new_message}
                        onChange={(e) => setNotifications({ ...notifications, app_new_message: e.target.checked })}
                      />
                      <span>New messages</span>
                    </label>

                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={notifications.app_new_offer}
                        onChange={(e) => setNotifications({ ...notifications, app_new_offer: e.target.checked })}
                      />
                      <span>New offers</span>
                    </label>

                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={notifications.app_offer_accepted}
                        onChange={(e) => setNotifications({ ...notifications, app_offer_accepted: e.target.checked })}
                      />
                      <span>Offer accepted</span>
                    </label>

                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={notifications.app_job_completed}
                        onChange={(e) => setNotifications({ ...notifications, app_job_completed: e.target.checked })}
                      />
                      <span>Job completed</span>
                    </label>

                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={notifications.app_payment_received}
                        onChange={(e) => setNotifications({ ...notifications, app_payment_received: e.target.checked })}
                      />
                      <span>Payment received</span>
                    </label>
                  </div>

                  <button type="submit" className="save-btn" disabled={saving}>
                    {saving ? 'Saving...' : 'Save Preferences'}
                  </button>
                </form>
              </div>
            )}

            {activeTab === 'profile' && (
              <div className="settings-section">
                <div className="section-header">
                  <h2>Profile Information</h2>
                  <p>Manage your personal and business information</p>
                </div>

                <form onSubmit={handleProfileUpdate} className="settings-form">
                  <div className="form-group">
                    <label htmlFor="display_name">Display Name</label>
                    <input
                      type="text"
                      id="display_name"
                      value={profileInfo.display_name || ''}
                      onChange={(e) => setProfileInfo({ ...profileInfo, display_name: e.target.value })}
                      placeholder="Your public display name"
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="tagline">Tagline</label>
                    <input
                      type="text"
                      id="tagline"
                      value={profileInfo.tagline || ''}
                      onChange={(e) => setProfileInfo({ ...profileInfo, tagline: e.target.value })}
                      placeholder="A short headline about yourself"
                      maxLength={200}
                    />
                    <span className="form-hint">Max 200 characters</span>
                  </div>

                  <div className="form-group">
                    <label htmlFor="location">Location</label>
                    <input
                      type="text"
                      id="location"
                      value={profileInfo.location || ''}
                      onChange={(e) => setProfileInfo({ ...profileInfo, location: e.target.value })}
                      placeholder="City, Country"
                    />
                  </div>

                  <div className="form-group">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={profileInfo.is_public}
                        onChange={(e) => setProfileInfo({ ...profileInfo, is_public: e.target.checked })}
                      />
                      <span>Make profile visible to public</span>
                    </label>
                  </div>

                  <button type="submit" className="save-btn" disabled={saving}>
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                </form>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
};

export default Settings;
