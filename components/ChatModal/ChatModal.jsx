"use client"

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import httpClient from "@/api/httpClient";
import guestSessionService from "@/services/guestSessionService";
import chatApi from "@/api/chatApi";
import { savePendingClientEmailForJob } from "@/utils/clientOnboarding";
import { buildNewThreadWebSocketUrl, buildThreadWebSocketUrl } from "@/utils/websocket";
import { FaPaperPlane, FaPlus } from "react-icons/fa";
import "./ChatModal.scss";
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

const getToken = () => {
    let token = localStorage.getItem("access");
    if (!token) {
        const storedUser = localStorage.getItem("currentUser");
        if (storedUser) token = JSON.parse(storedUser)?.token;
    }
    return token;
};
const getCurrentUsername = () => {
    try {
        const storedUser = typeof window !== "undefined" ? localStorage.getItem("currentUser") : null;
        if (storedUser) {
            const user = JSON.parse(storedUser);
            return (user?.username || user?.display_name || "me").toLowerCase();
        }
    } catch (err) {
        console.error("Error parsing currentUser:", err);
    }
    return "guest"; // Simple, safe, and no undefined variables
};

const getClientIdentity = (userType, sessionKey) => {
    const storedUser = localStorage.getItem("currentUser");
    if (storedUser) {
        const user = JSON.parse(storedUser);
        return { type: "user", id: String(user.id || user.pk || user.user_id || ""), username: (user.username || user.display_name || "").toLowerCase() };
    }
    return { type: "guest", id: String(sessionKey || ""), username: "guest" };
};

const formatMessageDate = (timestamp) => {
    try {
        const ts = new Date(timestamp);
        const today = new Date();
        const yesterday = new Date();
        yesterday.setDate(today.getDate() - 1);
        if (ts.toDateString() === today.toDateString()) return "Today";
        if (ts.toDateString() === yesterday.toDateString()) return "Yesterday";
        return ts.toLocaleDateString([], { year: "numeric", month: "short", day: "numeric" });
    } catch {
        return "";
    }
};

const groupMessagesByDate = (msgs) => {
    const groups = {};
    (msgs || []).forEach((msg) => {
        if (!msg.timestamp) return;
        const label = formatMessageDate(msg.timestamp) || "Unknown Date";
        if (!groups[label]) groups[label] = [];
        groups[label].push(msg);
    });
    return groups;
};

const formatUSD = (amount) =>
    new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(Number(amount) || 0);

const normalizeMessage = (raw) => {
    if (!raw) return null;
    const isOffer = !!(raw.isOffer || raw.is_offer || raw.offer || raw.offer_title || (raw.offer && raw.offer.title));
    const timestamp = raw.timestamp || raw.created_at || raw.updated_at || new Date().toISOString();
    let messageText = "";
    if (!isOffer) {
        if (typeof raw.message === "string") messageText = raw.message;
        else if (typeof raw.text === "string") messageText = raw.text;
        else if (raw.message && typeof raw.message === "object") messageText = raw.message.message || raw.message.text || "";
        else messageText = raw.message || raw.text || "";
    }
    const senderName = (raw.sender_username || raw.sender_name || raw.sender || (raw.offer && raw.offer.sender) || raw.offer?.sender_name || "guest").toLowerCase();
    let offerObj = null;
    if (isOffer) {
        const offerSrc = raw.offer || { title: raw.offer_title || raw.title, price: raw.offer_price || raw.price, timeline: raw.offer_timeline || raw.timeline, description: raw.offer_description || raw.description, status: raw.offer_status || raw.status, id: raw.offer_id || raw.id };
        offerObj = { title: offerSrc.title, price: offerSrc.price, timeline: offerSrc.timeline, description: offerSrc.description, status: offerSrc.status, id: offerSrc.id };
    }
    return { ...raw, isOffer, sender_name: senderName, sender_user_id: raw.sender_user_id || raw.sender_id || raw.sender?.id, sender_guest_key: raw.sender_guest_key || raw.guest_session_key, message: isOffer ? null : (messageText || ""), timestamp, offer: offerObj };
};

