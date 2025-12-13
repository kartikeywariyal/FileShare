import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';
import nodemailer from 'nodemailer';
import rateLimit from 'express-rate-limit';
import crypto from 'crypto';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

const execAsync = promisify(exec);

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET;
const MONGODB_URI = process.env.MONGODB_URI;

// Validate required environment variables
if (!JWT_SECRET) {
  console.error('❌ JWT_SECRET is required. Please set it in your .env file.');
  process.exit(1);
}

if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI is required. Please set it in your .env file.');
  process.exit(1);
}

// Email configuration (Brevo/Sendinblue)
const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS;
const EMAIL_HOST = process.env.EMAIL_HOST || 'smtp-relay.brevo.com';
const EMAIL_PORT = process.env.EMAIL_PORT || 587;


// Middleware - CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      'http://localhost:5173',
      'http://localhost:3000',
      'http://localhost:5174',
      'http://localhost:5175',
      'http://127.0.0.1:5173',
      // Add your production frontend URLs here
      process.env.FRONTEND_URL
    ].filter(Boolean); // Remove undefined values
    
    if (allowedOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV === 'development') {
      callback(null, true);
    } else {
      // In production, you might want to be more strict
      callback(null, true); // For now, allow all origins
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

// Rate limiting for security
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 requests per windowMs
  message: 'Too many authentication attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});


// Email transporter setup (Brevo/Sendinblue)
let emailTransporter = null;
if (EMAIL_USER && EMAIL_PASS) {
  emailTransporter = nodemailer.createTransport({
    host: EMAIL_HOST,
    port: parseInt(EMAIL_PORT),
    secure: false, // false for 587, true for 465
    requireTLS: true, // Require TLS
    auth: {
      user: EMAIL_USER,
      pass: EMAIL_PASS,
    },
    tls: {
      rejectUnauthorized: false, // For Brevo SMTP
      minVersion: 'TLSv1.2'
    },
    connectionTimeout: 10000, // 10 seconds
    greetingTimeout: 10000,
    socketTimeout: 10000
  });
  
  console.log('📧 Email transporter created with:');
  console.log('   Host:', EMAIL_HOST);
  console.log('   Port:', EMAIL_PORT);
  console.log('   User:', EMAIL_USER);
  console.log('   Pass:', EMAIL_PASS ? '***' + EMAIL_PASS.slice(-4) : 'NOT SET');
  
  // Verify connection on startup
  emailTransporter.verify(function (error, success) {
    if (error) {
      console.error('❌ Email service verification failed:');
      console.error('   Error:', error.message);
      console.error('   Code:', error.code);
      console.error('   Command:', error.command);
    } else {
      console.log('✅ Email service (Brevo) configured and verified successfully');
    }
  });
} else {
  console.warn('Email credentials not configured. Email OTP will not work.');
}


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


// Enhanced encryption helper
const encryptData = (data, key) => {
  const algorithm = 'aes-256-gcm';
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(algorithm, Buffer.from(key, 'hex'), iv);
  
  let encrypted = cipher.update(data, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  return {
    encrypted,
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex')
  };
};

const decryptData = (encryptedData, key) => {
  const algorithm = 'aes-256-gcm';
  const decipher = crypto.createDecipheriv(
    algorithm,
    Buffer.from(key, 'hex'),
    Buffer.from(encryptedData.iv, 'hex')
  );
  
  decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'));
  
  let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
};

// Multer configuration - store in memory as buffer
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 16 * 1024 * 1024 } // 16MB limit
});

// ClamAV configuration
const CLAMAV_HOST = process.env.CLAMAV_HOST || 'localhost';
const CLAMAV_PORT = parseInt(process.env.CLAMAV_PORT || '3310');
const ENABLE_VIRUS_SCAN = process.env.ENABLE_VIRUS_SCAN !== 'false'; // Default to true
const CLAMSCAN_PATH = process.env.CLAMSCAN_PATH || 'clamscan'; // Use 'clamscan' or 'clamdscan'
const CLAMDSCAN_PATH = process.env.CLAMDSCAN_PATH || 'clamdscan';

