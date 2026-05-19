function isDatabaseError(error) {
  return [
    'MongoServerSelectionError',
    'MongoNetworkError',
    'MongooseError'
  ].includes(error?.name) || ['ENOTFOUND', 'ECONNRESET', 'ETIMEDOUT'].includes(error?.code);
}

export function errorHandler(error, _req, res, _next) {
  if (isDatabaseError(error)) {
    return res.status(503).json({
      message: 'Database connection is unavailable. Check your internet, DNS, or MongoDB Atlas network access.'
    });
  }

  console.error(error);
  return res.status(500).json({ message: 'Internal server error' });
}