const normalizeThreadsFromResponse = (raw, userType, currentUsername) =>
    (raw || []).map((t) => {
        const normalizedMessages = (t.messages || []).map(normalizeMessage).filter(Boolean);
        let displayName = "Unknown Party";
        const getPartyName = (party) => party?.display_name || party?.username || party?.name;
        if (t.other_party_name && String(t.other_party_name).toLowerCase() !== String(currentUsername).toLowerCase()) displayName = t.other_party_name;
        else {
            if (userType === "freelancer" || userType === "superuser") {
                if (t.client && getPartyName(t.client)) displayName = getPartyName(t.client);
                else if (t.client_username) displayName = t.client_username;
                else if (t.guest_session_key) displayName = `Guest-${t.id || t.temp_id || "new"}`;
                else if (t.freelancer && t.freelancer.id && t.freelancer.id !== t.id) displayName = getPartyName(t.freelancer);
            } else if (userType === "client" || userType === "guest") {
                if (t.freelancer && getPartyName(t.freelancer)) displayName = getPartyName(t.freelancer);
                else if (t.freelancer_username) displayName = t.freelancer_username;
            }
        }
        if ((!displayName || displayName === "Unknown Party") && t.freelancer_username) displayName = t.freelancer_username;
        if (!displayName) displayName = "New Chat";
        return { ...t, display_name: displayName, messages: normalizedMessages };
    });

const getLastMessageText = (thread) => {
    if (!thread) return "No messages";
    if (typeof thread.last_message === "string" && thread.last_message) return thread.last_message;
    const lastMsg = thread.messages?.[thread.messages.length - 1];
    if (!lastMsg) return "No messages";
    if (lastMsg.isOffer || lastMsg.offer) return lastMsg.offer?.title || "New Offer";
    return lastMsg.message || "No message";
};

const getSelectedThreadStorageKey = (userType, sessionKey) =>
    userType === "guest"
        ? `selectedThreadId:guest:${sessionKey || "unknown"}`
        : "selectedThreadId:auth";

