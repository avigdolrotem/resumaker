/**
 * Drizzle ORM relational query definitions.
 * Required for db.query.*.findMany({ with: { ... } }) to work.
 */

import { relations } from 'drizzle-orm';
import {
  users,
  companies,
  companyMembers,
  companyInvites,
  jobs,
} from './schema';

export const companiesRelations = relations(companies, ({ many, one }) => ({
  companyMembers: many(companyMembers),
  companyInvites: many(companyInvites),
  owner: one(users, { fields: [companies.ownerUserId], references: [users.id] }),
}));

export const companyMembersRelations = relations(companyMembers, ({ one }) => ({
  company: one(companies, {
    fields: [companyMembers.companyId],
    references: [companies.id],
  }),
  user: one(users, {
    fields: [companyMembers.userId],
    references: [users.id],
  }),
}));

export const companyInvitesRelations = relations(companyInvites, ({ one }) => ({
  company: one(companies, {
    fields: [companyInvites.companyId],
    references: [companies.id],
  }),
}));

export const jobsRelations = relations(jobs, ({ one }) => ({
  company: one(companies, {
    fields: [jobs.companyId],
    references: [companies.id],
  }),
  hrUser: one(users, {
    fields: [jobs.hrUserId],
    references: [users.id],
  }),
}));
