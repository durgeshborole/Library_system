// ======= server.js =======
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const app = express();
const nodemailer = require("nodemailer");
const csv = require("csv-parser");
const fs = require("fs");
const os = require("os");
const path = require("path");
const PORT = 5000;
const cron = require('node-cron');
const multer = require('multer');
const crypto = require('crypto');
const tempUpload = multer({ dest: os.tmpdir() });
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
require("dotenv").config();
const memoryUpload = multer({ storage: multer.memoryStorage() });


const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));


const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 login requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many login attempts from this IP, please try again after 15 minutes." }
});


const { spawn } = require("child_process");

// Middleware setup
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/images', express.static(path.join(__dirname, 'images')));

// MongoDB connection
mongoose.connect('mongodb+srv://durgeshborole:u6Ihi1GAKF84YIP1@system.8xuulfp.mongodb.net/library?retryWrites=true&w=majority&appName=System', {
}).then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));




// Schemas

const AdminSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true },
  // 👇 Add these fields
  passwordResetToken: String,
  passwordResetExpires: Date
});


// server.js

const HodSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true },
  department: { type: String, required: true },
  mobile: { type: String }, // New field
  dob: { type: Date },       // New field
  isVerified: { type: Boolean, default: false },
  otp: { type: String },
  otpExpires: { type: Date }
});


const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir);
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  }
});




const visitorSchema = new mongoose.Schema({
  name: String,
  barcode: String,
  email: String,
  mobile: String,
  department: String,
  year: String,
  photoUrl: String, // OR photoBase64: String
});



const logSchema = new mongoose.Schema({
  barcode: String,
  name: String,
  department: String,
  year: String,
  designation: String,
  date: String,
  entryTime: { type: Date, default: Date.now },
  exitTime: Date,
});



const noticeSchema = new mongoose.Schema({
  text: String,
  timestamp: { type: Date, default: Date.now }
});
const Notice = mongoose.model('Notice', noticeSchema);
const Admin = mongoose.model("Admin", AdminSchema);
const Hod = mongoose.model("Hod", HodSchema);
const upload = multer({ storage });
const Visitor = mongoose.model('Visitor', visitorSchema);
const Log = mongoose.model('Log', logSchema);


const PrincipalSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true }
});

// Add this with your other Mongoose Models
const Principal = mongoose.model("Principal", PrincipalSchema);

// Add this with your other security middleware (like isAdmin)
const isPrincipal = (req, res, next) => {
  if (req.user.role !== 'principal') {
    return res.status(403).json({ success: false, message: "Principal access required." });
  }
  next();
};

// ===================================================================
// START: AUTHENTICATION AND AUTHORIZATION MIDDLEWARE
// ===================================================================

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token == null) {
    return res.sendStatus(401);
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    // ✅ ADD THIS LOG to see the specific JWT error
    if (err) {
      console.error("❌ JWT Verification Error:", err.message);
      return res.sendStatus(403);
    }
    req.user = user;
    next();
  });
};

// Middleware to check if the user is an admin
// Middleware to check if the user is an admin
const isAdmin = (req, res, next) => {
  // ✅ ADD THIS LOG to check the user's role before validation
  console.log("ℹ️ isAdmin Middleware Check - User Role:", req.user?.role);

  if (req.user?.role !== 'admin') {
    return res.status(403).json({ success: false, message: "Admin access required. User does not have the 'admin' role." });
  }
  next();
};

// Middleware to check if the user is an HOD
const isHod = (req, res, next) => {
  if (req.user.role !== 'hod') {
    return res.status(403).json({ success: false, message: "HOD access required." });
  }
  next();
};

// ===================================================================
// END: AUTHENTICATION AND AUTHORIZATION MIDDLEWARE
// ===================================================================

// function decodeBarcode(barcode) {
//   if (!barcode || barcode.length < 5) {
//     return {
//       year: "Unknown",
//       department: "Unknown",
//       designation: "Unknown"
//     };
//   }

//   const admissionYearCode = barcode.slice(0, 2);  // e.g., "23"
//   const enrollYearCode = barcode.slice(3, 5);      // "10" (Regular) or "20" (DSY)
//   const designationCode = barcode.charAt(0);       // "2", "F", "L"

//   const departments = {
//     '1': "Civil",
//     '2': "Mechanical",
//     '3': "Computer Science",
//     '4': "Electronics and Communication",
//     '5': "Electronics and Computer",
//     'B': "Library",
//   };

//   let designation = "Unknown";
//   let department = "Unknown";
//   let year = "N/A";

//   if (designationCode === 'F') {
//     designation = "Faculty";
//     department = departments[barcode.charAt(3)] || "Unknown";  // Faculty dept at index 3
//   } else if (designationCode === 'L') {
//     designation = "Librarian";
//     department = "Library"; // fixed for librarian
//   } else if (designationCode === '2') {
//     designation = "Student";
//     department = departments[barcode.charAt(2)] || "Unknown";  // Student dept at index 2

//     const now = new Date();
//     let currentYear = now.getFullYear();
//     const currentMonth = now.getMonth(); // 0 = Jan, 6 = July

//     // Academic year starts from July
//     if (currentMonth < 6) {
//       currentYear--; // Before July, still in previous academic year
//     }

//     const admissionFullYear = 2000 + parseInt(admissionYearCode);
//     const diff = currentYear - admissionFullYear;