const ChatModal = ({ isOpen = true, userType = "guest", initialSelectedThreadId = null, initialGuestSessionKey = null, freelancerId = null, freelancerUsername = null, onClose, isolateThreadView = false }) => {
    const normalizedUserType = String(userType || "guest").toLowerCase();
    const [threads, setThreads] = useState([]);
    const [threadsLoading, setThreadsLoading] = useState(true);
    const [selectedThread, setSelectedThread] = useState(null);
    const [messages, setMessages] = useState([]);
    const [messagesLoading, setMessagesLoading] = useState(false);
    const [inputMessage, setInputMessage] = useState("");
    const [showOfferForm, setShowOfferForm] = useState(false);
    const [isWsReady, setIsWsReady] = useState(false);
    const [attachmentsToSend, setAttachmentsToSend] = useState([]);
    const [canSendOffer, setCanSendOffer] = useState(false);
    // Change this (source 269):
    // Locate this block in your ChatModal component:
    const isEligibleToSendOffer = useMemo(() => {
        // Only allow actual freelancers or superusers to
        //  see/send offers
        // This will return false for "guest" or "client"
        return normalizedUserType === "freelancer" || normalizedUserType === "superuser";
    }, [normalizedUserType]);
    const [offerTitle, setOfferTitle] = useState("");
    const [offerPrice, setOfferPrice] = useState("");
    const [offerTimeline, setOfferTimeline] = useState("");
    const [offerDescription, setOfferDescription] = useState("");

    const fileInputRef = useRef(null);
    const ws = useRef(null);
    const messagesEndRef = useRef(null);
    const currentThreadRef = useRef(null);
    const lastSentMessageRef = useRef(null);

    const currentUsername = getCurrentUsername();
    const [sessionKey, setSessionKey] = useState(() => {
        if (userType !== "guest") return null;
        return initialGuestSessionKey || guestSessionService.getSessionKey();
    });

    // Inside your ChatModal component:

    const clientIdentity = useMemo(() => {
        // Safety check for Next.js / SSR
        if (typeof window === "undefined") return { type: "guest", id: "", username: "guest" };

        const storedUser = localStorage.getItem("currentUser");
        if (storedUser) {
            try {
                const user = JSON.parse(storedUser);
                return {
                    type: "user",
                    id: String(user.id || user.pk || user.user_id || ""),
                    username: (user.username || user.display_name || "").toLowerCase()
                };
            } catch (e) {
                console.error("Failed to parse user", e);
            }
        }
        return { type: "guest", id: String(sessionKey || ""), username: "guest" };
    }, [userType, sessionKey]); // Only re-runs if these change

    const stateRef = useRef({ selectedThread, clientIdentity, sessionKey, updateThreadList: null });

    const uploadAttachments = useCallback(async (files) => {
        if (!files || files.length === 0) return [];
        try {
            const formData = new FormData();
            files.forEach((f) => formData.append("file", f));
            const token = getToken();
            const headers = token ? { Authorization: `Bearer ${token}` } : {};
            const res = await httpClient.post("/upload/", formData, { headers });
            const data = res?.data;
            if (Array.isArray(data)) return data;
            if (data && typeof data === "object" && (data.id || data.file || data.url)) return [data];
            if (data?.results && Array.isArray(data.results)) return data.results;
            return [];
        } catch (err) {
            console.error("Attachment upload failed:", err);
            return [];
        }
    }, []);

    const fetchMessagesForThread = useCallback(async (thread, explicitKey = null) => {
        if (!thread) { setMessages([]); setMessagesLoading(false); return; }
        if (!thread.id) { setMessages(thread.messages || []); setMessagesLoading(false); return; }
        setMessagesLoading(true);
        try {
            const token = getToken();
            const headers = token ? { Authorization: `Bearer ${token}` } : {};
            const keyToUse = explicitKey || sessionKey;
            const url = userType === "guest"
                ? `/chat/threads/${thread.id}/messages/?session_key=${keyToUse}`
                : `/chat/threads/${thread.id}/messages/`;
            const res = await httpClient.get(url, { headers });
            const rawMsgs = res?.data?.messages || res?.data?.results || res?.data || [];
            setMessages((rawMsgs || []).map(normalizeMessage).filter(Boolean));
            setMessagesLoading(false);
        } catch {
            setMessages([]);
            setMessagesLoading(false);
        }
    }, [userType, sessionKey]);

    const createOrFetchGuestThread = useCallback(async () => {
        if (!freelancerUsername) return null;
        try {
            const res = await chatApi.createThread(freelancerUsername, sessionKey);
            const normalizedNewThread = normalizeThreadsFromResponse([res.thread || res], userType, currentUsername)[0];
            const newKey = res.guest_session_key;
            setThreads((prev) => {
                const filtered = prev.filter((t) => String(t.id) !== String(normalizedNewThread?.id));
                return isolateThreadView ? [normalizedNewThread] : [normalizedNewThread, ...filtered];
            });
            setSelectedThread(normalizedNewThread);
            setCanSendOffer(Boolean(normalizedNewThread?.can_send_offer));
            if (newKey) {
                setSessionKey(newKey);
                guestSessionService.setSessionKey(newKey);
                guestSessionService.setThreadSessionKey(normalizedNewThread?.id, newKey);
            }
            if (normalizedNewThread?.id) fetchMessagesForThread(normalizedNewThread, newKey || sessionKey);


            return normalizedNewThread;
        } catch (err) {
            console.error("Failed to create/fetch thread:", err);
            return null;
        }

    }, [freelancerUsername, userType, currentUsername, isolateThreadView, sessionKey, fetchMessagesForThread]);

    const updateThreadList = useCallback((threadId, lastMessageText, newMessageObject = null) => {
        if (!threadId && !newMessageObject?.id) return;
        setThreads((prevThreads) => {
            const existingIndex = prevThreads.findIndex((t) => String(t.id) === String(threadId) || String(t.temp_id) === String(threadId));
            if (existingIndex !== -1) {
                const existing = prevThreads[existingIndex];
                const updatedMessages = (selectedThread?.id === existing.id) && newMessageObject
                    ? [...(existing.messages || []), newMessageObject]
                    : existing.messages;
                const updated = { ...existing, last_message: typeof lastMessageText === "string" ? lastMessageText : existing.last_message, updated_at: new Date().toISOString(), messages: updatedMessages };
                const remaining = prevThreads.filter((_, i) => i !== existingIndex);
                return [updated, ...remaining];
            }
            return prevThreads;
        });
    }, [selectedThread]);

    const fetchThreads = useCallback(async () => {
        setThreadsLoading(true);
        try {
            let res, raw = [];
            const storageKey = getSelectedThreadStorageKey(userType, sessionKey);
            const storedThreadId = typeof window !== "undefined" ? localStorage.getItem(storageKey) : null;
            if (userType === "guest") {
                const keyToUse = sessionKey;
                if (!keyToUse) {
                    if (freelancerUsername) {
                        const temp = { id: null, temp_id: `new-${freelancerId || Math.random()}`, freelancer_id: freelancerId, display_name: freelancerUsername, messages: [], updated_at: new Date().toISOString() };
                        setThreads([temp]); setSelectedThread(temp); setThreadsLoading(false); return [temp];
                    }
                    setThreads([]); setThreadsLoading(false); return [];
                }
                res = await httpClient.get(`/chat/guest-threads/?session_key=${keyToUse}`);
                raw = res?.data?.results || res?.data?.threads || res?.data || [];
                if (Array.isArray(raw)) {
                    raw.forEach((thread) => {
                        if (thread?.id && thread?.guest_session_key) {
                            guestSessionService.setThreadSessionKey(thread.id, thread.guest_session_key);
                        }
                    });
                }
            } else { res = await httpClient.get("chat/threads/"); raw = Array.isArray(res?.data) ? res.data : res?.data?.results || res?.data || []; }

            let normalized = normalizeThreadsFromResponse(raw || [], userType, currentUsername);

            let initial = null;
            if (isolateThreadView) {
                if (initialSelectedThreadId) initial = normalized.find(t => String(t.id) === String(initialSelectedThreadId));
                else if (freelancerId) initial = normalized.find(t => String(t.freelancer_id) === String(freelancerId) || String(t.freelancer?.id) === String(freelancerId));
                if (!initial && freelancerUsername) { initial = { id: null, temp_id: `new-${freelancerId || Math.random()}`, freelancer_id: freelancerId, display_name: freelancerUsername, messages: [], updated_at: new Date().toISOString() }; normalized = [initial]; }
                else if (initial) normalized = [initial];
            } else { if (initialSelectedThreadId) initial = normalized.find(t => String(t.id) === String(initialSelectedThreadId)); else if (storedThreadId) initial = normalized.find(t => String(t.id) === String(storedThreadId)); }

            setThreads(normalized); if (initial) setSelectedThread(initial); setThreadsLoading(false);
        } catch { setThreadsLoading(false); }
    }, [userType, initialSelectedThreadId, freelancerId, freelancerUsername, currentUsername, sessionKey, isolateThreadView]);

    useEffect(() => { stateRef.current = { selectedThread, clientIdentity, sessionKey, updateThreadList }; }, [selectedThread, clientIdentity, sessionKey, updateThreadList]);
    useEffect(() => {
        if (userType !== "guest") return;
        const canonical = guestSessionService.getSessionKey();
        if (canonical && canonical !== sessionKey) {
            setSessionKey(canonical);
            setSelectedThread(null);
            setMessages([]);
        }
    }, [userType, sessionKey]);
    useEffect(() => { if (isOpen) fetchThreads(); }, [fetchThreads, isOpen]);
    useEffect(() => { currentThreadRef.current = selectedThread?.id || selectedThread?.temp_id || null; if (selectedThread) { fetchMessagesForThread(selectedThread); setIsWsReady(false); } else setMessages([]); }, [selectedThread, fetchMessagesForThread]);

    const handleWsMessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            const type = data.type;
            if (type === "chat_message" || type === "new_message") {
                const incomingMsg = normalizeMessage(data.message || data);
                setMessages((prevMessages) => {
                    if (prevMessages.some((m) => m.id === incomingMsg.id)) return prevMessages;
                    const optimisticIndex = prevMessages.findIndex((m) => m.isLocal && (m.message || "").trim() === (incomingMsg.message || "").trim() && isLocalMessage(m));
                    if (optimisticIndex !== -1) { const updated = [...prevMessages]; updated[optimisticIndex] = incomingMsg; return updated; }
                    return [...prevMessages, incomingMsg];
                });
                const tId = stateRef.current.selectedThread?.id || stateRef.current.selectedThread?.temp_id;
                if (tId && stateRef.current.updateThreadList) stateRef.current.updateThreadList(tId, incomingMsg.message, incomingMsg);
            } else if (type === "offer") setMessages((prev) => [...prev, normalizeMessage({ ...data.offer, isOffer: true })]);
            else if (type === "offer_decision") {
                const { offer_id, decision } = data;
                setMessages((prev) => prev.map((msg) => { const currentId = msg.offer?.id || msg.id || msg.offer_id; if (String(currentId) === String(offer_id)) return { ...msg, offer: { ...msg.offer, status: decision }, timestamp: new Date().toISOString() }; return msg; }));
            }
        } catch { }
    };

    useEffect(() => {
        if (!selectedThread) { setIsWsReady(false); if (ws.current) ws.current.close(); ws.current = null; return; }
        if (ws.current) ws.current.close(); setIsWsReady(false);
        let wsUrl = "";
        const token = getToken();
        const keyToUse = sessionKey || "";

        if (selectedThread.id) {
            wsUrl = buildThreadWebSocketUrl({
                threadId: selectedThread.id,
                sessionKey: userType === "guest" ? keyToUse : null,
                token: userType === "guest" ? null : token,
            });
        } else if (userType === "guest" && selectedThread.freelancer_id) {
            wsUrl = buildNewThreadWebSocketUrl({
                freelancerId: selectedThread.freelancer_id,
                sessionKey: keyToUse,
            });
        } else {
            return;
        }

        const socket = new WebSocket(wsUrl);
        ws.current = socket;
        socket.onopen = () => setIsWsReady(true);
        socket.onmessage = handleWsMessage;
        socket.onerror = (err) => console.error(err);
        socket.onclose = () => setIsWsReady(false);
        return () => { try { socket.close(); } catch { } if (ws.current === socket) ws.current = null; };
    }, [selectedThread, userType, sessionKey, clientIdentity]);

    const onSelectFiles = async (e) => {
        const files = Array.from(e.target.files || []);
        if (!files.length) return;
        const uploaded = await uploadAttachments(files);
        const mapped = uploaded.map((u) => ({ id: u.id || u.pk, name: u.name || u.filename || (u.file ? u.file.split('/').pop() : "Attachment"), url: u.file_url || u.url || u.file || "", type: u.mime_type || u.type || "", size: u.size }));
        setAttachmentsToSend((prev) => [...prev, ...mapped]);
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    const isLocalMessage = (m) => m ? m.isLocal || (clientIdentity?.type === "guest" ? String(m.sender_guest_key) === String(clientIdentity.id) : String(m.sender_user_id) === String(clientIdentity.id)) : false;

    const removeAttachment = (id) => setAttachmentsToSend((list) => list.filter((a) => a.id !== id));

    const handleSendMessage = async (e) => {
        if (e?.preventDefault) e.preventDefault();
        const trimmed = inputMessage.trim();
        if (!trimmed && !attachmentsToSend.length) return;
        if (userType === "guest" && selectedThread && !selectedThread.id) {
            const realThread = await createOrFetchGuestThread();
            if (!realThread?.id) return;
        }
        if (!ws.current || !isWsReady) return;
        const payload = { type: "chat_message", message: trimmed, attachment_ids: attachmentsToSend.map((a) => a.id), ...(clientIdentity.type === "guest" ? { sender_guest_key: clientIdentity.id } : { sender_user_id: clientIdentity.id }) };
        if (!selectedThread?.id && selectedThread?.freelancer_id) payload.freelancer_id = selectedThread.freelancer_id;
        const localMessage = { id: `local-${Date.now()}`, isLocal: true, message: trimmed, timestamp: new Date().toISOString(), attachments: attachmentsToSend, sender_name: currentUsername, ...(clientIdentity.type === "guest" ? { sender_guest_key: clientIdentity.id } : { sender_user_id: clientIdentity.id }) };
        setMessages((prev) => [...prev, normalizeMessage(localMessage)]);
        lastSentMessageRef.current = trimmed;
        try { ws.current.send(JSON.stringify(payload)); } catch { }
        setInputMessage(""); setAttachmentsToSend([]);
        const threadIdToUpdate = selectedThread?.id || selectedThread?.temp_id;
        if (threadIdToUpdate) updateThreadList(threadIdToUpdate, trimmed || "Attachment(s) sent");
    };
    const handleCreateOffer = (e) => {
        if (e?.preventDefault) e.preventDefault();
        // Correcting roles to match backend expectations
        if (!(userType === "freelancer" || userType === "superuser")) {
            return alert("Only freelancers can send offers.");
        }
        if (!offerTitle || !offerPrice || !offerTimeline) return alert("Please fill title, price, and timeline.");
        if (!ws.current || !isWsReady) return alert("Chat connection is not open.");
        const price = parseFloat(offerPrice);
        const timeline = parseInt(offerTimeline, 10);
        if (isNaN(price) || isNaN(timeline) || price <= 0 || timeline <= 0) return alert("Please enter valid positive numbers.");
        const offerPayload = { title: offerTitle, price, timeline, description: offerDescription || "" };
        const wsPayload = { type: "offer", offer: offerPayload };
        if (!selectedThread?.id && selectedThread?.freelancer_id) wsPayload.freelancer_id = selectedThread.freelancer_id;
        try { ws.current.send(JSON.stringify(wsPayload)); } catch { }
        setOfferTitle(""); setOfferPrice(""); setOfferTimeline(""); setOfferDescription(""); setShowOfferForm(false);
        const threadIdToUpdate = selectedThread?.id || selectedThread?.temp_id;
        if (threadIdToUpdate) updateThreadList(threadIdToUpdate, `Offer: ${offerTitle}`, null);
    };

    const getOfferStatusLabel = (status) => {
        const normalized = String(status || "pending").toLowerCase();
        if (normalized === "accepted") return "Accepted";
        if (normalized === "rejected") return "Rejected";
        return "Pending";
    };

    const handleOfferResponse = async (offerId, decision) => {
        if (!offerId || !["accepted", "rejected"].includes(decision)) return;
        if (userType === "freelancer") return alert("Freelancers cannot respond to their own offers.");
        if (!selectedThread?.id) return alert("Thread not ready. Please try again.");

        let payloadDecision = decision;
        if (userType === "guest" && decision === "accepted") {
            const suggestedEmail = (() => {
                try {
                    const raw = localStorage.getItem("currentUser");
                    const parsed = raw ? JSON.parse(raw) : null;
                    return parsed?.email || "";
                } catch {
                    return "";
                }
            })();

            const inputEmail = window.prompt(
                "Enter your email to create/finalize your client account:",
                suggestedEmail
            );
            if (inputEmail === null) return;
            const trimmed = inputEmail.trim();
            if (!EMAIL_REGEX.test(trimmed)) {
                alert("Please enter a valid email to continue.");
                return;
            }
            payloadDecision = { decision: "accepted", clientEmail: trimmed };
        }

        try {
            const response = await chatApi.updateOfferStatus(
                selectedThread.id,
                offerId,
                payloadDecision,
                userType === "guest" ? sessionKey : null
            );

            if (response?.job_created?.id && payloadDecision?.clientEmail) {
                savePendingClientEmailForJob(response.job_created.id, payloadDecision.clientEmail);
            }

            const resolvedStatus =
                response?.offer?.status ||
                response?.offer_status ||
                (decision === "accepted" ? "accepted" : "rejected");

            setMessages((prev) =>
                prev.map((msg) => {
                    const id = msg.offer?.id || msg.id || msg.offer_id;
                    if ((msg.isOffer || msg.offer) && String(id) === String(offerId)) {
                        return {
                            ...msg,
                            offer: { ...msg.offer, status: resolvedStatus, created_job: response?.offer?.created_job || msg.offer?.created_job },
                            isOffer: true,
                            timestamp: new Date().toISOString(),
                        };
                    }
                    return msg;
                })
            );

            if (response?.job_created?.payment_required && response?.job_created?.id) {
                try {
                    const paymentOptions = {};
                    if (userType === "guest") {
                        const email = String(payloadDecision?.clientEmail || "").trim();
                        if (!EMAIL_REGEX.test(email)) {
                            alert("Please provide a valid email before payment.");
                            return;
                        }

                        const password = window.prompt(
                            "Create a password for your new client account (minimum 8 characters):",
                            ""
                        );
                        if (password === null) {
                            alert("Payment setup canceled. Use Pay Now on this offer when ready.");
                            return;
                        }

                        const confirmPassword = window.prompt("Confirm your password:", "");
                        if (confirmPassword === null) {
                            alert("Payment setup canceled. Use Pay Now on this offer when ready.");
                            return;
                        }

                        if (password.length < MIN_PASSWORD_LENGTH) {
                            alert("Password must be at least 8 characters.");
                            return;
                        }

                        paymentOptions.sessionKey = sessionKey;
                        paymentOptions.clientEmail = email;
                        paymentOptions.clientPassword = password;
                        paymentOptions.clientPasswordConfirm = confirmPassword;
                    }

                    const paymentData = await chatApi.initializeJobPayment(
                        response.job_created.id,
                        paymentOptions
                    );
                    if (paymentData.authorizationUrl) {
                        localStorage.setItem("pendingPaymentJobId", String(response.job_created.id));
                        window.location.href = paymentData.authorizationUrl;
                        return;
                    }
                } catch (error) {
                    const data = error.response?.data || {};
                    alert(
                        data.client_password_confirm ||
                        data.client_password ||
                        data.client_email ||
                        data.detail ||
                        "Failed to initialize payment. Please retry."
                    );
                }
            }
        } catch (error) {
            // Fallback for deployments still using websocket-only offer decisions.
            if (!ws.current || !isWsReady) return alert("Failed to process offer response.");
            try {
                ws.current.send(JSON.stringify({ type: "offer_decision", offer_id: offerId, decision, thread_id: selectedThread?.id }));
            } catch { }
            setMessages((prev) =>
                prev.map((msg) => {
                    const id = msg.offer?.id || msg.id || msg.offer_id;
                    if ((msg.isOffer || msg.offer) && String(id) === String(offerId)) {
                        return { ...msg, offer: { ...msg.offer, status: decision }, isOffer: true, timestamp: new Date().toISOString() };
                    }
                    return msg;
                })
            );
        }
    };

    const handleThreadSelection = (thread) => {
        if (selectedThread?.id === thread.id && selectedThread?.temp_id === thread.temp_id) return;
        setSelectedThread(thread);
        if (typeof window !== "undefined") {
            const storageKey = getSelectedThreadStorageKey(userType, sessionKey);
            if (thread.id || thread.temp_id) localStorage.setItem(storageKey, thread.id || thread.temp_id);
            else localStorage.removeItem(storageKey);
        }
        setShowOfferForm(false); setMessagesLoading(true); fetchMessagesForThread(thread);
    };

    useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

    const handleKeyDown = (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendMessage(e); } };

    if (!isOpen) return null;

    console.log("userType:", userType, "canSendOffer:", canSendOffer);

    return (
        <div className="chat-overlay" onClick={onClose}>
            <div className="chat-modal" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <div className="modal-title-wrap">
                        <h3>{freelancerUsername || selectedThread?.display_name || "Chat"}</h3>
                        <p>Real-time messages, offers, and payment updates</p>
                    </div>
                    <button className="close-btn" onClick={onClose} aria-label="Close">✖</button>
                </div>
                <div className="chat-body">
                    {!isolateThreadView && (
                        <div className="thread-list">
                            {threadsLoading ? <p className="thread-list-state">Loading chats...</p> : threads.map((t) => (
                                <div key={t.id || t.temp_id} className={`thread-item ${selectedThread?.id === t.id ? "active" : ""}`} onClick={() => handleThreadSelection(t)}>
                                    <div className="thread-name">{t.display_name}</div>
                                    <div className="thread-last-message">{getLastMessageText(t)}</div>
                                </div>
                            ))}
                        </div>
                    )}
                    <div className="chat-section">
                        <div className="chat-header">
                            <h4>{freelancerUsername || selectedThread?.display_name || "No chat selected"}</h4>
                            <div className={`connection-status ${isWsReady ? "is-online" : "is-offline"}`}>{isWsReady ? "Connected" : "Connecting..."}</div>
                        </div>
                        <div className="message-list">
                            {messagesLoading ? <p className="messages-state">Loading messages...</p>
                                : messages.length === 0 ? <div className="empty-chat-placeholder">No messages yet — say hi 👋</div>
                                    : Object.entries(groupMessagesByDate(messages)).map(([dateLabel, msgList]) => (
                                        <div key={dateLabel} className="message-day-group">
                                            <div className="date-divider">{dateLabel}</div>
                                            {msgList.map((m, i) => {
                                                const sent = isLocalMessage(m);
                                                const itemClass = `message-item ${sent ? "sent" : "received"}`;
                                                return (
                                                    <div key={i} className={itemClass}>
                                                        {m.isOffer ? (
                                                            <div className="offer-box">
                                                                <strong>{m.offer?.title}</strong>
                                                                <p>{formatUSD(m.offer?.price)} - {m.offer?.timeline} days</p>
                                                                {m.offer?.description && <p>{m.offer.description}</p>}
                                                                <div className="offer-actions">
                                                                    {userType !== "freelancer" && m.offer?.status === "pending" && (
                                                                        <>
                                                                            <button className="btn-accept" onClick={() => handleOfferResponse(m.offer.id, "accepted")}>Accept</button>
                                                                            <button className="btn-reject" onClick={() => handleOfferResponse(m.offer.id, "rejected")}>Reject</button>
                                                                        </>
                                                                    )}
                                                                    <span className={`offer-status status-${String(m.offer?.status || "pending").toLowerCase()}`}>{getOfferStatusLabel(m.offer?.status)}</span>
                                                                </div>
                                                                <div className="message-timestamp">{new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                                                            </div>
                                                        ) : (
                                                            <>
                                                                <div className="message-text">{m.message}</div>
                                                                {m.attachments && m.attachments.length > 0 && (
                                                                    <div className="attachment-list">
                                                                        {m.attachments.map((att) => (
                                                                            <div key={att.id} className="attachment-item">
                                                                                <a href={att.url} download={att.name} target="_blank" rel="noopener noreferrer">{att.name}</a>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                                <div className="message-timestamp">{new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                                                            </>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ))}
                            <div ref={messagesEndRef} />
                        </div>
                        {attachmentsToSend.length > 0 && (
                            <div className="attachments-preview">
                                {attachmentsToSend.map((att) => (
                                    <div key={att.id} className="attachment-pill">
                                        <span className="pill-name">{att.name}</span>
                                        <button className="pill-remove" onClick={() => removeAttachment(att.id)}>✕</button>
                                    </div>
                                ))}
                            </div>
                        )}
                        <form className="message-form" onSubmit={handleSendMessage}>
                            <textarea value={inputMessage} onChange={(e) => setInputMessage(e.target.value)} placeholder="Type a message and press Enter..." rows={1} onKeyDown={handleKeyDown} />
                            <div className="input-actions">
                                <button type="submit" disabled={!isWsReady || (!inputMessage.trim() && attachmentsToSend.length === 0)}><FaPaperPlane /></button>
                                <button type="button" className="attach-btn" onClick={() => fileInputRef.current?.click()} aria-label="Attach"><span>Attach</span> <FaPlus /></button>
                            </div>
                            <input ref={fileInputRef} type="file" multiple style={{ display: "none" }} onChange={onSelectFiles} />
                        </form>
                        {/* --- OFFER FORM SECTION --- */}
                        {isEligibleToSendOffer && canSendOffer && showOfferForm && (
                            <div className="offer-form">
                                <div className="offer-inline-preview">
                                    <div className="preview-item">
                                        <span className="label">Offer Value</span>
                                        <strong>{offerPrice ? formatUSD(offerPrice) : "Set amount"}</strong>
                                    </div>
                                    <div className="preview-item">
                                        <span className="label">Timeline</span>
                                        <strong>{offerTimeline ? `${offerTimeline} day${Number(offerTimeline) > 1 ? "s" : ""}` : "Set timeline"}</strong>
                                    </div>
                                </div>

                                <input value={offerTitle} onChange={(e) => setOfferTitle(e.target.value)} placeholder="Offer title" />

                                <div className="offer-field-row">
                                    <input type="number" min="0" step="0.01" value={offerPrice} onChange={(e) => setOfferPrice(e.target.value)} placeholder="Amount (USD)" />
                                    <input type="number" min="1" value={offerTimeline} onChange={(e) => setOfferTimeline(e.target.value)} placeholder="Timeline (days)" />
                                </div>

                                <textarea value={offerDescription} onChange={(e) => setOfferDescription(e.target.value)} placeholder="Description" />

                                <div className="offer-form-actions">
                                    <button className="btn-send-offer" type="button" onClick={handleCreateOffer}>
                                        Send Offer
                                    </button>
                                    <button className="btn-cancel-offer" type="button" onClick={() => setShowOfferForm(false)}>
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* --- CREATE OFFER TRIGGER BUTTON --- */}
                        {isEligibleToSendOffer && !showOfferForm && (
                            <div className="send-offer-area">
                                <button className="btn-create-offer" onClick={() => setShowOfferForm(true)}>
                                    Create Offer (USD)
                                </button>
                            </div>
                        )}
                    </div> {/* Closes chat-section */}
                </div> {/* Closes chat-body */}
                <div className="modal-footer" />
            </div>
        </div>
    );
};

export default ChatModal;