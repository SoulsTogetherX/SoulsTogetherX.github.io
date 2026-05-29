var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
//#region Imports
import { toggleEnvelope, isEnvelopeClosed } from './envelopeHandler.js';
//#endregion
//#region Constants
const PAGE_ENTERING_CLASS_NAME = 'page-is-entering';
const PAGE_EXITING_CLASS_NAME = 'page-is-exiting';
//#endregion
//#region Public Queries
let currentMain = document.querySelector('main');
//#endregion
//#region Public Variables
let busy = false;
let pendingNav = null;
let navSeq = 0;
//#endregion
//#region Public Methods (Checker Helpers)
function isModifierClick(event) {
    return (event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey ||
        event.button !== 0);
}
function isInternalLink(anchor) {
    const url = new URL(anchor.href, location.href);
    return url.origin === location.origin;
}
function waitForAnimation(el) {
    return new Promise((resolve) => {
        el.addEventListener('animationend', () => resolve(), { once: true });
    });
}
//#endregion
//#region Public Methods (Document)
function fetchDocument(url) {
    return __awaiter(this, void 0, void 0, function* () {
        const response = yield fetch(url, { credentials: 'same-origin' });
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        const html = yield response.text();
        return new DOMParser().parseFromString(html, 'text/html');
    });
}
function buildIncomingMain(nextDoc) {
    const next = nextDoc.querySelector('main');
    if (!next) {
        throw new Error('Missing main in fetched page');
    }
    const incoming = document.createElement('main');
    incoming.innerHTML = next.innerHTML;
    incoming.removeAttribute('id');
    if (next.className) {
        incoming.className = next.className;
    }
    return incoming;
}
function transitionMain(nextDoc) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!currentMain) {
            throw new Error('Missing current main');
        }
        const parent = currentMain.parentElement;
        if (!parent) {
            throw new Error('Missing main parent element');
        }
        const incoming = buildIncomingMain(nextDoc);
        parent.insertBefore(incoming, currentMain);
        incoming.classList.add(PAGE_ENTERING_CLASS_NAME);
        currentMain.classList.add(PAGE_EXITING_CLASS_NAME);
        yield waitForAnimation(incoming);
        incoming.classList.remove(PAGE_ENTERING_CLASS_NAME);
        currentMain.remove();
        currentMain = incoming;
    });
}
function forceMain(nextDoc) {
    if (!currentMain) {
        throw new Error('Missing current main');
    }
    const parent = currentMain.parentElement;
    if (!parent) {
        throw new Error('Missing parent element for main');
    }
    const incoming = buildIncomingMain(nextDoc);
    parent.insertBefore(incoming, currentMain.nextSibling);
    currentMain.remove();
    currentMain = incoming;
}
//#endregion
//#region Public Methods (Navigation)
function queueNavigation(url, kind, force) {
    const req = {
        url,
        kind,
        force,
    };
    if (busy) {
        pendingNav = req;
        return;
    }
    runNavigation(req);
}
function runNavigation(req) {
    return __awaiter(this, void 0, void 0, function* () {
        busy = true;
        const mySeq = ++navSeq;
        try {
            const nextDoc = yield fetchDocument(req.url.href);
            if (mySeq !== navSeq)
                return;
            if (req.url.href === location.href) {
                return;
            }
            if (req.force) {
                forceMain(nextDoc);
            }
            else {
                yield transitionMain(nextDoc);
                if (mySeq !== navSeq)
                    return;
            }
            document.title = nextDoc.title || document.title;
            if (req.kind == 'push') {
                history.pushState({}, '', req.url.href);
            }
        }
        catch (err) {
            console.error(err);
            window.location.href = req.url.href;
        }
        finally {
            if (pendingNav) {
                const next = pendingNav;
                pendingNav = null;
                runNavigation(next);
            }
            busy = false;
        }
    });
}
//#endregion
//#region Event Listeners
document.addEventListener('click', (event) => {
    const target = event.target;
    const anchor = target === null || target === void 0 ? void 0 : target.closest('a');
    if (!anchor ||
        !isInternalLink(anchor) ||
        isModifierClick(event)) {
        return;
    }
    event.preventDefault();
    const url = new URL(anchor.href);
    if (url.href === location.href) {
        toggleEnvelope(true);
        return;
    }
    queueNavigation(url, 'push', isEnvelopeClosed());
    toggleEnvelope(true);
}, true);
window.addEventListener('popstate', () => {
    queueNavigation(new URL(location.href), 'pop', isEnvelopeClosed());
});
//#endregion
