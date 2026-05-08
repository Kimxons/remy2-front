/**
 * Chat API Service
 * Handles all chat/messaging related API calls
 * Supports both authenticated users and guest sessions
 */

import httpClient, { getAuthToken } from "./httpClient";
import { buildNewThreadWebSocketUrl, buildThreadWebSocketUrl } from "../utils/websocket";

const chatApi = {
  // =========================
  // SESSION
  // =========================
  initGuestSession: async () => {
    const response = await httpClient.get("/users/csrf-and-session/");
    return response.data;
  },

  // =========================
  // THREADS
  // =========================
  getThreads: async () => {
    const response = await httpClient.get("/chat/threads/");
    return response.data;
  },

  getGuestThreads: async () => {
    const response = await httpClient.get("/chat/guest-threads/", {
      skipAuthHeader: true,
    });
    return response.data;
  },

  previewGuestThreads: async () => {
    const response = await httpClient.get("/chat/threads/preview-guest-threads/");
    return response.data;
  },

  createThread: async (freelancerUsername, options = {}) => {
    const isAuthenticated = Boolean(options.isAuthenticated);
    const endpoint = isAuthenticated ? "/chat/threads/" : "/chat/guest-thread/create/";

    const payload = isAuthenticated
      ? {
        other_user_username: freelancerUsername,
      }
      : {
        freelancer_username: freelancerUsername,
      };

    const response = await httpClient.post(endpoint, payload, isAuthenticated ? undefined : {
      skipAuthHeader: true,
    });
    return response.data;
  },

  getThread: async (threadId) => {
    const response = await httpClient.get(`/chat/threads/${threadId}/`);
    return response.data;
  },

  // =========================
  // MESSAGES
  // =========================
  getMessages: async (threadId, options = {}) => {
    const response = await httpClient.get(`/chat/threads/${threadId}/messages/`, {
      skipAuthHeader: Boolean(options.skipAuthHeader),
    });
    return response.data;
  },

  sendMessage: async (
    threadId,
    message,
    attachmentIds = []
  ) => {
    const response = await httpClient.post(
      `/chat/threads/${threadId}/messages/`,
      {
        message,
        attachment_ids: attachmentIds,
      },
    );

    return response.data;
  },

  // =========================
  // OFFERS
  // =========================
  sendOffer: async (threadId, offer) => {
    const response = await httpClient.post(
      `/chat/threads/${threadId}/messages/`,
      {
        message:
          offer.message?.trim() ||
          offer.description?.trim() ||
          `Offer: ${offer.title}`,
        is_offer: true,
        offer_title: offer.title,
        offer_price: Number(offer.price || 0).toFixed(2),
        offer_timeline: offer.timeline,
        offer_description: offer.description,
        attachment_ids: offer.attachment_ids || [],
      },
    );

    return response.data;
  },

  updateOfferStatus: async (threadId, offerId, decision) => {
    const decisionValue =
      decision && typeof decision === "object"
        ? decision.decision || decision.offer_status || ""
        : decision;
    const normalizedDecision = String(decisionValue || "").toLowerCase();
    const isAccept =
      normalizedDecision === "accepted" ||
      normalizedDecision === "accept";

    const payload = {
      offer_status: isAccept ? "accepted" : "rejected",
    };

    const response = await httpClient.post(
      `/chat/threads/${threadId}/messages/${offerId}/update-offer/`,
      payload
    );

    return response.data;
  },

  // =========================
  // PAYMENT (FIXED HANDSHAKE 🔥)
  // =========================
  initializeJobPayment: async (jobId, options = {}) => {
    console.log("STEP 1 - jobId received:", jobId);

    if (!jobId) {
      throw new Error("jobId is missing");
    }

    // UPDATED: Destructure snake_case keys to match OfferCard.js
    const {
      client_email,
      client_password,
      client_password_confirm
    } = options;

    const payload = {
      job_id: jobId,
      client_email: client_email || undefined,
      client_password: client_password || undefined,
      client_password_confirm: client_password_confirm || undefined,
    };

    // Clean up undefined keys
    Object.keys(payload).forEach(key => payload[key] === undefined && delete payload[key]);

    try {
      console.log("🚀 INIT PAYMENT:", {
        jobId,
        email: payload.client_email,
      });

      const response = await httpClient.post(
        "/payments/initialize/",
        payload
      );

      console.log("✅ PAYMENT SUCCESS:", response.data);
      return response.data;
    } catch (error) {
      console.error("❌ PAYMENT ERROR:", {
        status: error.response?.status,
        data: error.response?.data,
        payload,
      });
      throw error;
    }
  },

  // =========================
  // FILE UPLOAD
  // =========================
  uploadFile: async (file, threadId = null) => {
    const formData = new FormData();
    formData.append("file", file);

    if (threadId) {
      formData.append("message_thread_id", threadId);
    }

    const config = {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    };

    const response = await httpClient.post(
      "/chat/upload/",
      formData,
      config
    );

    return response.data;
  },

  // =========================
  // DASHBOARD
  // =========================
  getDashboardSummary: async () => {
    const response = await httpClient.get("/dashboard/stats/");
    return response.data;
  },

  getUnreadCount: async () => {
    const response = await httpClient.get("/chat/unread-count/");
    return response.data;
  },

  getThreadUnreads: async () => {
    const response = await httpClient.get("/chat/thread-unreads/");
    return response.data;
  },

  getPendingOffers: async () => {
    const response = await httpClient.get("/chat/pending-offers/");
    return response.data;
  },

  getPendingOffersSent: async () => {
    const response = await httpClient.get("/chat/threads/sent-offers/");
    return response.data;
  },

  // =========================
  // WEBSOCKET
  // =========================
  getWebSocketUrl: (threadId, sessionKey = null) => {
    return buildThreadWebSocketUrl({ threadId, sessionKey });
  },

  getNewThreadWebSocketUrl: (freelancerId, sessionKey = null) => {
    return buildNewThreadWebSocketUrl({ freelancerId, sessionKey });
  },
};

export default chatApi;