# OfflineBlogDashboard



# 🚀 Getting Started

## Development

Follow these steps to install dependencies and run the app locally.

## 🧩 Install Dependencies

Make sure you have **Node.js** and **npm** installed. You can check by running:

```bash
node -v
npm -v
```
Install all packages 

```bash
npm install
```

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.


## IndexedDB 
I chose Dexie.js, a wrapper around IndexedDB, because it offers a simplified promise-based API, easy schema definition, and strong type safety.

## ✅ What Works Offline and Known Limitations

### 📄 Post & Comment Viewer
- [x] Fetch and display a list of posts.
- [x] On click, view full post and associated comments.

### 💾 Offline Data Support using IndexedDB
- [x] Store posts, comments, and user data locally.
- [ ] App must work fully offline after initial sync.
- [x] Ability to view, edit, and create posts/comments while offline.
- [ ] Sync data automatically when connectivity is restored.

### ✍️ Post & Comment Creation
- [ ] Allow users to create/edit posts and comments.
- [ ] Offline-created entries must be marked and synced later.
There are done as service and not add to ui

### 🔍 Search & Filter
- [ ] Enable filtering posts by title/body and comments by email/postId using IndexedDB.
There are done as service and not add to ui

### 🔄 Sync Status Indicators
- [ ] Mark new/edited posts/comments with sync status (pending, synced, failed).

### ⚠️ Conflict Handling (Basic)
- [x] Gracefully handle duplicate entries or edits if sync fails.

### 🌟 Optional Bonus
- [ ] Add a service worker to cache the app shell and assets.
- [ ] Provide optimistic UI for write operations.

### Limitations 
- [ ] `windows API` and `navigator.onLine`  these API for has been issue to access for possible result 