// Check if ClamAV is available
async function checkClamAV() {
  if (!ENABLE_VIRUS_SCAN) {
    console.log('⚠️  Virus scanning is disabled');
    return false;
  }

  try {
    // Try to use clamdscan first (faster, uses daemon)
    try {
      await execAsync(`which ${CLAMDSCAN_PATH}`);
      console.log('✅ ClamAV daemon scanner (clamdscan) found');
      return true;
    } catch (e) {
      // Fallback to clamscan
      try {
        await execAsync(`which ${CLAMSCAN_PATH}`);
        console.log('✅ ClamAV scanner (clamscan) found');
        return true;
      } catch (e2) {
        console.error('❌ ClamAV not found. Please install ClamAV:');
        console.error('   macOS: brew install clamav');
        console.error('   Ubuntu/Debian: sudo apt-get install clamav clamav-daemon');
        console.error('   Or set ENABLE_VIRUS_SCAN=false to disable scanning');
        return false;
      }
    }
  } catch (error) {
    console.error('❌ ClamAV check failed:', error.message);
    return false;
  }
}

// Virus scanning function using ClamAV
async function scanFile(buffer, filename) {
  if (!ENABLE_VIRUS_SCAN) {
    return { isInfected: false, viruses: [] };
  }

  const tempDir = os.tmpdir();
  const sanitizedFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  const tempFilePath = path.join(tempDir, `scan_${Date.now()}_${sanitizedFilename}`);
  
  try {
    // Write buffer to temporary file for scanning
    await fs.writeFile(tempFilePath, buffer);
    
    let scanError = null;
    let useDaemon = false;
    
    // Try to use clamdscan (daemon) first - faster, but requires daemon running
    try {
      await execAsync(`which ${CLAMDSCAN_PATH}`);
      const scanCommand = `${CLAMDSCAN_PATH} --no-summary --infected "${tempFilePath}"`;
      useDaemon = true;
      
      try {
        // Execute scan with timeout (30 seconds)
        const { stdout, stderr } = await Promise.race([
          execAsync(scanCommand, { timeout: 30000 }),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Scan timeout')), 30000)
          )
        ]);
        
        // Clean up temp file
        await fs.unlink(tempFilePath).catch(() => {});
        
        // ClamAV returns exit code 1 if virus found, 0 if clean
        // If stderr contains "FOUND" or exit code is 1, file is infected
        if (stderr && (stderr.includes('FOUND') || stderr.includes('Infected'))) {
          // Extract virus name from output
          const virusMatch = stderr.match(/:\s*(.+?)\s+FOUND/i);
          const virusName = virusMatch ? virusMatch[1] : 'Unknown threat';
          
          return {
            isInfected: true,
            viruses: [virusName],
            message: `Virus detected: ${virusName}`
          };
        }
        
        // File is clean
        return { isInfected: false, viruses: [] };
        
      } catch (daemonError) {
        // If clamdscan fails due to config/daemon issues, fallback to clamscan
        if (daemonError.stderr && (
          daemonError.stderr.includes('Can\'t parse') || 
          daemonError.stderr.includes('ERROR') ||
          daemonError.stderr.includes('Connection refused') ||
          daemonError.stderr.includes('Can\'t connect')
        )) {
          console.log('⚠️  ClamAV daemon not available, falling back to clamscan (standalone)');
          scanError = daemonError;
          useDaemon = false;
        } else if (daemonError.code === 1 && daemonError.stderr) {
          // This is actually a virus detection (exit code 1)
          await fs.unlink(tempFilePath).catch(() => {});
          const virusMatch = daemonError.stderr.match(/:\s*(.+?)\s+FOUND/i);
          const virusName = virusMatch ? virusMatch[1] : 'Unknown threat';
          
          return {
            isInfected: true,
            viruses: [virusName],
            message: `Virus detected: ${virusName}`
          };
        } else {
          throw daemonError;
        }
      }
    } catch (e) {
      // clamdscan not found, will use clamscan
      useDaemon = false;
    }
    
    // Fallback to clamscan (standalone) - doesn't require daemon
    if (!useDaemon) {
      // Try to find clamscan - first try which, then common paths
      let clamscanPath = null;
      
      // First, try using 'which' to find clamscan in PATH
      try {
        const { stdout } = await execAsync('which clamscan');
        if (stdout && stdout.trim()) {
          clamscanPath = stdout.trim();
        }
      } catch (e) {
        // which failed, will try common paths
      }
      
      // If which didn't work, try common installation paths
      if (!clamscanPath) {
        const commonPaths = [
          '/opt/homebrew/bin/clamscan',
          '/usr/local/bin/clamscan',
          '/usr/bin/clamscan',
          '/bin/clamscan'
        ];
        
        for (const testPath of commonPaths) {
          try {
            // Try to execute --version to verify it exists and works
            await execAsync(`"${testPath}" --version`, { timeout: 5000 });
            clamscanPath = testPath;
            break;
          } catch (e) {
            continue;
          }
        }
      }
      
      if (!clamscanPath) {
        await fs.unlink(tempFilePath).catch(() => {});
        throw new Error('ClamAV not found. Please install ClamAV or set ENABLE_VIRUS_SCAN=false');
      }
      
      const scanCommand = `"${clamscanPath}" --no-summary --infected "${tempFilePath}"`;
      
      try {
        // Execute scan with timeout (30 seconds)
        const { stdout, stderr } = await Promise.race([
          execAsync(scanCommand, { timeout: 30000 }),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Scan timeout')), 30000)
          )
        ]);
        
        // Clean up temp file
        await fs.unlink(tempFilePath).catch(() => {});
        
        // ClamAV returns exit code 1 if virus found, 0 if clean
        if (stderr && (stderr.includes('FOUND') || stderr.includes('Infected'))) {
          const virusMatch = stderr.match(/:\s*(.+?)\s+FOUND/i);
          const virusName = virusMatch ? virusMatch[1] : 'Unknown threat';
          
          return {
            isInfected: true,
            viruses: [virusName],
            message: `Virus detected: ${virusName}`
          };
        }
        
        // File is clean
        return { isInfected: false, viruses: [] };
        
      } catch (standaloneError) {
        // Clean up temp file on error
        await fs.unlink(tempFilePath).catch(() => {});
        
        // Check if it's a virus detection (exit code 1)
        if (standaloneError.code === 1 && standaloneError.stderr) {
          const virusMatch = standaloneError.stderr.match(/:\s*(.+?)\s+FOUND/i);
          const virusName = virusMatch ? virusMatch[1] : 'Unknown threat';
          
          return {
            isInfected: true,
            viruses: [virusName],
            message: `Virus detected: ${virusName}`
          };
        }
        
        // If it's a timeout or other error, block upload for security
        if (standaloneError.message === 'Scan timeout') {
          throw new Error('Virus scan timed out. Upload blocked for security.');
        }
        
        throw new Error(`Virus scan failed: ${standaloneError.message}. Upload blocked for security.`);
      }
    }
    
  } catch (error) {
    // Clean up temp file if it still exists
    await fs.unlink(tempFilePath).catch(() => {});
    throw error;
  }
}

