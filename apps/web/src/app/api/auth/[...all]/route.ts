/**
 * Better Auth API routes.
 *
 * Catches all /api/auth/* paths.
 */

import { toNextJsHandler } from 'better-auth/next-js';
import { auth } from '@/lib/auth';

export const { POST, GET } = toNextJsHandler(auth);
