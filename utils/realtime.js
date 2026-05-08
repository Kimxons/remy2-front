const PLATFORM_REALTIME_EVENT = "platform:realtime-update"

const SOUND_MAP = {
    message: "/sounds/notification.mp3",
    notification: "/sounds/notification.mp3",
}

const audioCache = new Map()
const lastPlayedAt = new Map()
const SOUND_COOLDOWN_MS = 1200

export const playPlatformSound = async (kind = "notification") => {
    if (typeof window === "undefined") {
        return false
    }

    const soundKey = SOUND_MAP[kind] ? kind : "notification"
    const now = Date.now()
    const lastPlayed = lastPlayedAt.get(soundKey) || 0

    if (now - lastPlayed < SOUND_COOLDOWN_MS) {
        return false
    }

    const src = SOUND_MAP[soundKey]
    if (!src) {
        return false
    }

    let audio = audioCache.get(soundKey)
    if (!audio) {
        audio = new Audio(src)
        audio.preload = "auto"
        audioCache.set(soundKey, audio)
    }

    try {
        audio.pause()
        audio.currentTime = 0
        lastPlayedAt.set(soundKey, now)
        await audio.play()
        return true
    } catch {
        return false
    }
}

export const emitPlatformRealtimeEvent = (detail = {}) => {
    if (typeof window === "undefined") {
        return
    }

    const eventDetail = {
        timestamp: Date.now(),
        ...detail,
    }

    window.dispatchEvent(new CustomEvent(PLATFORM_REALTIME_EVENT, { detail: eventDetail }))

    if (eventDetail.playSound) {
        void playPlatformSound(eventDetail.sound || "notification")
    }
}

export const subscribeToPlatformRealtime = (handler) => {
    if (typeof window === "undefined") {
        return () => { }
    }

    const listener = (event) => {
        handler(event?.detail || {})
    }

    window.addEventListener(PLATFORM_REALTIME_EVENT, listener)
    return () => {
        window.removeEventListener(PLATFORM_REALTIME_EVENT, listener)
    }
}

export { PLATFORM_REALTIME_EVENT }