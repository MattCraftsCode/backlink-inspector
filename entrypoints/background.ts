import { classifyPageAccess } from '../core/page-access';
import type { BackgroundRequest, BackgroundResponse, ContentRequest } from '../shared/messages';

const pingContentScript = async (tabId: number) => {
  const response = await chrome.tabs.sendMessage<ContentRequest, { ok: boolean }>(tabId, { type: 'PING' });
  return response?.ok === true;
};

export default defineBackground(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => undefined);

  chrome.runtime.onMessage.addListener((message: BackgroundRequest, _sender, sendResponse) => {
    const handle = async (): Promise<BackgroundResponse> => {
      if (message.type === 'GET_ACTIVE_TAB') {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        return tab ? { ok: true, tab } : { ok: false, code: 'NO_TAB', message: 'No active tab is available.' };
      }

      if (message.type === 'ENSURE_CONTENT_SCRIPT') {
        const tab = await chrome.tabs.get(message.tabId);
        const pageAccess = classifyPageAccess(tab.url);
        if (pageAccess.kind === 'restricted') {
          return { ok: false, code: 'RESTRICTED_PAGE', message: pageAccess.message };
        }

        try {
          if (await pingContentScript(message.tabId)) return { ok: true };
        } catch {
          // Continue with a one-time programmatic injection.
        }

        try {
          await chrome.scripting.executeScript({
            target: { tabId: message.tabId },
            files: ['content-scripts/content.js'],
          });
          return (await pingContentScript(message.tabId))
            ? { ok: true }
            : { ok: false, code: 'INJECTION_FAILED', message: 'The page scanner did not start.' };
        } catch (error) {
          const messageText = error instanceof Error ? error.message : String(error);
          const permissionError = /permission|Cannot access contents|host/i.test(messageText);
          return {
            ok: false,
            code: permissionError ? 'PERMISSION_REQUIRED' : 'INJECTION_FAILED',
            message: permissionError
              ? 'This tab has not granted page access. Keep the page active, click the Backlink Inspector toolbar icon, and scan again.'
              : messageText,
          };
        }
      }

      return { ok: false, code: 'INJECTION_FAILED', message: 'Unsupported background request.' };
    };

    void handle().then(sendResponse).catch((error: unknown) => {
      sendResponse({
        ok: false,
        code: 'INJECTION_FAILED',
        message: error instanceof Error ? error.message : String(error),
      } satisfies BackgroundResponse);
    });
    return true;
  });
});
