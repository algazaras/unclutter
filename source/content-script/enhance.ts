import browser from "../common/polyfill";
import { removeToast } from "../overlay/toast";
import { enablePageView } from "./pageview/enablePageView";
import TransitionManager from "./transitions";

// complete extension functionality injected into a tab

// NOTE: NOT A CONTENT SCRIPT. Using browser.runtime after the initial execution loop seems to make Chrome
// think it's a service worker and it terminates the background script on reload.

// listen to events sent from background script
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.event === "ping") {
        // respond that extension is active in this tab
        const pageViewEnabled =
            document.documentElement.classList.contains("pageview");
        sendResponse({ pageViewEnabled });
        return true;
    } else if (message.event === "togglePageView") {
        togglePageView().then((enabledNow) => {
            if (!enabledNow) {
                browser.runtime.sendMessage(null, {
                    event: "disabledPageView",
                    trigger: "extensionIcon",
                    pageHeightPx: document.body.clientHeight,
                });
            }
        });

        return false;
    }
});

const transitions = new TransitionManager();
let disablePageViewHandlers: () => void;
export async function togglePageView() {
    // manually toggle pageview status in this tab

    const alreadyEnabled =
        document.documentElement.classList.contains("pageview");

    if (!alreadyEnabled) {
        // enable pageview
        await transitions.prepare();

        transitions.prepareTransition();

        disablePageViewHandlers = enablePageView(); // trigger earlier
        requestAnimationFrame(() => {
            // reads changed page layout and changes it to be animatable
            transitions.prepareAnimation();
        });

        await new Promise((r) => setTimeout(r, 10));
        transitions.executeAnimation();

        await new Promise((r) => setTimeout(r, 400 - 100));

        await transitions.afterTransitionIn();
        return true;
    } else {
        // disable page view

        // unobserve pageview class removal
        disablePageViewHandlers();

        transitions.transitionOut();
        await new Promise((r) => setTimeout(r, 700));

        transitions.fadeinNoise();
        await new Promise((r) => setTimeout(r, 200));

        transitions.afterTransitionOut();

        return false;
    }
}

// perform style changes if pageview was already triggered by boot.js
async function enhance() {
    const pageViewEnabled =
        document.documentElement.classList.contains("pageview");

    if (!pageViewEnabled) {
        removeToast();
        togglePageView();
    }
}
enhance();