//     if (enrollYearCode === "10") {
//       if (diff === 0) {
//         year = "First";
//       } else if (diff === 1) {
//         year = "Second";
//       } else if (diff === 2) {
//         year = "Third";
//       } else if (diff === 3) {
//         year = "Final";
//       } else {
//         year = "Graduated";
//       }
//     } else if (enrollYearCode === "20") {
//       if (diff === 0) {
//         year = "Second";
//       } else if (diff === 1) {
//         year = "Third";
//       } else if (diff === 2) {
//         year = "Final";
//       } else {
//         year = "Graduated";
//       }
//     } else {
//       year = "Unknown";
//     }
//   }

//   return {
//     year,
//     department,
//     designation
//   };
// }

function decodeBarcode(barcode) {
  // --- Default values and basic validation ---
  const unknownResult = {
    year: "N/A",
    department: "Unknown",
    designation: "Unknown"
  };

  if (!barcode || typeof barcode !== 'string' || barcode.length < 5) {
    return unknownResult;
  }

  // --- Data Mappings ---
  const departments = {
    '1': "Civil Engineering",
    '2': "Mechanical Engineering",
    '3': "Computer Science",
    '4': "Electronics and Communication",
    '5': "Electronics and Computer",
    'B': "Library",
  };

  // --- Extract Information based on Designation ---
  const designationPrefix = barcode.charAt(0).toUpperCase();
  let designation = "Unknown";
  let department = "Unknown";
  let year = "N/A";

  // Check for Faculty
  if (designationPrefix === 'F') {
    designation = "Faculty";
    const departmentCode = barcode.charAt(3);
    department = departments[departmentCode] || "Unknown";
    // Faculty members do not have a "year of study"
    year = "N/A";

    // Check for Librarian
  } else if (designationPrefix === 'L') {
    designation = "Librarian";
    department = "Library"; // Librarians belong to the Library department
    year = "N/A";

    // Check for Student (assuming student barcodes start with a number)
  } else if (!isNaN(parseInt(designationPrefix, 10))) {
    designation = "Student";

    // --- Student-Specific Decoding ---
    const admissionYearCode = barcode.slice(0, 2); // e.g., "25"
    const departmentCode = barcode.charAt(2);      // e.g., "3"
    const enrollTypeCode = barcode.slice(3, 5);    // e.g., "10" or "20"

    department = departments[departmentCode] || "Unknown";

    // --- Automatic Year Calculation ---
    // This section makes the system "automatic". It compares the student's
    // admission year with the current academic year to determine their level.

    const now = new Date();
    let currentAcademicYear = now.getFullYear();
    const currentMonth = now.getMonth(); // 0 = January, 6 = July

    // The academic year starts in July. If the current month is before July,
    // we are still in the previous academic year.
    if (currentMonth < 6) {
      currentAcademicYear--;
    }

    const admissionFullYear = 2000 + parseInt(admissionYearCode, 10);
    const yearsSinceAdmission = currentAcademicYear - admissionFullYear;

    // Determine year of study based on enrollment type
    if (enrollTypeCode === "10") { // Regular 4-year program
      if (yearsSinceAdmission < 0) {
        year = "Pre-admission"; // Admission year is in the future
      } else if (yearsSinceAdmission === 0) {
        year = "First Year";
      } else if (yearsSinceAdmission === 1) {
        year = "Second Year";
      } else if (yearsSinceAdmission === 2) {
        year = "Third Year";
      } else if (yearsSinceAdmission === 3) {
        year = "Final Year";
      } else {
        year = "Graduated";
      }
    } else if (enrollTypeCode === "20") { // Direct Second Year (DSY) 3-year program
      if (yearsSinceAdmission < 0) {
        year = "Pre-admission";
      } else if (yearsSinceAdmission === 0) {
        year = "Second Year"; // DSY students start in the second year
      } else if (yearsSinceAdmission === 1) {
        year = "Third Year";
      } else if (yearsSinceAdmission === 2) {
        year = "Final Year";
      } else {
        year = "Graduated";
      }
    } else {
      year = "Unknown Enrollment Type";
    }
  }

  // Return the final decoded information
  return {
    year,
    department,
    designation
  };
}

function getCurrentDateString() {
  const now = new Date();
  return now.toISOString().split('T')[0];
}

app.post('/scan', async (req, res) => {
  const barcode = req.body?.barcode;
  if (!barcode) {
    return res.status(400).json({ error: 'Invalid or missing barcode in request body' });
  }

  try {
    const visitor = await Visitor.findOne({ barcode });

    if (!visitor) {
      return res.status(404).json({ error: 'Visitor not found in database' });
    }

    const decoded = decodeBarcode(String(barcode));
    const today = getCurrentDateString();

    const existing = await Log.findOne({ barcode, exitTime: null, date: today });

    if (existing) {
      existing.exitTime = new Date();
      await existing.save();
      return res.status(200).json({ ...existing._doc, status: "exit", photoUrl: visitor.photoUrl });
    }

    const newEntry = new Log({
      barcode,
      name: visitor.name,
      department: decoded.department,
      year: decoded.year,
      designation: decoded.designation,
      date: today,
    });

    const saved = await newEntry.save();
    return res.status(200).json({ ...saved._doc, status: "entry", photoUrl: visitor.photoUrl });
  } catch (error) {
    console.error('Error during scan:', error);
    return res.status(500).json({ error: 'Server error' });
  }


});

// ✅ NEW: A simple endpoint for the frontend to check server connectivity
app.get("/api/ping", (req, res) => {
  res.status(200).json({ success: true, message: "pong" });
});

