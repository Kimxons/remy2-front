const DEFAULT_DEV_BACKEND_HOST = '127.0.0.1:8000';
const LOCAL_DEV_HOSTNAMES = new Set(['localhost', '127.0.0.1']);

const stripTrailingApiPath = (value) => value.replace(/\/api\/?$/, '').replace(/\/+$/, '');

const normalizeHost = (value) => stripTrailingApiPath(
    value.replace(/^(wss?:\/\/|https?:\/\/)/, '')
);

const shouldUseDevBackendFallback = (host) => {
    if (typeof window === 'undefined') {
        return false;
    }

    return LOCAL_DEV_HOSTNAMES.has(window.location.hostname) && host === window.location.host;
};

const resolveConfiguredHost = (value) => {
    if (!value) {
        return '';
    }

    try {
        const parsedUrl = value.includes('://')
            ? new URL(value)
            : new URL(value, typeof window !== 'undefined' ? window.location.origin : 'http://localhost');

        if (shouldUseDevBackendFallback(parsedUrl.host)) {
            return DEFAULT_DEV_BACKEND_HOST;
        }

        return normalizeHost(parsedUrl.host);
    } catch {
        const host = normalizeHost(value);
        return shouldUseDevBackendFallback(host) ? DEFAULT_DEV_BACKEND_HOST : host;
    }
};

export const getWebSocketHost = () => {
    const explicitHost = resolveConfiguredHost(process.env.NEXT_PUBLIC_WS_HOST?.trim());
    if (explicitHost) {
        return explicitHost;
    }

    const apiBaseHost = resolveConfiguredHost(process.env.NEXT_PUBLIC_API_BASE_URL?.trim());
    if (apiBaseHost) {
        return apiBaseHost;
    }

    if (typeof window !== 'undefined' && !LOCAL_DEV_HOSTNAMES.has(window.location.hostname)) {
        return window.location.host;
    }

    return DEFAULT_DEV_BACKEND_HOST;
};

export const buildThreadWebSocketUrl = ({ threadId, sessionKey, token }) => {
    const protocol = typeof window !== 'undefined' && window.location.protocol === 'https:'
        ? 'wss:'
        : 'ws:';
    const params = new URLSearchParams();

    if (sessionKey) {
        params.set('session_key', sessionKey);
    } else if (token) {
        params.set('token', token);
    }

    const query = params.toString();
    return `${protocol}//${getWebSocketHost()}/ws/chat/thread/${threadId}/${query ? `?${query}` : ''}`;
};

export const buildNewThreadWebSocketUrl = ({ freelancerId, sessionKey, token }) => {
    const protocol = typeof window !== 'undefined' && window.location.protocol === 'https:'
        ? 'wss:'
        : 'ws:';
    const params = new URLSearchParams();

    if (sessionKey) {
        params.set('session_key', sessionKey);
    } else if (token) {
        params.set('token', token);
    }

    const query = params.toString();
    return `${protocol}//${getWebSocketHost()}/ws/chat/new/${freelancerId}/${query ? `?${query}` : ''}`;
};