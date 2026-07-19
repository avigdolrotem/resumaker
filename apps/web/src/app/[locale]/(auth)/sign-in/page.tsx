import { SignInForm } from '@/components/auth/sign-in-form';

// The full-page fallback for direct nav / refresh / bookmarks / no-JS
// client-side interception — see AuthModal for the overlay version
// used everywhere sign-in is triggered from inside the app.
export default function SignInPage() {
  return <SignInForm />;
}