app.get('/live-log', async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const logs = await Log.find({ date: today }).sort({ entryTime: -1 });
    return res.status(200).json(logs);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch live log' });
  }
});

// New endpoint to support analysis.js — returns all logs
app.get('/all-logs', async (req, res) => {
  try {
    const logs = await Log.find().sort({ entryTime: -1 });
    res.status(200).json(logs);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch all logs" });
  }
});

app.get('/stats', async (req, res) => {
  try {
    const today = getCurrentDateString();

    const todayLogs = await Log.find({ date: today });

    const totalVisitorsToday = todayLogs.length;
    const currentlyInside = todayLogs.filter(log => !log.exitTime).length;

    const deptCount = {};
    todayLogs.forEach(log => {
      if (log.department) {
        deptCount[log.department] = (deptCount[log.department] || 0) + 1;
      }
    });

    const mostFrequentDept = Object.entries(deptCount)
      .sort((a, b) => b[1] - a[1])[0]?.[0];

    const latestEntry = todayLogs
      .sort((a, b) => new Date(b.entryTime) - new Date(a.entryTime))[0];

    const lastEntry = latestEntry
      ? new Date(latestEntry.entryTime).toLocaleTimeString()
      : null;

    res.status(200).json({
      totalVisitorsToday,
      currentlyInside,
      mostFrequentDept,
      lastEntry
    });
  } catch (err) {
    console.error("Error generating stats:", err);
    res.status(500).json({ error: "Failed to generate stats" });
  }
});

let AUTO_EXIT_HOUR = 21; // Default: 9 PM
let AUTO_EXIT_MINUTE = 0;

cron.schedule('* * * * *', async () => {
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();

  if (currentHour === AUTO_EXIT_HOUR && currentMinute === AUTO_EXIT_MINUTE) {
    const today = getCurrentDateString();
    const autoExitTime = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      AUTO_EXIT_HOUR,
      AUTO_EXIT_MINUTE,
      0
    );

    try {
      const result = await Log.updateMany(
        { date: today, exitTime: null },
        { $set: { exitTime: autoExitTime } }
      );

      console.log(`🕘 Auto-exit applied: ${result.modifiedCount} entries closed at ${autoExitTime.toLocaleTimeString()}`);
    } catch (err) {
      console.error("❌ Auto-exit failed:", err);
    }
  }
});

// Admin: update auto-exit time
app.post('/admin/auto-exit', (req, res) => {
  const { hour, minute } = req.body;
  if (hour === undefined || minute === undefined) {
    return res.status(400).json({ error: "Hour and minute are required." });
  }

  AUTO_EXIT_HOUR = parseInt(hour);
  AUTO_EXIT_MINUTE = parseInt(minute);
  return res.status(200).json({ message: `Auto-exit time updated to ${AUTO_EXIT_HOUR}:${AUTO_EXIT_MINUTE}` });
});

// Admin: force exit manually
app.post('/admin/force-exit', authenticateToken, isAdmin, async (req, res) => {
  try {
    const now = new Date();

    // Create a date range for the current day (from midnight to midnight)
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    const result = await Log.updateMany(
      // The new, more reliable filter:
      // Find logs where entry time was today AND exit time is not set.
      {
        entryTime: { $gte: startOfToday, $lte: endOfToday },
        exitTime: null
      },
      // Set the exit time to now
      { $set: { exitTime: now } }
    );

    return res.status(200).json({ message: "Force exit completed.", modifiedCount: result.modifiedCount });
  } catch (err) {
    console.error("❌ Manual force exit failed:", err);
    return res.status(500).json({ error: "Manual exit failed." });
  }
});

// Admin: Add a new notice
app.post('/admin/notices', authenticateToken, isAdmin, async (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'Notice text required' });

  try {
    const newNotice = new Notice({ text });
    await newNotice.save();
    res.status(201).json({ message: 'Notice posted successfully' });
  } catch (err) {
    console.error('Failed to save notice:', err);
    res.status(500).json({ error: 'Failed to save notice' });
  }
});

// Notice GET API
app.get('/notices', async (req, res) => {
  try {
    const notices = await Notice.find().sort({ timestamp: -1 }).limit(5);
    res.status(200).json(notices);
  } catch (err) {
    console.error('Failed to fetch notices:', err);
    res.status(500).json({ error: 'Failed to load notices' });
  }
});

app.delete('/admin/notices/:id', authenticateToken, isAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    await Notice.findByIdAndDelete(id);
    res.status(200).json({ success: true, message: "Notice deleted successfully" });
  } catch (err) {
    console.error("Failed to delete notice:", err);
    res.status(500).json({ success: false, message: "Failed to delete notice" });
  }
});

app.post('/upload-photo', upload.single('photo'), async (req, res) => {
  const barcode = req.body.barcode;
  if (!barcode || !req.file) {
    return res.status(400).json({ success: false, message: 'Barcode and photo required.' });
  }

  try {
    const photoUrl = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;

    const visitor = await Visitor.findOneAndUpdate(
      { barcode },
      { $set: { photoUrl } },
      { new: true }
    );

    if (!visitor) {
      return res.status(404).json({ success: false, message: 'Visitor not found.' });
    }

    res.status(200).json({ success: true, message: 'Photo uploaded and linked to barcode.' });
  } catch (error) {
    console.error('Error uploading photo:', error);
    res.status(500).json({ success: false, message: 'Server error during photo upload.' });
  }
});

