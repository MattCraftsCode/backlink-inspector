import { classifyPageAccess } from '../core/page-access';
import type { BackgroundRequest, BackgroundResponse, ContentRequest } from '../shared/messages';

const pingContentScript = async (tabId: number) => {
  const response = await chrome.tabs.sendMessage<ContentRequest, { ok: boolean }>(tabId, { type: 'PING' });
  return response?.ok === true;
};

const injectContentScript = async (tabId: number) => {
  try {
    if (await pingContentScript(tabId)) return;
  } catch {
    // The scanner has not been injected into this page yet.
  }

  await chrome.scripting.executeScript({
    target: { tabId },
    files: ['content-scripts/content.js'],
  });

  if (!(await pingContentScript(tabId))) {
    throw new Error('The page scanner did not start.');
  }
};

export default defineBackground(() => {
  // Handle the toolbar click ourselves so activeTab is used while the user gesture is active.
  void chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false });

  chrome.action.onClicked.addListener((tab) => {
    if (!tab.id) return;

    void chrome.sidePanel.open({ tabId: tab.id });

    const pageAccess = classifyPageAccess(tab.url);
    if (pageAccess.kind === 'restricted') return;
    void injectContentScript(tab.id).catch(() => undefined);
  });

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
          await injectContentScript(message.tabId);
          return { ok: true };
        } catch (error) {
          const messageText = error instanceof Error ? error.message : String(error);
          const permissionError = /permission|Cannot access contents|host/i.test(messageText);
          return {
            ok: false,
            code: permissionError ? 'PERMISSION_REQUIRED' : 'INJECTION_FAILED',
            message: permissionError
              ? 'The scanner cannot access this tab. Use a normal HTTP or HTTPS page, reload the extension, and refresh the page.'
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
