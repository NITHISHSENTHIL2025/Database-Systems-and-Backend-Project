export function validate(schema, source = 'body') {
  return (req, res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      return res.status(400).json({
        message: result.error.issues[0]?.message || 'Invalid request.',
        issues: result.error.issues.map(i => ({ path: i.path.join('.'), message: i.message }))
      });
    }
    req[source] = result.data;
    next();
  };
}
