// Apply the saved (or system) theme before the first paint. A separate file so the
// Content Security Policy can forbid inline scripts.
try {
  var t = localStorage.getItem('ts-theme');
  if (t !== 'light' && t !== 'dark') t = matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  document.documentElement.className = t;
} catch (e) {}
