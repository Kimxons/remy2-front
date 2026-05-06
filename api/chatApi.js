/**
 * Chat API Service
 * Handles all chat/messaging related API calls
 * Supports both authenticated users and guest sessions
 */

import httpClient from "./httpClient";
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

  getGuestThreads: async (sessionKey) => {
    const response = await httpClient.get("/chat/guest-threads/", {
      params: { session_key: sessionKey },
    });
    return response.data;
  },

  previewGuestThreads: async (guestSessionKey) => {
    const response = await httpClient.get(
      "/chat/threads/preview-guest-threads/",
      {
        params: { guest_session_key: guestSessionKey },
      }
    );
    return response.data;
  },

  createThread: async (freelancerUsername, sessionKey = null) => {
    const endpoint = sessionKey
      ? "/chat/guest-thread/create/"
      : "/chat/threads/";

    const payload = sessionKey
      ? {
        freelancer_username: freelancerUsername,
        session_key: sessionKey,
      }
      : {
        other_user_username: freelancerUsername,
      };

    const response = await httpClient.post(endpoint, payload);
    return response.data;
  },

  getThread: async (threadId, sessionKey = null) => {
    const params = sessionKey ? { session_key: sessionKey } : {};
    const response = await httpClient.get(
      `/chat/threads/${threadId}/`,
      { params }
    );
    return response.data;
  },

  // =========================
  // MESSAGES
  // =========================
  getMessages: async (threadId, sessionKey = null) => {
    const params = sessionKey ? { session_key: sessionKey } : {};
    const response = await httpClient.get(
      `/chat/threads/${threadId}/messages/`,
      { params }
    );
    return response.data;
  },

  sendMessage: async (
    threadId,
    message,
    sessionKey = null,
    attachmentIds = []
  ) => {
    const params = sessionKey ? { session_key: sessionKey } : {};

    const response = await httpClient.post(
      `/chat/threads/${threadId}/messages/`,
      {
        message,
        attachment_ids: attachmentIds,
      },
      { params }
    );

    return response.data;
  },

  // =========================
  // OFFERS
  // =========================
  sendOffer: async (threadId, offer, sessionKey = null) => {
    const params = sessionKey ? { session_key: sessionKey } : {};

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
      { params }
    );

    return response.data;
  },

  updateOfferStatus: async (threadId, offerId, decision, sessionKey = null) => {
    const normalizedDecision = String(decision || "").toLowerCase();
    const isAccept =
      normalizedDecision === "accepted" ||
      normalizedDecision === "accept";

    const payload = {
      offer_status: isAccept ? "accepted" : "rejected",
    };

    const response = await httpClient.post(
      `/chat/threads/${threadId}/messages/${offerId}/update-offer/`,
      payload,
      sessionKey ? { params: { session_key: sessionKey } } : undefined
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
      session_key,
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

    const config = session_key
      ? { params: { session_key: session_key } }
      : {};

    try {
      console.log("🚀 INIT PAYMENT:", {
        jobId,
        email: payload.client_email,
        sessionKey: session_key,
      });

      const response = await httpClient.post(
        "/payments/initialize/",
        payload,
        config
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
  uploadFile: async (file, threadId = null, sessionKey = null) => {
    const formData = new FormData();
    formData.append("file", file);

    if (threadId) {
      formData.append("message_thread_id", threadId);
    }

    const config = {
      headers: {
        "Content-Type": "multipart/form-data",
      },
      params: sessionKey ? { session_key: sessionKey } : {},
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