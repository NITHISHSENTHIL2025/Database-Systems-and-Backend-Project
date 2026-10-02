export function notFound(req, res) {
  res.status(404).json({ message: 'Route not found.' });
}

export function errorHandler(err, req, res, next) {
  const status = Number(err.status) || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({
    message: status >= 500 ? 'Something went wrong on the server.' : err.message,
    ...(status < 500 && err.details ? { details: err.details } : {})
  });
}
