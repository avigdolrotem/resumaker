import { SignUpForm } from '@/components/auth/sign-up-form';

// The full-page fallback for direct nav / refresh / bookmarks / no-JS
// client-side interception — see AuthModal for the overlay version
// used everywhere sign-up is triggered from inside the app.
export default function SignUpPage() {
  return <SignUpForm />;
}
