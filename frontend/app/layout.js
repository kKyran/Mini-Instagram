import './globals.css';
import { AuthProvider } from '../components/AuthProvider';
import { Topbar } from '../components/Topbar';

export const metadata = {
  title: 'Mini Instagram',
  description: 'A MERN social photo project'
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <div className="shell">
            <Topbar />
            {children}
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}
