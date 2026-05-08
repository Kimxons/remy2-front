const DEFAULT_DEV_BACKEND_PORT = '8000';
const LOCAL_DEV_HOSTNAMES = new Set(['localhost', '127.0.0.1']);

const buildLocalDevBackendHost = (port = DEFAULT_DEV_BACKEND_PORT) => {
    if (typeof window === 'undefined') {
        return `127.0.0.1:${port}`;
    }

    return `${window.location.hostname}:${port}`;
};

const stripTrailingApiPath = (value) => value.replace(/\/api\/?$/, '').replace(/\/+$/, '');

const normalizeHost = (value) => stripTrailingApiPath(
    value.replace(/^(wss?:\/\/|https?:\/\/)/, '')
);

const shouldUseDevBackendFallback = (hostname) => {
    if (typeof window === 'undefined') {
        return false;
    }

    return LOCAL_DEV_HOSTNAMES.has(window.location.hostname) && LOCAL_DEV_HOSTNAMES.has(hostname);
};

const resolveConfiguredHost = (value) => {
    if (!value) {
        return '';
    }

    try {
        const parsedUrl = value.includes('://')
            ? new URL(value)
            : new URL(value, typeof window !== 'undefined' ? window.location.origin : 'http://localhost');

        if (shouldUseDevBackendFallback(parsedUrl.hostname)) {
            return buildLocalDevBackendHost(parsedUrl.port || DEFAULT_DEV_BACKEND_PORT);
        }

        return normalizeHost(parsedUrl.host);
    } catch {
        const host = normalizeHost(value);
        const [hostname, port] = host.split(':');
        return shouldUseDevBackendFallback(hostname)
            ? buildLocalDevBackendHost(port || DEFAULT_DEV_BACKEND_PORT)
            : host;
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

    return buildLocalDevBackendHost();
};

export const buildThreadWebSocketUrl = ({ threadId, token }) => {
    const protocol = typeof window !== 'undefined' && window.location.protocol === 'https:'
        ? 'wss:'
        : 'ws:';
    const params = new URLSearchParams();

    if (token) {
        params.set('token', token);
    }

    const query = params.toString();
    return `${protocol}//${getWebSocketHost()}/ws/chat/thread/${threadId}/${query ? `?${query}` : ''}`;
};

export const buildNewThreadWebSocketUrl = ({ freelancerId, token }) => {
    const protocol = typeof window !== 'undefined' && window.location.protocol === 'https:'
        ? 'wss:'
        : 'ws:';
    const params = new URLSearchParams();

    if (token) {
        params.set('token', token);
    }

    const query = params.toString();
    return `${protocol}//${getWebSocketHost()}/ws/chat/new/${freelancerId}/${query ? `?${query}` : ''}`;
};