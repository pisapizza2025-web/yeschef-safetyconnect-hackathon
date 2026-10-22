import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Yes Chef SafetyConnect (hackathon demo)',
  description: 'Isolated hackathon demo. Demo data only. No production Yes Chef access.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
