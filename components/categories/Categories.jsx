"use client"

import React, { useEffect, useState, useCallback, useRef } from "react";
import { ensureGuestAuth } from "@/utils/auth";
import { useRouter, useSearchParams } from "next/navigation";
import httpClient from "../../api/httpClient";
import { useAuth, useNotification } from "../../contexts/AppContexts";
import { useCreateThread } from "../../hooks/useChatHooks";
import { MessageCircle, Star, Clock, DollarSign, CheckCircle, Loader, ChevronRight, User } from "lucide-react";
import "./Categories.scss";

const formatUSD = (amount) => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
};

const Categories = () => {
  const [categories, setCategories] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [freelancers, setFreelancers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedSubject, setSelectedSubject] = useState(null);
  const subjectsRequestRef = useRef(0);
  const freelancersRequestRef = useRef(0); // <--- Add this line here
  const recoveryToastShownRef = useRef(false);

  const { isAuthenticated } = useAuth();
  const { showSuccess, showError, showInfo } = useNotification();
  const createThreadMutation = useCreateThread();
  const router = useRouter();
  const searchParams = useSearchParams();
  const hasFreshSessionRecovery = searchParams?.get("fresh_session") === "1";
  const [showRecoveryBanner, setShowRecoveryBanner] = useState(hasFreshSessionRecovery);

  const fetchCategories = useCallback(async () => {
    setLoading(true);
    try {
      const res = await httpClient.get("/jobs/categories");
      setCategories(res.data.results || []);
      setError("");
    } catch (err) {
      setError("Failed to fetch categories.");
      showError("Failed to fetch categories");
    } finally {
      setLoading(false);
    }
  }, [showError]);

  const fetchSubjects = useCallback(async () => {
    if (!selectedCategory) {
      setSubjects([]);
      setFreelancers([]);
      return;
    }

    setSelectedSubject(null); // <--- MOVE THIS TO HERE (Top of the function)
    const requestId = ++subjectsRequestRef.current;
    setLoading(true);
    try {
      const res = await httpClient.get(
        `/jobs/subject-areas/?category_id=${selectedCategory}`
      );
      // Ignore stale responses if user switched categories quickly.
      if (requestId !== subjectsRequestRef.current) return;
      setSubjects(res.data.results || []);
      setError("");
    } catch (err) {
      if (requestId !== subjectsRequestRef.current) return;
      setError("Failed to fetch subjects.");
      showError("Failed to fetch subjects");
    } finally {
      if (requestId === subjectsRequestRef.current) {
        setLoading(false);
      }
    }
  }, [selectedCategory, showError]);
  const fetchFreelancers = useCallback(async () => {
    if (!selectedSubject) {
      setFreelancers([]);
      return;
    }

    const requestId = ++freelancersRequestRef.current; // <--- ADD THIS
    setLoading(true);

    try {
      let res = await httpClient.get(`/users/freelancers/?subject_id=${selectedSubject}`);
      let results = res.data.results || [];

      if (results.length === 0) {
        const fallbackRes = await httpClient.get(
          `/users/freelancers/?subject_id=${selectedSubject}&fallback_admin=true`
        );
        results = fallbackRes.data.results || [];
      }

      // CHECK FOR STALE REQUEST
      if (requestId !== freelancersRequestRef.current) return;

      setFreelancers(results);
      setError("");
    } catch (err) {
      if (requestId !== freelancersRequestRef.current) return;
      setError("Failed to fetch experts.");
      showError("Failed to fetch experts");
    } finally {
      if (requestId === freelancersRequestRef.current) {
        setLoading(false);
      }
    }
  }, [selectedSubject, showError]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  useEffect(() => {
    fetchSubjects();
  }, [fetchSubjects]);

  useEffect(() => {
    fetchFreelancers();
  }, [fetchFreelancers]);

  useEffect(() => {
    if (!hasFreshSessionRecovery || recoveryToastShownRef.current) return;

    recoveryToastShownRef.current = true;
    setShowRecoveryBanner(true);
    showInfo("Started a fresh guest chat session. Choose a freelancer to continue.");
    router.replace("/categories", { scroll: false });
  }, [hasFreshSessionRecovery, router, showInfo]);

  const handleCategoryClick = (id) => {
    const isCurrentlySelected = selectedCategory === id;
    setSelectedCategory(isCurrentlySelected ? null : id);

    // Immediately clear the sub-selections so the UI updates instantly
    setSelectedSubject(null);
    setFreelancers([]);
  };

  const handleSubjectClick = (id) => {
    setSelectedSubject(id);
  };

  const handleOpenChat = async (freelancer) => {
    try {
      // Step A: Ensure authentication (guest or real)
      if (!isAuthenticated) {
        const ok = await ensureGuestAuth(); // This hits POST /api/users/token/guest/

        if (!ok) {
          showError("Unable to start guest session.");
          return;
        }
      }

      // Step B: create thread normally
      const thread = await createThreadMutation.mutateAsync({
        freelancerUsername: freelancer.username,
      });

      showSuccess(`Chat started with ${freelancer.username}`);
      router.push(`/threads/${thread.id}`);
    } catch (err) {
      console.error("Chat creation error:", err);

      if (err.response?.status === 401) {
        showError("Session expired. Please try again.");
      } else {
        showError("Failed to start chat.");
      }
    }
  };

  const selectedCategoryObject = categories.find((c) => c.id === selectedCategory);
  const visibleCategories = selectedCategory
    ? categories.filter((category) => category.id === selectedCategory)
    : categories;
  const selectedSubjectObject = subjects.find((s) => s.id === selectedSubject);
  const pickFirstNumber = (...values) => {
    const matched = values.find((value) => Number.isFinite(Number(value)));
    return matched != null ? Number(matched) : null;
  };
  const formatAvgPrice = (freelancer) => {
    const profile = freelancer?.profile || {};
    const stats = freelancer?.stats || profile?.stats || {};
    const avgPrice = pickFirstNumber(
      stats.avg_price,
      stats.average_price,
      stats.hourly_rate,
      profile.avg_price,
      profile.average_price,
      profile.hourly_rate,
      freelancer.avg_price,
      freelancer.average_price,
      freelancer.hourly_rate,
      freelancer.rate
    );
    return avgPrice != null ? formatUSD(avgPrice) : "N/A";
  };
  const formatAvgDelivery = (freelancer) => {
    const profile = freelancer?.profile || {};
    const stats = freelancer?.stats || profile?.stats || {};
    const avgDelivery = pickFirstNumber(
      stats.avg_delivery_time,
      stats.average_delivery_time,
      stats.delivery_time_days,
      profile.avg_delivery_time,
      profile.average_delivery_time,
      profile.delivery_time_days,
      freelancer.avg_delivery_time,
      freelancer.average_delivery_time,
      freelancer.delivery_time_days
    );
    return avgDelivery != null ? `${avgDelivery} days` : "N/A";
  };
  const formatAvgRating = (freelancer) => {
    const profile = freelancer?.profile || {};
    const stats = freelancer?.stats || profile?.stats || {};
    const avgRating = pickFirstNumber(
      stats.average_rating,
      stats.avg_rating,
      stats.rating,
      profile.average_rating,
      profile.avg_rating,
      profile.rating,
      freelancer.average_rating,
      freelancer.avg_rating,
      freelancer.rating
    );
    return avgRating != null ? `${avgRating.toFixed(1)} / 5` : "N/A";
  };
  const formatCompletedJobs = (freelancer) => {
    const profile = freelancer?.profile || {};
    const stats = freelancer?.stats || profile?.stats || {};
    const completed = pickFirstNumber(
      stats.completed_jobs,
      stats.jobs_completed,
      profile.completed_jobs,
      profile.jobs_completed,
      freelancer.completed_jobs,
      freelancer.jobs_completed
    );
    return completed != null ? completed.toLocaleString("en-US") : "N/A";
  };

  return (
    <div className="categories-page">
      {showRecoveryBanner && (
        <div className="recovery-banner" role="status" aria-live="polite">
          <div className="recovery-banner__content">
            <CheckCircle size={18} />
            <div>
              <strong>Started a fresh chat session.</strong>
              <span> Your old guest link expired, so you can pick a freelancer and continue from a clean thread.</span>
            </div>
          </div>
          <button
            type="button"
            className="recovery-banner__dismiss"
            onClick={() => setShowRecoveryBanner(false)}
            aria-label="Dismiss chat recovery message"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Hero Section */}
      <div className="categories-hero">
        <div className="hero-content">
          {/* <div className="hero-icon">
            <Sparkles size={32} />
          </div> */}
          <h1 className="hero-title">Find Help</h1>
          <p className="hero-subtitle"> In just three simple steps</p>
        </div>

        {/* Progress Steps */}
        <div className="progress-steps">
          <div className={`progress-step ${selectedCategory ? 'completed' : 'active'}`}>
            <div className="step-number">
              {selectedCategory ? <CheckCircle size={20} /> : '1'}
            </div>
            <span className="step-label">Select Category</span>
          </div>
          <div className="progress-line"></div>
          <div className={`progress-step ${selectedSubject ? 'completed' : selectedCategory ? 'active' : ''}`}>
            <div className="step-number">
              {selectedSubject ? <CheckCircle size={20} /> : '2'}
            </div>
            <span className="step-label">Choose Subject</span>
          </div>
          <div className="progress-line"></div>
          <div className={`progress-step ${selectedSubject && freelancers.length > 0 ? 'active' : ''}`}>
            <div className="step-number">3</div>
            <span className="step-label">Connect</span>
          </div>
        </div>
      </div>

      {/* Loading Overlay */}
      {(loading || createThreadMutation.isPending) && (
        <div className="loading-overlay">
          <div className="loading-spinner">
            <Loader className="spinner-icon" size={40} />
            <p>{createThreadMutation.isPending ? 'Starting chat...' : 'Loading...'}</p>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="error-banner">
          <span>{error}</span>
        </div>
      )}

      {/* Step 1: Categories */}
      <section className="categories-section">
        <div className="section-header">
          <h2 className="section-title">
            <span className="step-badge">Step 1</span>
            Select Your Category
          </h2>
          <p className="section-description">Choose the category that fits your needs</p>
        </div>

        <div className="categories-grid">
          {visibleCategories.map((category) => (
            <button
              key={category.id}
              className={`category-card ${selectedCategory === category.id ? 'active' : ''}`}
              onClick={() => handleCategoryClick(category.id)}
            >
              <div className="category-card-content">
                <h3 className="category-name">{category.name}</h3>
                {selectedCategory === category.id && (
                  <div className="category-check">
                    <CheckCircle size={20} />
                  </div>
                )}
              </div>
              <ChevronRight className="category-arrow" size={20} />
            </button>
          ))}
        </div>
      </section>

      {/* Step 2: Subjects */}
      {selectedCategory && (
        <section className="subjects-section">
          <div className="section-header">
            <h2 className="section-title">
              <span className="step-badge">Step 2</span>
              Choose Your Subject
            </h2>
            <p className="section-description">Pick a specific subject area within {selectedCategoryObject?.name}</p>
          </div>

          {subjects.length > 0 ? (
            <div className="subjects-chips">
              {subjects.map((subject) => (
                <button
                  key={subject.id}
                  className={`subject-chip ${selectedSubject === subject.id ? 'active' : ''}`}
                  onClick={() => handleSubjectClick(subject.id)}
                >
                  {subject.name}
                  {selectedSubject === subject.id && (
                    <CheckCircle size={16} className="chip-check" />
                  )}
                </button>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <MessageCircle size={48} />
              <p>No subjects found in this category</p>
            </div>
          )}
        </section>
      )}

      {/* Step 3: Freelancers */}
      {selectedSubject && (
        <section className="freelancers-section">
          <div className="section-header">
            <h2 className="section-title">
              <span className="step-badge">Step 3</span>
              Connect
            </h2>
            <p className="section-description">Start a conversation</p>
          </div>

          {freelancers.length > 0 ? (
            <div className="freelancers-grid">
              {freelancers.map((freelancer) => (
                <div key={freelancer.id} className="freelancer-card">
                  <div className="freelancer-card-header">
                    <div className="freelancer-avatar">
                      <span>{freelancer.username.charAt(0).toUpperCase()}</span>
                    </div>
                    <div className="freelancer-info">
                      <h3 className="freelancer-name">{freelancer.username}</h3>
                      {freelancer.is_superuser && (
                        <span className="admin-badge">
                          <Star size={12} />
                          Admin
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="freelancer-stats">
                    <div className="stat-item">
                      <DollarSign size={16} className="stat-icon" />
                      <div className="stat-content">
                        <span className="stat-label">Avg Price</span>
                        <span className="stat-value">{formatAvgPrice(freelancer)}</span>
                      </div>
                    </div>
                    <div className="stat-item">
                      <Clock size={16} className="stat-icon" />
                      <div className="stat-content">
                        <span className="stat-label">Delivery</span>
                        <span className="stat-value">{formatAvgDelivery(freelancer)}</span>
                      </div>
                    </div>
                    <div className="stat-item">
                      <Star size={16} className="stat-icon" />
                      <div className="stat-content">
                        <span className="stat-label">Avg Rating</span>
                        <span className="stat-value">{formatAvgRating(freelancer)}</span>
                      </div>
                    </div>
                    <div className="stat-item">
                      <CheckCircle size={16} className="stat-icon" />
                      <div className="stat-content">
                        <span className="stat-label">Completed</span>
                        <span className="stat-value">{formatCompletedJobs(freelancer)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="freelancer-tags">
                    <span className="tag">{selectedCategoryObject?.name}</span>
                    <span className="tag">{selectedSubjectObject?.name}</span>
                  </div>

                  <button
                    className="chat-button"
                    onClick={() => handleOpenChat(freelancer)}
                    disabled={createThreadMutation.isPending}
                  >
                    <MessageCircle size={18} />
                    Start Chat
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <MessageCircle size={48} />
              <p>No experts available for this subject</p>
              <span>Try selecting a different subject area</span>
            </div>
          )}
        </section>
      )}
    </div>
  );
};

export default Categories;
