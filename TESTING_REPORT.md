# Testing Report

Run all tests with:

```bash
npm test
```

## Test Cases

1. User model rejects invalid email.
2. User model hashes password before save.
3. `signToken` utility returns a JWT with the expected subject.
4. Auth route handler registers a new user.
5. Protected `/api/auth/me` rejects missing token.
6. Protected `/api/auth/me` returns the authenticated user.
7. Post creation endpoint creates an owned post.
8. Search endpoint filters posts by text.
9. Post fallback saves a local post when enabled and database creation times out.
10. Local posts support likes and comments.
11. Local post likes/comments create notifications.
12. Stale local post IDs return safe responses instead of server errors.
13. Story endpoint creates and lists active stories.
14. Story listing returns a safe payload when lookup fails.
15. Local stories support like/unlike when fallback is enabled.
16. Local story likes create notifications.
17. Stale local story IDs return safe responses.
18. Message conversations include following/follower contacts.
19. Message unread sender counts are marked read when a thread is opened.
20. `AuthProvider` renders children and default guest state.
21. `PostCard` renders caption, author, tags, and comment count.
22. Frontend component tests run in jsdom with React Testing Library.

## Latest Passing Output

```text
Backend: 6 test suites passed, 19 tests passed.
Frontend: 2 test suites passed, 3 tests passed.
Total: 8 test suites passed, 22 tests passed.
```

## Passing Output Screenshot

Add a screenshot of the passing Jest output before submission.
