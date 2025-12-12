# Backend Setup Guide

## Environment Variables Setup

1. Copy the example environment file:
```bash
cp env.example .env
```

2. Edit the `.env` file and add your configuration:

```env
PORT=3001
JWT_SECRET=your-strong-secret-key-here-change-this-in-production
MONGODB_URI=your-mongodb-connection-string-here
```

### Important Notes:

- **JWT_SECRET**: Use a strong, randomly generated string. You can generate one using:
  ```bash
  node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
  ```

- **MONGODB_URI**: Your MongoDB Atlas connection string or local MongoDB URI
  - Format: `mongodb+srv://username:password@cluster.mongodb.net/database?retryWrites=true&w=majority`
  - Make sure to URL-encode special characters in your password (e.g., `@` becomes `%40`)

- The `.env` file is already in `.gitignore` and will NOT be committed to GitHub

## Running the Server

```bash
npm install
npm start
```

For development with auto-reload:
```bash
npm run dev
```

