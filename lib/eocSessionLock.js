const SESSION_LOCK_KEY = 'stn-eoc:operation-session-lock';

function canUseStorage() {
    return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

export function getOperationSessionLock() {
    if (!canUseStorage()) return null;

    try {
        const raw = window.localStorage.getItem(SESSION_LOCK_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed || !parsed.moduleType || !parsed.sessionId) return null;
        return parsed;
    } catch (error) {
        console.error('Failed to parse operation session lock:', error);
        return null;
    }
}

export function getOperationSessionLockByType(moduleType) {
    const lock = getOperationSessionLock();
    if (!lock) return null;
    if (lock.moduleType !== moduleType) return null;
    return lock;
}

export function setOperationSessionLock(payload) {
    if (!canUseStorage()) return;

    const lockPayload = {
        moduleType: payload.moduleType,
        sessionId: Number(payload.sessionId),
        sessionNumber: payload.sessionNumber || null,
        sessionStatus: payload.sessionStatus || null,
        sessionOpenedAt: payload.sessionOpenedAt || null,
        lockedAt: new Date().toISOString()
    };

    window.localStorage.setItem(SESSION_LOCK_KEY, JSON.stringify(lockPayload));
}

export function clearOperationSessionLock(moduleType) {
    if (!canUseStorage()) return;

    if (!moduleType) {
        window.localStorage.removeItem(SESSION_LOCK_KEY);
        return;
    }

    const lock = getOperationSessionLock();
    if (lock?.moduleType === moduleType) {
        window.localStorage.removeItem(SESSION_LOCK_KEY);
    }
}
