export function isLocalFallbackEnabled() {
  if (process.env.ENABLE_LOCAL_FALLBACK === 'true') return true;
  if (process.env.ENABLE_LOCAL_FALLBACK === 'false') return false;
  return process.env.NODE_ENV !== 'production';
}
