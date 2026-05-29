//#region Constant Values
const ACTIVE_ENVELOPE_CLASSNAME = 'active-envelope';
//#endregion
//#region Constant Queries
const ENVELOPE_BG = document.getElementById('envelope-bg');
const ENVELOPE = document.getElementById('envelope');
//#endregion
//#region Listeners
ENVELOPE_BG === null || ENVELOPE_BG === void 0 ? void 0 : ENVELOPE_BG.addEventListener('click', (_) => {
    toggleEnvelope(false);
});
ENVELOPE === null || ENVELOPE === void 0 ? void 0 : ENVELOPE.addEventListener('click', (_) => {
    toggleEnvelope(true);
});
//#endregion
//#region Exported Methods
export function toggleEnvelope(toggle) {
    if (!ENVELOPE) {
        return;
    }
    if (toggle) {
        ENVELOPE.classList.add(ACTIVE_ENVELOPE_CLASSNAME);
        return;
    }
    ENVELOPE.classList.remove(ACTIVE_ENVELOPE_CLASSNAME);
}
export function isEnvelopeClosed() {
    if (!ENVELOPE) {
        return true;
    }
    return !ENVELOPE.classList.contains(ACTIVE_ENVELOPE_CLASSNAME);
}
//#endregion