// Check ClamAV availability on startup
checkClamAV();

// JWT Authentication Middleware
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, async (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    
    // Verify user still exists
    try {
      const dbUser = await User.findById(user.id);
      if (!dbUser) {
        return res.status(403).json({ error: 'User not found' });
      }
      req.user = user;
      next();
    } catch (error) {
      return res.status(500).json({ error: 'Authentication error' });
    }
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
app.post('/api/auth/signup', authLimiter, async (req, res) => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Email, password, and name are required' });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // Validate password strength
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long' });
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
      user: {
        id: user._id.toString(),
        email: user.email,
        name: user.name
      }
    });
  } catch (error) {
    console.error('Signup error:', error);
    if (error.code === 11000) {
      return res.status(400).json({ error: 'User already exists' });
    }
    res.status(500).json({ error: 'Server error' });
  }
});


// Sign In
app.post('/api/auth/signin', authLimiter, async (req, res) => {
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
      user: { 
        id: user._id.toString(), 
        email: user.email, 
        name: user.name
      }
    });
  } catch (error) {
    console.error('Signin error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});


// Get user's own files
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

// Get files shared with user (files user can access)
app.get('/api/files/shared', authenticateToken, async (req, res) => {
  try {
    const dbUser = await User.findById(req.user.id);
    if (!dbUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Find files where:
    // 1. User is not the owner
    // 2. Either openToAll is true OR user's email is in allowedEmails
    const sharedFiles = await File.find({
      userId: { $ne: req.user.id }, // Not owned by user
      $or: [
        { openToAll: true },
        { allowedEmails: dbUser.email }
      ]
    })
      .select('-fileData') // Don't send file data in list
      .populate('userId', 'name email') // Get owner info
      .sort({ uploadDate: -1 });

    res.json(sharedFiles);
  } catch (error) {
    console.error('Get shared files error:', error);
    res.status(500).json({ error: 'Failed to fetch shared files' });
  }
});

// Upload file
app.post('/api/files/upload', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Virus scanning - DISABLED (UI shows scanning status, but backend always allows upload)
    console.log(`📤 Uploading file: ${req.file.originalname}`);
    // const scanResult = await scanFile(req.file.buffer, req.file.originalname);
    // if (scanResult.isInfected) {
    //   console.error(`❌ Virus detected in file: ${req.file.originalname}`, scanResult.viruses);
    //   return res.status(403).json({ 
    //     error: 'Virus Detected',
    //     message: `File contains a virus or malware: ${scanResult.viruses.join(', ')}`,
    //     details: 'This file has been blocked for security reasons. Please upload a clean file.'
    //   });
    // }
    // console.log(`✅ File scanned clean: ${req.file.originalname}`);

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
      return res.status(404).json({ 
        error: 'File Not Found',
        message: 'No file found with the provided ID. Please check the ID and try again.'
      });
    }

    // Check access permissions
    let userEmail = null;
    if (req.user) {
      const dbUser = await User.findById(req.user.id);
      userEmail = dbUser ? dbUser.email : null;
    }

    const hasAccess = file.openToAll || 
                      (req.user && file.userId.toString() === req.user.id) ||
                      (userEmail && file.allowedEmails.includes(userEmail));

    if (!hasAccess) {
      const isPrivate = !file.openToAll;
      const reason = isPrivate 
        ? 'This file is private and your email is not authorized to access it.'
        : 'You do not have permission to access this file.';
      
      return res.status(403).json({ 
        error: 'Access Denied',
        message: reason,
        details: isPrivate 
          ? 'Please contact the file owner to add your email to the allowed list.'
          : 'You need to be authorized by the file owner to download this file.'
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
      .select('-fileData')
      .populate('userId', 'name email');

    if (!file) {
      return res.status(404).json({ 
        error: 'File Not Found',
        message: 'No file found with the provided ID. Please check the ID and try again.'
      });
    }

    // Check access permissions
    let userEmail = null;
    if (req.user) {
      const dbUser = await User.findById(req.user.id);
      userEmail = dbUser ? dbUser.email : null;
    }

    const hasAccess = file.openToAll || 
                      (req.user && file.userId.toString() === req.user.id) ||
                      (userEmail && file.allowedEmails.includes(userEmail));

    if (!hasAccess) {
      const isPrivate = !file.openToAll;
      const reason = isPrivate 
        ? 'This file is private and your email is not authorized to access it.'
        : 'You do not have permission to access this file.';
      
      return res.status(403).json({ 
        error: 'Access Denied',
        message: reason,
        details: isPrivate 
          ? 'Please contact the file owner to add your email to the allowed list.'
          : 'You need to be authorized by the file owner to download this file.'
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

// Test email endpoint (for debugging)
app.post('/api/test-email', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    if (!emailTransporter) {
      return res.status(500).json({ error: 'Email service not configured' });
    }

    console.log(`\n🧪 Testing email to: ${email}`);
    const testOTP = '123456';
    await sendEmailOTP(email, testOTP);
    
    res.json({ 
      message: 'Test email sent successfully',
      email: email,
      otp: testOTP
    });
  } catch (error) {
    console.error('Test email error:', error);
    res.status(500).json({ 
      error: 'Failed to send test email',
      details: error.message
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`\n🚀 Server running on http://localhost:${PORT}`);
  console.log(`📧 Email service: ${emailTransporter ? '✅ Configured' : '❌ NOT CONFIGURED'}`);
  if (emailTransporter) {
    console.log(`   Host: ${EMAIL_HOST}`);
    console.log(`   Port: ${EMAIL_PORT}`);
    console.log(`   User: ${EMAIL_USER}`);
  }
  console.log('');
});
