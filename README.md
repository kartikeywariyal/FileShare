# FireShare - File Sharing Dashboard

A beautiful, modern file sharing application with JWT authentication built with React.js and Express.js.

## Features

- 🔐 **JWT Authentication** - Secure signup and signin
- 📁 **File Upload** - Upload files up to 16MB (stored in MongoDB as binary data)
- 📥 **File Download** - Download your uploaded files
- 🗑️ **File Management** - Delete files you no longer need
- 🔗 **Shareable Links** - Share files with unique IDs
- 🔒 **Access Control** - Control who can access your files (public or email-based)
- 🎨 **Modern UI** - Beautiful, responsive design with gradient themes and glassmorphism
- 💾 **MongoDB Storage** - Files stored as binary data in MongoDB

## Tech Stack

### Frontend
- React.js
- Vite
- CSS3 (Modern styling with gradients, animations, and glassmorphism)

### Backend
- Express.js
- MongoDB (with Mongoose)
- JSON Web Tokens (JWT)
- bcryptjs (Password hashing)
- Multer (File upload handling)

## Setup Instructions

### Prerequisites
- Node.js (v14 or higher)
- npm or yarn
- MongoDB Atlas account (or local MongoDB instance)

### Backend Setup

1. Navigate to the backend directory:
```bash
cd backend
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the backend directory:
```bash
cp env.example .env
```

4. Update the `.env` file with your configuration:
```env
PORT=3001
JWT_SECRET=your-strong-secret-key-here
MONGODB_URI=your-mongodb-connection-string
```

5. Start the backend server:
```bash
npm start
```

The backend server will run on `http://localhost:3001`

### Frontend Setup

1. Navigate to the frontend directory:
```bash
cd my-vite-app
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

The frontend will run on `http://localhost:5173` (or another port if 5173 is busy)

## Usage

1. **Sign Up**: Create a new account with your name, email, and password
2. **Sign In**: Login with your credentials
3. **Upload Files**: Click "Choose File to Upload" to select and upload files (max 16MB)
4. **Set Access Control**: Choose if file is open to all or specify allowed emails
5. **Share Files**: Copy the unique ID and share it with others
6. **Download Files**: Use the download button or enter a unique ID in "Download File by ID"
7. **Manage Access**: Edit access settings for your files anytime

## Project Structure

```
FileShare/
├── backend/
│   ├── server.js          # Express server with API endpoints
│   ├── package.json       # Backend dependencies
│   ├── .env               # Environment variables (not in git)
│   ├── env.example        # Example environment variables
│   └── .gitignore         # Git ignore file
│
└── my-vite-app/
    ├── src/
    │   ├── components/
    │   │   ├── SignUp.jsx      # Sign up component
    │   │   ├── SignIn.jsx      # Sign in component
    │   │   ├── Dashboard.jsx  # Main dashboard component
    │   │   ├── SharePage.jsx # Share page component
    │   │   ├── Auth.css       # Authentication styles
    │   │   ├── Dashboard.css  # Dashboard styles
    │   │   └── SharePage.css  # Share page styles
    │   ├── App.jsx             # Main app component
    │   ├── App.css             # App styles
    │   ├── index.css           # Global styles
    │   └── main.jsx            # Entry point
    ├── package.json            # Frontend dependencies
    └── .gitignore              # Git ignore file
```

## API Endpoints

### Authentication
- `POST /api/auth/signup` - Create a new account
- `POST /api/auth/signin` - Sign in to existing account

### Files
- `GET /api/files` - Get all user's files (requires authentication)
- `POST /api/files/upload` - Upload a file (requires authentication)
- `GET /api/files/:id/download` - Download a file by ID (requires authentication)
- `GET /api/files/share/:uniqueId` - Download a file by unique ID (public/shared)
- `GET /api/files/share/:uniqueId/info` - Get file info by unique ID
- `PUT /api/files/:id/access` - Update file access settings (requires authentication)
- `DELETE /api/files/:id` - Delete a file (requires authentication)

## Environment Variables

### Backend (.env)
- `PORT` - Server port (default: 3001)
- `JWT_SECRET` - Secret key for JWT tokens
- `MONGODB_URI` - MongoDB connection string

## Security Considerations

For production use, consider:
- Using a strong, randomly generated JWT_SECRET
- Storing MongoDB credentials securely
- Adding rate limiting
- Implementing file type validation
- Adding HTTPS
- Using environment variables for all sensitive data
- Regularly updating dependencies

## File Storage

Files are stored in MongoDB as binary data (Buffer) with a maximum size of 16MB per file. For larger files, consider using MongoDB GridFS.

## License

This project is open source and available for personal and commercial use.
