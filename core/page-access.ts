export type PageAccess =
  | { kind: 'inspectable' }
  | { kind: 'unknown' }
  | { kind: 'restricted'; message: string };

const INTERNAL_PROTOCOLS = new Set([
  'chrome:',
  'chrome-extension:',
  'devtools:',
  'edge:',
  'about:',
  'view-source:',
]);

export const classifyPageAccess = (value?: string): PageAccess => {
  if (!value) return { kind: 'unknown' };

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return {
      kind: 'restricted',
      message: 'This page URL is not supported. Open a normal HTTP or HTTPS page and try again.',
    };
  }

  if (url.hostname === 'chromewebstore.google.com') {
    return {
      kind: 'restricted',
      message: 'Chrome Web Store pages cannot be inspected by extensions. Open a normal website and try again.',
    };
  }

  if (INTERNAL_PROTOCOLS.has(url.protocol)) {
    return {
      kind: 'restricted',
      message: `This is a Chrome internal page (${url.protocol}//). Extensions cannot inject scanners here. Open an HTTP or HTTPS page and try again.`,
    };
  }

  if (url.protocol === 'file:') {
    return {
      kind: 'restricted',
      message: 'Local file pages are not enabled. Open an HTTP or HTTPS page and try again.',
    };
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return {
      kind: 'restricted',
      message: `Pages using the ${url.protocol} protocol cannot be inspected. Open an HTTP or HTTPS page and try again.`,
    };
  }

  return { kind: 'inspectable' };
};
