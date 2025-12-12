import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || '2eieo2mne';
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://kartikeywariyal:kartik%4012345@cluster0.envmfus.mongodb.net/fireshare?retryWrites=true&w=majority';

// Middleware - CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    const allowedOrigins = ['http://localhost:5173', 'http://localhost:3000', 'http://localhost:5174', 'http://localhost:5175', 'http://127.0.0.1:5173'];
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(null, true);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  preflightContinue: false,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(express.json({ limit: '16mb' }));

// MongoDB Connection
mongoose.connect(MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// MongoDB Schemas
const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  name: { type: String, required: true }
}, { timestamps: true });

const fileSchema = new mongoose.Schema({
  uniqueId: { type: String, required: true, unique: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  originalName: { type: String, required: true },
  size: { type: Number, required: true },
  mimetype: { type: String, required: true },
  fileData: { type: Buffer, required: true },
  openToAll: { type: Boolean, default: false },
  allowedEmails: [{ type: String }],
  uploadDate: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);
const File = mongoose.model('File', fileSchema);

// Multer configuration - store in memory as buffer
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 16 * 1024 * 1024 } // 16MB limit
});

// JWT Authentication Middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

// Optional authentication - for public file access
const optionalAuth = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token) {
    jwt.verify(token, JWT_SECRET, (err, user) => {
      if (!err) {
        req.user = user;
      }
    });
  }
  next();
};

// Routes

// Sign Up
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = await User.create({
      email,
      password: hashedPassword,
      name
    });

    // Generate JWT token
    const token = jwt.sign(
      { id: user._id.toString(), email: user.email },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      message: 'User created successfully',
      token,
      user: { id: user._id.toString(), email: user.email, name: user.name }
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Sign In
app.post('/api/auth/signin', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { id: user._id.toString(), email: user.email },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Sign in successful',
      token,
      user: { id: user._id.toString(), email: user.email, name: user.name }
    });
  } catch (error) {
    console.error('Signin error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get user files
app.get('/api/files', authenticateToken, async (req, res) => {
  try {
    const userFiles = await File.find({ userId: req.user.id })
      .select('-fileData') // Don't send file data in list
      .sort({ uploadDate: -1 });
    res.json(userFiles);
  } catch (error) {
    console.error('Get files error:', error);
    res.status(500).json({ error: 'Failed to fetch files' });
  }
});

// Upload file
app.post('/api/files/upload', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { openToAll, allowedEmails } = req.body;
    const uniqueId = uuidv4();

    // Parse allowedEmails if it's a string
    let emailsArray = [];
    if (allowedEmails) {
      if (typeof allowedEmails === 'string') {
        emailsArray = allowedEmails.split(',').map(email => email.trim()).filter(email => email);
      } else if (Array.isArray(allowedEmails)) {
        emailsArray = allowedEmails;
      }
    }

    const fileData = await File.create({
      uniqueId,
      userId: req.user.id,
      originalName: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype,
      fileData: req.file.buffer,
      openToAll: openToAll === 'true' || openToAll === true,
      allowedEmails: emailsArray,
      uploadDate: new Date()
    });

    res.status(201).json({
      message: 'File uploaded successfully',
      file: {
        id: fileData._id.toString(),
        uniqueId: fileData.uniqueId,
        originalName: fileData.originalName,
        size: fileData.size,
        mimetype: fileData.mimetype,
        uploadDate: fileData.uploadDate,
        openToAll: fileData.openToAll,
        allowedEmails: fileData.allowedEmails
      }
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'File upload failed' });
  }
});

// Download file by ID (for owner)
app.get('/api/files/:id/download', authenticateToken, async (req, res) => {
  try {
    const file = await File.findById(req.params.id);

    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Check if user is the owner
    if (file.userId.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.setHeader('Content-Type', file.mimetype);
    res.setHeader('Content-Disposition', `attachment; filename="${file.originalName}"`);
    res.send(file.fileData);
  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({ error: 'Download failed' });
  }
});

// Download file by unique ID (for sharing)
app.get('/api/files/share/:uniqueId', optionalAuth, async (req, res) => {
  try {
    const file = await File.findOne({ uniqueId: req.params.uniqueId });

    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Check access permissions
    const hasAccess = file.openToAll || 
                      (req.user && file.userId.toString() === req.user.id) ||
                      (req.user && file.allowedEmails.includes(req.user.email));

    if (!hasAccess) {
      return res.status(403).json({ 
        error: 'Access denied',
        message: 'You do not have permission to access this file. Please contact the file owner for access.'
      });
    }

    res.setHeader('Content-Type', file.mimetype);
    res.setHeader('Content-Disposition', `attachment; filename="${file.originalName}"`);
    res.send(file.fileData);
  } catch (error) {
    console.error('Share download error:', error);
    res.status(500).json({ error: 'Download failed' });
  }
});

// Get file info by unique ID (for sharing page)
app.get('/api/files/share/:uniqueId/info', optionalAuth, async (req, res) => {
  try {
    const file = await File.findOne({ uniqueId: req.params.uniqueId })
      .select('-fileData');

    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Check access permissions
    const hasAccess = file.openToAll || 
                      (req.user && file.userId.toString() === req.user.id) ||
                      (req.user && file.allowedEmails.includes(req.user.email));

    if (!hasAccess) {
      return res.status(403).json({ 
        error: 'Access denied',
        message: 'You do not have permission to access this file. Please contact the file owner for access.'
      });
    }

    res.json({
      id: file._id.toString(),
      uniqueId: file.uniqueId,
      originalName: file.originalName,
      size: file.size,
      mimetype: file.mimetype,
      uploadDate: file.uploadDate,
      openToAll: file.openToAll
    });
  } catch (error) {
    console.error('Get file info error:', error);
    res.status(500).json({ error: 'Failed to get file info' });
  }
});

// Delete file
app.delete('/api/files/:id', authenticateToken, async (req, res) => {
  try {
    const file = await File.findById(req.params.id);

    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    if (file.userId.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await File.findByIdAndDelete(req.params.id);

    res.json({ message: 'File deleted successfully' });
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ error: 'Delete failed' });
  }
});

// Update file access settings
app.put('/api/files/:id/access', authenticateToken, async (req, res) => {
  try {
    const { openToAll, allowedEmails } = req.body;
    const file = await File.findById(req.params.id);

    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    if (file.userId.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    let emailsArray = [];
    if (allowedEmails) {
      if (typeof allowedEmails === 'string') {
        emailsArray = allowedEmails.split(',').map(email => email.trim()).filter(email => email);
      } else if (Array.isArray(allowedEmails)) {
        emailsArray = allowedEmails;
      }
    }

    file.openToAll = openToAll === true || openToAll === 'true';
    file.allowedEmails = emailsArray;
    await file.save();

    res.json({
      message: 'Access settings updated',
      file: {
        id: file._id.toString(),
        uniqueId: file.uniqueId,
        openToAll: file.openToAll,
        allowedEmails: file.allowedEmails
      }
    });
  } catch (error) {
    console.error('Update access error:', error);
    res.status(500).json({ error: 'Failed to update access settings' });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