app.post('/bulk-upload-photos', upload.array('photos', 500), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, message: 'No photos uploaded.' });
    }

    console.log('✅ Received files:', req.files.length);

    let uploadedCount = 0;

    for (const file of req.files) {
      const filenameWithoutExtension = file.originalname.split('.').slice(0, -1).join('.');
      const barcode = filenameWithoutExtension.trim();

      if (!barcode) continue;

      const photoUrl = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;

      let visitor = await Visitor.findOne({ barcode });

      if (!visitor) {
        visitor = new Visitor({ barcode, name: "Unknown", photoUrl });
      } else {
        visitor.photoUrl = photoUrl;
      }

      await visitor.save();
      uploadedCount++;
    }

    return res.status(200).json({ success: true, uploadedCount });
  } catch (err) {
    console.error('❌ Server crashed during upload:', err);
    return res.status(500).json({ success: false, message: 'Server crashed' });
  }
});


app.get('/students', async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const skip = (page - 1) * limit;
  const search = req.query.search?.toLowerCase() || "";

  try {
    const query = search
      ? {
        $or: [
          { name: { $regex: search, $options: "i" } },
          { barcode: { $regex: search, $options: "i" } }
        ]
      }
      : {};

    const total = await Visitor.countDocuments(query);
    const visitors = await Visitor.find(query).skip(skip).limit(limit);

    const students = visitors.map(visitor => {
      const decoded = decodeBarcode(visitor.barcode || "");
      return {
        name: visitor.name || "No Name",
        barcode: visitor.barcode || "No Barcode",
        photoBase64: visitor.photoUrl || null, // Direct photo from MongoDB
        department: decoded.department || "Unknown",
        year: decoded.year || "Unknown",
        email: visitor.email || "N/A",
        mobile: visitor.mobile || "N/A"
      };
    });

    res.status(200).json({
      students,
      totalPages: Math.ceil(total / limit),
      currentPage: page
    });
  } catch (err) {
    console.error("❌ Error in /students:", err);
    res.status(500).json({ error: "Server error" });
  }
});


// ===================================================================
// START: NEW ENDPOINTS FOR UPDATING A VISITOR
// ===================================================================



