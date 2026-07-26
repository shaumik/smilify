import type { Metadata } from 'next';
import { getConfig } from '@/lib/config';
import './globals.css';

const config = getConfig();

export const metadata: Metadata = {
  title: { default: config.name, template: `%s - ${config.name}` },
  description: config.description,
  icons: { icon: '/logo.svg' },
};

// Set the theme before first paint to avoid a flash of the wrong mode.
const themeScript = `
(function () {
  try {
    var stored = localStorage.getItem('smilify-theme');
    var theme = stored || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    document.documentElement.dataset.theme = theme;
  } catch (e) {}
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const { colors } = config;
  const cssVars = `:root{--primary:${colors.primary};--primary-light:${colors.light ?? colors.primary};--primary-dark:${colors.dark ?? colors.primary};}`;
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <style dangerouslySetInnerHTML={{ __html: cssVars }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
