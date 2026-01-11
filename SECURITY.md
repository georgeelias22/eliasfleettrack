# Security Guidelines

## Authentication & Authorization Architecture

This application uses a **defense-in-depth** security model:

### Backend Protection (Primary Security Layer)

1. **Row-Level Security (RLS)** - All database tables have RLS enabled with policies that verify `auth.uid()` matches `user_id`
2. **Edge Functions** - All serverless functions validate authentication via Authorization headers
3. **Admin Functions** - Validate both authentication AND admin role via `has_role()` database function
4. **Storage** - Bucket policies use folder-based isolation with `auth.uid()::text`

### Frontend Checks (UX Layer Only)

Frontend authentication checks (via `useAuth` hook) are for **user experience only**:
- Prevent unnecessary API calls when user is not logged in
- Show appropriate loading/redirect states
- These can be bypassed and do NOT provide security

## Security Checklist for New Features

### Database Changes
- [ ] RLS enabled on new tables (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY`)
- [ ] RLS policies added for SELECT/INSERT/UPDATE/DELETE operations
- [ ] Policies use `auth.uid()` to verify user ownership
- [ ] Foreign keys reference `user_id` where applicable

### Edge Functions
- [ ] Validate Authorization header at start of function
- [ ] Use `supabase.auth.getUser(token)` to verify JWT
- [ ] Return 401 for missing/invalid authentication
- [ ] For admin functions, verify role with `has_role()` RPC

### Storage Buckets
- [ ] Create appropriate bucket policies
- [ ] Use folder-based isolation: `auth.uid()::text = (storage.foldername(name))[1]`

## Testing Security

Always test with direct API calls, not just the UI:

```bash
# Test without auth (should fail)
curl -X GET "https://PROJECT_ID.supabase.co/rest/v1/vehicles" \
  -H "apikey: ANON_KEY"

# Test with auth (should succeed for user's own data)
curl -X GET "https://PROJECT_ID.supabase.co/rest/v1/vehicles" \
  -H "apikey: ANON_KEY" \
  -H "Authorization: Bearer USER_JWT"
```

## Role-Based Access Control

Roles are stored in the `user_roles` table (never in profiles/users to prevent privilege escalation).

Use the `has_role()` function to check roles in RLS policies:
```sql
CREATE POLICY "Admins can view all" ON some_table
FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
```

## Common Security Pitfalls to Avoid

1. ❌ Storing roles in user-editable tables (profiles)
2. ❌ Checking admin status via localStorage/client storage
3. ❌ Trusting client-supplied authorization data
4. ❌ Skipping RLS policies on "internal" tables
5. ❌ Using `SECURITY DEFINER` functions without `SET search_path`