// GET a single student by barcode
app.get('/api/students/:barcode', async (req, res) => {
  try {
    const { barcode } = req.params;
    const student = await Visitor.findOne({ barcode });

    if (!student) {
      return res.status(404).json({ success: false, message: "Visitor not found" });
    }

    res.status(200).json({ success: true, student });
  } catch (err) {
    console.error("❌ Error fetching visitor:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});



app.put("/api/students/:barcode", authenticateToken, isAdmin, memoryUpload.single('photo'), async (req, res) => {
  try {
    const { barcode } = req.params;
    const updateData = {
      name: req.body.name,
      email: req.body.email,
      mobile: req.body.mobile
    };
    if (req.file) {
      updateData.photoUrl = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
    }
    const updated = await Visitor.findOneAndUpdate(
      { barcode },
      { $set: updateData },
      { new: true }
    );
    if (!updated) {
      return res.status(404).json({ success: false, message: "Visitor not found" });
    }
    res.json({ success: true, message: "Visitor updated successfully.", student: updated });
  } catch (err) {
    console.error("❌ Error updating visitor:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});


// DELETE a visitor by barcode
app.delete('/api/students/:barcode', async (req, res) => {
  const { barcode } = req.params;
  console.log("🔍 DELETE request for barcode:", barcode);

  try {
    const deleted = await Visitor.findOneAndDelete({ barcode });

    if (!deleted) {
      console.log("❌ Visitor not found for deletion");
      return res.status(404).json({ success: false, message: "Visitor not found" });
    }

    console.log("✅ Visitor deleted:", deleted.name);
    res.status(200).json({ success: true, message: "Visitor deleted successfully" });
  } catch (err) {
    console.error("❌ Server error during deletion:", err);
    res.status(500).json({ success: false, message: "Server error during deletion" });
  }
});





// ===================================================================
// END: NEW ENDPOINTS FOR UPDATING A VISITOR
// ===================================================================


app.get('/debug-visitors', async (req, res) => {
  try {
    const data = await Visitor.find({}).limit(5);
    console.log("🧾 Sample raw visitors:", data);
    res.status(200).json(data);
  } catch (err) {
    console.error("❌ Error in /debug-visitors:", err);
    res.status(500).json({ error: "Failed to load visitors" });
  }
});

app.get('/photo/:barcode', async (req, res) => {
  console.log("▶️ Request for photo:", req.params.barcode);
  const visitor = await Visitor.findOne({ barcode: req.params.barcode });
  console.log("🔍 Visitor found:", visitor);

  if (!visitor || !visitor.photoUrl || !visitor.photoUrl.startsWith('data:image')) {
    console.log("❌ Invalid photoUrl. Sending default image.");
    return res.sendFile(__dirname + '/Backend/public/images/default.jpg');
  }

  const match = visitor.photoUrl.match(/^data:(.+);base64,(.+)$/);
  if (!match) {
    console.log("❌ Base64 match failed. Sending default image.");
    return res.sendFile(__dirname + '/Backend/public/images/default.jpg');
  }

  const mimeType = match[1];
  const base64Data = match[2];
  const buffer = Buffer.from(base64Data, 'base64');

  res.setHeader('Content-Type', mimeType);
  res.send(buffer);
});



const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

app.post('/face-entry', async (req, res) => {
  try {
    // 📧 Send Email
    try {
      const email = visitor.email || "default.email@example.com";
      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: email,
        subject: "Entry Log Notification",
        text: `${actionMessage} on ${today}`
      });
      console.log(`📧 Email sent to ${email}`);
    } catch (emailErr) {
      console.error("❌ Email error:", emailErr.message);
    }
  } catch (error) {
    console.error("❌ entry error:", error);
  }
});


app.get('/admin/monthly-awards', async (req, res) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    // Fetch logs for current month
    const logs = await Log.find({
      entryTime: { $gte: startOfMonth, $lte: endOfMonth },
      designation: "Student"
    });

    // Count visits per student
    const studentVisits = {};
    const deptVisits = {};

    for (const log of logs) {
      if (!studentVisits[log.barcode]) {
        studentVisits[log.barcode] = { count: 0, name: log.name };
      }
      studentVisits[log.barcode].count++;

      if (log.department) {
        deptVisits[log.department] = (deptVisits[log.department] || 0) + 1;
      }
    }

    // Top student
    const topStudent = Object.entries(studentVisits)
      .sort((a, b) => b[1].count - a[1].count)[0];

    // Top department
    const topDept = Object.entries(deptVisits)
      .sort((a, b) => b[1] - a[1])[0];

    res.status(200).json({
      topStudent: topStudent ? { barcode: topStudent[0], name: topStudent[1].name, visits: topStudent[1].count } : null,
      topDepartment: topDept ? { name: topDept[0], visits: topDept[1] } : null
    });

  } catch (err) {
    console.error("❌ Error in monthly awards:", err);
    res.status(500).json({ error: "Failed to generate awards" });
  }
});

app.post('/add-visitor', authenticateToken, isAdmin, memoryUpload.single('photo'), async (req, res) => {
  const { barcode, name, mobile, email } = req.body;
  const file = req.file;
  if (!barcode || !name || !file) {
    return res.status(400).json({ message: "Barcode, name, and photo are required." });
  }
  try {
    const photoUrl = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
    const newVisitor = new Visitor({ barcode, name, mobile, email, photoUrl });
    await newVisitor.save();
    res.status(200).json({ message: "✅ Visitor added successfully!" });
  } catch (err) {
    console.error("Error saving visitor:", err);
    res.status(500).json({ message: "❌ Error saving visitor to database." });
  }
});


// ✅ THIS ROUTE IS UPDATED WITH ADVANCED LOGGING FOR THE CSV PARSER
app.post('/bulk-add-visitors', tempUpload.fields([{ name: "csv" }, { name: "photos" }]), async (req, res) => {
  try {
    const csvFile = req.files["csv"]?.[0];
    const photoFiles = req.files["photos"] || [];

    if (!csvFile) {
      return res.status(400).json({ success: false, message: "CSV file is missing." });
    }

    const photoMap = {};
    if (photoFiles.length > 0) {
      photoFiles.forEach(file => {
        const key = path.parse(file.originalname).name.trim().toLowerCase();
        photoMap[key] = `data:${file.mimetype};base64,${fs.readFileSync(file.path).toString('base64')}`;
      });
    }

    const recordsToInsert = [];

    console.log("[Bulk Upload] Starting to process CSV file (photos are optional)...");

    fs.createReadStream(csvFile.path)
      .pipe(csv({
        trim: true,
        bom: true,
        mapHeaders: ({ header }) => header.trim().toLowerCase()
      }))
      .on("error", (error) => {
        console.error("❌ CSV Parsing Error:", error.message);
      })
      .on("headers", (headers) => {
        console.log("[Bulk Upload] ✅ CSV Headers Found and Normalized:", headers);
      })
      .on("data", (row) => {
        const { barcode, name, mobile, email } = row;

        // ✅ NEW LOGIC: First, validate that the only two required fields exist.
        if (!barcode || !name) {
          console.warn(`[Bulk Upload] ⚠️ SKIPPING ROW: The 'barcode' and 'name' columns are both required. Found barcode: '${barcode}', name: '${name}'.`);
          return; // Stop processing this row and move to the next.
        }

        // If validation passes, find the photo (it's optional).
        const photoUrl = photoMap[barcode.toLowerCase()] || null;

        if (!photoUrl) {
          console.info(`[Bulk Upload] ℹ️ INFO: No photo found for barcode '${barcode}'. Adding visitor without photo.`);
        }

        // ✅ ALWAYS add the record to our list if barcode and name are present.
        recordsToInsert.push({
          barcode,
          name,
          mobile: mobile || '',
          email: email || '',
          photoUrl: photoUrl
        });
      })
      .on("end", async () => {
        console.log(`[Bulk Upload] Finished reading CSV file. Found ${recordsToInsert.length} valid records to insert.`);
        try {
          if (recordsToInsert.length > 0) {
            // Using insertMany to add all collected records at once.
            const result = await Visitor.insertMany(recordsToInsert, { ordered: false });
            console.log(`[Bulk Upload] ✅ Successfully inserted ${result.length} records into the database.`);
            res.status(200).json({ success: true, message: `Successfully added ${result.length} visitors.` });
          } else {
            console.log("[Bulk Upload] ⚠️ No valid records were found to insert.");
            res.status(200).json({ success: true, message: "0 visitors were added. Please check the server console for warnings." });
          }
        } catch (dbError) {
          console.error("❌ Database error during bulk insert:", dbError);
          res.status(500).json({ success: false, message: "A database error occurred during the bulk insert." });
        }
      });

  } catch (err) {
    console.error("❌ General error in bulk upload:", err);
    res.status(500).json({ success: false, message: "A server error occurred." });
  }
});

// Login page start
// Register
app.post("/api/register", async (req, res) => {
  try {
    const { email, password } = req.body;

    const existing = await Admin.findOne({ email });
    if (existing) {
      return res.status(400).json({ success: false, message: "Email already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newAdmin = new Admin({ email, password: hashedPassword });
    await newAdmin.save();

    res.status(201).json({ success: true, message: "Registered successfully" });
  } catch (err) {
    console.error("❌ Registration error:", err);
    res.status(500).json({ success: false, message: "Server error during registration" });
  }
});

// Login Admin
// app.post("/api/login", loginLimiter, async (req, res) => {
//   try {
//     const { email, password } = req.body;
//     if (!email || !password) {
//       return res.status(400).json({ success: false, message: "Email and password are required." });
//     }
//     const admin = await Admin.findOne({ email });

//     if (!admin) {
//       return res.status(401).json({ success: false, message: "Invalid credentials" });
//     }

//     const match = await bcrypt.compare(password, admin.password);
//     if (!match) {
//       return res.status(401).json({ success: false, message: "Invalid credentials" });
//     }

//     // ✅ Create a JWT
//     const token = jwt.sign(
//       { id: admin._id, role: 'admin' },
//       process.env.JWT_SECRET,
//       { expiresIn: '1h' } // Token expires in 1 hour
//     );

//     res.json({ success: true, token }); // ⬅️ Send token to the client

//   } catch (err) {
//     console.error("❌ Login error:", err);
//     res.status(500).json({ success: false, message: "Server error during login" });
//   }
// });

// Register Admin
app.post("/api/register", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: "Email and password are required." });
    }

    const existing = await Admin.findOne({ email });
    if (existing) {
      return res.status(409).json({ success: false, message: "An account with this email already exists." });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newAdmin = new Admin({ email, password: hashedPassword });
    await newAdmin.save();

    res.status(201).json({ success: true, message: "Registered successfully" });
  } catch (err) {
    console.error("❌ Registration error:", err);
    res.status(500).json({ success: false, message: "Server error during registration" });
  }
});


// Password Reset for Admin
app.post("/api/reset-password", async (req, res) => {
  const { email, currentPassword, newPassword } = req.body;

  if (!email || !currentPassword || !newPassword) {
    return res.status(400).json({ success: false, message: "All fields are required." });
  }

  try {
    const admin = await Admin.findOne({ email });
    if (!admin) {
      return res.status(404).json({ success: false, message: "Account not found." });
    }

    const isMatch = await bcrypt.compare(currentPassword, admin.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: "Incorrect current password." });
    }

    const hashedNewPassword = await bcrypt.hash(newPassword, 10);
    admin.password = hashedNewPassword;
    await admin.save();

    res.status(200).json({ success: true, message: "Password updated successfully!" });
  } catch (err) {
    console.error("❌ Password reset error:", err);
    res.status(500).json({ success: false, message: "Server error during password reset." });
  }
});


// server.js

// app.post("/api/hod-login", async (req, res) => {
//   const { email, password } = req.body;
//   try {
//     const hod = await Hod.findOne({ email });
//     if (!hod) {
//       return res.status(401).json({ success: false, message: "Invalid credentials" });
//     }

//     const match = await bcrypt.compare(password, hod.password);
//     if (!match) {
//       return res.status(401).json({ success: false, message: "Invalid credentials" });
//     }

//     // --- NEW LOGIC FOR VERIFICATION ---
//     if (!hod.isVerified) {
//       // This is the first successful login. Trigger OTP verification.
//       const otp = crypto.randomInt(100000, 999999).toString();
//       hod.otp = otp;
//       hod.otpExpires = Date.now() + 10 * 60 * 1000; // OTP expires in 10 minutes
//       await hod.save();

//       // Send the OTP via email
//       await transporter.sendMail({
//         to: hod.email,
//         from: process.env.EMAIL_USER,
//         subject: 'HOD Account Login Verification Code',
//         text: `Your one-time verification code is: ${otp}\n\nThis code is required to complete your first login and will expire in 10 minutes.\n`
//       });

//       // Respond to the client, telling them OTP is required
//       return res.status(200).json({
//         success: true,
//         verificationRequired: true, // A flag for the frontend
//         message: "Login successful. Please enter the verification code sent to your email to continue."
//       });

//     } else {
//       // This is a normal login for an already verified user.
//       const token = jwt.sign(
//         { id: hod._id, role: 'hod', department: hod.department },
//         process.env.JWT_SECRET,
//         { expiresIn: '8h' }
//       );

//       // ✅ UPDATED: Added department to the response
//       return res.json({ success: true, verificationRequired: false, token, department: hod.department });
//     }

//   } catch (err) {
//     console.error("❌ HOD login error:", err);
//     res.status(500).json({ success: false, message: "Server error" });
//   }
// });

// Route to register a new HOD
// ✅ UPDATED HOD REGISTRATION ROUTE
app.post("/api/register-hod", async (req, res) => {
  // Get new fields from body
  const { email, password, department, mobile, dob } = req.body;
  if (!email || !password || !department) {
    return res.status(400).json({ success: false, message: "Email, password, and department are required." });
  }
  try {
    const existing = await Hod.findOne({ email });
    if (existing) {
      return res.status(409).json({ success: false, message: "HOD with this email already exists" });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    // Add new fields to the document
    const newHod = new Hod({ email, password: hashedPassword, department, mobile, dob });
    await newHod.save();
    res.status(201).json({ success: true, message: "✅ HOD registered successfully" });
  } catch (err) {
    console.error("❌ Register HOD error:", err);
    res.status(500).json({ success: false, message: "Server error during HOD registration." });
  }
});


app.post("/api/hod-initial-reset", async (req, res) => {
  const { email, newPassword } = req.body;
  if (!email || !newPassword) {
    return res.status(400).json({ success: false, message: "Email and new password are required." });
  }

  try {
    const hod = await Hod.findOne({ email });
    if (!hod) {
      return res.status(404).json({ success: false, message: "HOD account not found." });
    }

    // Only allow this if a reset is actually required
    if (!hod.passwordResetRequired) {
      return res.status(403).json({ success: false, message: "Password has already been set." });
    }

    const hashedNewPassword = await bcrypt.hash(newPassword, 10);
    hod.password = hashedNewPassword;
    hod.passwordResetRequired = false; // The crucial step
    await hod.save();

    res.status(200).json({ success: true, message: "Password has been set successfully. Please log in again." });
  } catch (err) {
    console.error("❌ HOD initial reset error:", err);
    res.status(500).json({ success: false, message: "Server error during password reset." });
  }
});

// server.js

app.post("/api/hod/verify-login", async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ success: false, message: "Email and OTP are required." });
    }

    // Find the HOD and validate the OTP
    const hod = await Hod.findOne({
      email,
      otp,
      otpExpires: { $gt: Date.now() } // Check that OTP is not expired
    });

    if (!hod) {
      return res.status(400).json({ success: false, message: "Invalid or expired verification code." });
    }

    // If OTP is correct, update the account to be verified
    hod.isVerified = true;
    hod.otp = undefined;
    hod.otpExpires = undefined;
    await hod.save();

    // Now, generate the standard login token
    const token = jwt.sign(
      { id: hod._id, role: 'hod', department: hod.department },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    // ✅ UPDATED: Added department to the response
    res.status(200).json({ success: true, token, department: hod.department, message: "Verification successful. You are now logged in." });

  } catch (err) {
    console.error("❌ HOD Login Verification Error:", err);
    res.status(500).json({ success: false, message: "Server error." });
  }
});



