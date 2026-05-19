const DEFAULT_API_URL = 'https://mini-instagram-t9bx.onrender.com';

function deriveWsUrl(url) {
  if (url.startsWith('https://')) return `wss://${url.slice('https://'.length)}`;
  if (url.startsWith('http://')) return `ws://${url.slice('http://'.length)}`;
  return 'wss://mini-instagram-t9bx.onrender.com';
}

export const apiUrl = process.env.NEXT_PUBLIC_API_URL || DEFAULT_API_URL;
export const wsUrl = process.env.NEXT_PUBLIC_WS_URL || deriveWsUrl(apiUrl);
