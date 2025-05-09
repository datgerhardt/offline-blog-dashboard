# OfflineBlogDashboard


## Development 

Install all packages 

```bash
npm install
```

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.


## IndexedDB (and libraries if applicable)?.
I choose Dexie.js librabry which is a wrapper around IndexedDB because it has ;
- Simplified Promise-Based API
- Schema Definition
- Type Safety

## Lists what works offline and any known limitations.

Post & Comment Viewer

[] Fetch and display a list of posts.

[] On click, view full post and associated comments.

2. Offline Data Support using IndexedDB

[] Store posts, comments, and user data locally.

[] App must work fully offline after initial sync.

[] Ability to view, edit, and create posts/comments while offline.

[] Sync data automatically when connectivity is restored.

3. Post & Comment Creation

[] Allow users to create/edit posts and comments.

[] Offline-created entries must be marked and synced later.

4. Search & Filter
[]Enable filtering posts by title/body and comments by email/postId; all using IndexedDB.

5. Sync Status Indicators
[] Mark new/edited posts/comments with sync status (pending, synced, failed).

6. Conflict Handling (Basic)

[] Gracefully handle duplicate entries or edits if sync fails.
7. Optional Bonus
[] Add a service worker to cache the app shell and assets.

[] Provide optimistic UI for write operations