// GET all HODs (Admin only)
app.get("/api/hods", authenticateToken, isAdmin, async (req, res) => {
  try {
    const hods = await Hod.find({}).select("-password -otp -otpExpires"); // Exclude sensitive fields
    res.status(200).json(hods);
  } catch (error) {
    res.status(500).json({ message: "Server error fetching HODs." });
  }
});

// UPDATE an HOD by ID (Admin only)
app.put("/api/hods/:id", authenticateToken, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { email, department, mobile, dob } = req.body;

    const updatedHod = await Hod.findByIdAndUpdate(
      id,
      { email, department, mobile, dob },
      { new: true, runValidators: true }
    );

    if (!updatedHod) {
      return res.status(404).json({ message: "HOD not found." });
    }
    res.status(200).json({ message: "HOD updated successfully.", hod: updatedHod });
  } catch (error) {
    res.status(500).json({ message: "Server error updating HOD." });
  }
});

// DELETE an HOD by ID (Admin only)
app.delete("/api/hods/:id", authenticateToken, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const deletedHod = await Hod.findByIdAndDelete(id);

    if (!deletedHod) {
      return res.status(404).json({ message: "HOD not found." });
    }
    res.status(200).json({ message: "HOD deleted successfully." });
  } catch (error) {
    res.status(500).json({ message: "Server error deleting HOD." });
  }
});

