export function getAllowedOrigins(clientUrl?: string): (string | RegExp)[] {
  const defaults: (string | RegExp)[] = [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost',
    'http://localhost:80',
    'http://127.0.0.1',
    'http://127.0.0.1:80',
    /\.vercel\.app$/
  ];

  if (process.env.VERCEL_URL) {
    defaults.push(`https://${process.env.VERCEL_URL}`);
  }

  if (!clientUrl) {
    return defaults;
  }

  const userOrigins = clientUrl
    .split(',')
    .map(url => url.trim())
    .filter(Boolean)
    .flatMap(url => {
      const stripped = url.replace(/\/+$/, '');
      return [url, stripped];
    });

  return Array.from(new Set([...defaults, ...userOrigins]));
}