// ✅ MODIFIED: This endpoint now ONLY deletes logs.
app.delete("/api/clear-database", authenticateToken, isAdmin, async (req, res) => {
  try {
    // This line deletes all documents from the 'logs' collection.
    const logResult = await Log.deleteMany({});

    // The line that deleted visitors has been removed.

    const message = `All ${logResult.deletedCount} log entries have been cleared successfully.`;

    console.log(`✅ ${message}`);
    res.status(200).json({ success: true, message });

  } catch (error) {
    console.error("❌ Error clearing logs:", error);
    res.status(500).json({ success: false, message: "Server error while clearing logs." });
  }
});


app.get('/api/monthly-awards', async (req, res) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const rankings = await Log.aggregate([
      // 1. Filter for logs within the current month that are completed (have an exit time)
      {
        $match: {
          entryTime: { $gte: startOfMonth, $lte: endOfMonth },
          exitTime: { $exists: true, $ne: null }
        }
      },
      // 2. Group by student barcode
      {
        $group: {
          _id: "$barcode", // Group by the visitor's barcode
          totalDuration: {
            $sum: { $subtract: ["$exitTime", "$entryTime"] } // Sum the duration of all visits in milliseconds
          },
          uniqueDays: {
            $addToSet: { $dateToString: { format: "%Y-%m-%d", date: "$entryTime" } } // Count unique days visited
          }
        }
      },
      // 3. Join with the visitors collection to get student names
      {
        $lookup: {
          from: "visitors", // The actual name of the visitors collection in MongoDB
          localField: "_id",
          foreignField: "barcode",
          as: "visitorInfo"
        }
      },
      // 4. Unwind the visitorInfo array to make it an object
      {
        $unwind: "$visitorInfo"
      },
      // 5. Sort by total duration descending
      {
        $sort: {
          totalDuration: -1
        }
      },
      // 6. Add a field for the count of unique days
      {
        $addFields: {
          uniqueDaysCount: { $size: "$uniqueDays" }
        }
      }
    ]);

    // Format the duration from milliseconds to a human-readable string
    const formattedRankings = rankings.map(r => {
      const totalSeconds = Math.floor(r.totalDuration / 1000);
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;
      return {
        ...r,
        totalDurationFormatted: `${hours} hours, ${minutes} minutes, ${seconds} seconds`,
      };
    });

    // Find the consistency winner (most unique days)
    const consistencyWinner = [...formattedRankings].sort((a, b) => b.uniqueDaysCount - a.uniqueDaysCount)[0];

    res.status(200).json({
      topScholars: formattedRankings,
      consistencyWinner: consistencyWinner
    });

  } catch (error) {
    console.error("❌ Error calculating monthly awards:", error);
    res.status(500).json({ message: "Server error while calculating awards." });
  }
});


app.post("/api/register-principal", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: "Email and password required." });
    const existing = await Principal.findOne({ email });
    if (existing) {
      return res.status(409).json({ message: "Principal account already exists." });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const newPrincipal = new Principal({ email, password: hashedPassword });
    await newPrincipal.save();
    res.status(201).json({ message: "Principal account created successfully." });
  } catch (error) {
    res.status(500).json({ message: "Server error." });
  }
});

// Your future login page will call this endpoint.
// app.post("/api/principal-login", async (req, res) => {
//     try {
//         const { email, password } = req.body;
//         const principal = await Principal.findOne({ email });
//         if (!principal) {
//             return res.status(401).json({ message: "Invalid credentials." });
//         }
//         const match = await bcrypt.compare(password, principal.password);
//         if (!match) {
//             return res.status(401).json({ message: "Invalid credentials." });
//         }
//         const token = jwt.sign({ id: principal._id, role: 'principal' }, process.env.JWT_SECRET, { expiresIn: '8h' });
//         res.json({ success: true, token });
//     } catch (error) {
//         res.status(500).json({ message: "Server error during login." });
//     }
// });

// This is the main endpoint that powers the dashboard.
app.get("/api/principal/stats", authenticateToken, isPrincipal, async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayLogs = await Log.find({
      entryTime: { $gte: today, $lt: tomorrow }
    });

    // Calculate Peak Hour
    const hourCounts = {};
    todayLogs.forEach(log => {
      const hour = new Date(log.entryTime).getHours();
      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    });
    let peakHour = null;
    let maxVisits = 0;
    for (const hour in hourCounts) {
      if (hourCounts[hour] > maxVisits) {
        maxVisits = hourCounts[hour];
        peakHour = parseInt(hour);
      }
    }
    const peakHourFormatted = peakHour !== null ? `${peakHour % 12 === 0 ? 12 : peakHour % 12}:00 ${peakHour < 12 ? 'AM' : 'PM'}` : 'N/A';

    // Calculate Department Counts
    const departmentCounts = await Log.aggregate([
      { $match: { entryTime: { $gte: today, $lt: tomorrow }, department: { $ne: null } } },
      { $group: { _id: "$department", count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    res.status(200).json({
      totalVisitsToday: todayLogs.length,
      peakHour: peakHourFormatted,
      departmentCounts: departmentCounts
    });
  } catch (error) {
    res.status(500).json({ message: "Error fetching principal stats." });
  }
});

app.post("/api/login/unified", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: "Email and password are required." });
  }

  try {
    // Step 1: Check if the user is an Admin
    const admin = await Admin.findOne({ email });
    if (admin) {
      const match = await bcrypt.compare(password, admin.password);
      if (match) {
        const token = jwt.sign({ id: admin._id, role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '8h' });
        return res.json({ success: true, token, role: 'admin', email: admin.email });
      }
    }

    // Step 2: If not an Admin, check if the user is a Principal
    const principal = await Principal.findOne({ email });
    if (principal) {
      const match = await bcrypt.compare(password, principal.password);
      if (match) {
        const token = jwt.sign({ id: principal._id, role: 'principal' }, process.env.JWT_SECRET, { expiresIn: '8h' });
        return res.json({ success: true, token, role: 'principal', email: principal.email });
      }
    }

    // Step 3: If not an Admin or Principal, check if the user is an HOD
    const hod = await Hod.findOne({ email });
    if (hod) {
      const match = await bcrypt.compare(password, hod.password);
      if (match) {
        // HODs have a special one-time verification flow
        if (!hod.isVerified) {
          const otp = crypto.randomInt(100000, 999999).toString();
          hod.otp = otp;
          hod.otpExpires = Date.now() + 10 * 60 * 1000;
          await hod.save();
          // You would typically send an email with the OTP here
          console.log(`HOD Login OTP for ${hod.email}: ${otp}`);
          return res.json({ success: true, verificationRequired: true, role: 'hod', message: "HOD verification required. An OTP has been sent." });
        } else {
          const token = jwt.sign({ id: hod._id, role: 'hod', department: hod.department }, process.env.JWT_SECRET, { expiresIn: '8h' });
          return res.json({ success: true, token, role: 'hod', department: hod.department });
        }
      }
    }

    // Step 4: If user is not found in any collection, send an error
    return res.status(401).json({ message: "Invalid credentials." });

  } catch (error) {
    console.error("Unified login error:", error);
    res.status(500).json({ message: "Server error during login." });
  }
});


// const HOST ='192.168.1.198'

// // Starts the server
// app.listen(PORT, () => {
//   console.log(`🚀 Server running aT https://${HOST}:${PORT}`);
// });

app.listen(PORT, () => {
  console.log(`🚀 Server running at https://localhost/${PORT}`);
});