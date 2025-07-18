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

const tempUpload = multer({ dest: os.tmpdir() });
const bcrypt = require('bcrypt');


const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));





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
  email: { type: String, required: true, unique: true,lowercase: true },
  password: { type: String, required: true }
});



const HodSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true,lowercase: true },
  password: { type: String, required: true },
  department: { type: String, required: true }
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




function decodeBarcode(barcode) {
  if (!barcode || barcode.length < 5) {
    return {
      year: "Unknown",
      department: "Unknown",
      designation: "Unknown"
    };
  }

  const admissionYearCode = barcode.slice(0, 2);  // e.g., "23"
  const enrollYearCode = barcode.slice(3, 5);      // "10" (Regular) or "20" (DSY)
  const designationCode = barcode.charAt(0);       // "2", "F", "L"

  const departments = {
    '1': "Civil",
    '2': "Mechanical",
    '3': "Computer Science",
    '4': "Electronics and Communication",
    '5': "Electronics and Computer",
    'B': "Library",
  };

  let designation = "Unknown";
  let department = "Unknown";
  let year = "N/A";

  if (designationCode === 'F') {
    designation = "Faculty";
    department = departments[barcode.charAt(3)] || "Unknown";  // Faculty dept at index 3
  } else if (designationCode === 'L') {
    designation = "Librarian";
    department = "Library"; // fixed for librarian
  } else if (designationCode === '2') {
    designation = "Student";
    department = departments[barcode.charAt(2)] || "Unknown";  // Student dept at index 2

    const now = new Date();
    let currentYear = now.getFullYear();
    const currentMonth = now.getMonth(); // 0 = Jan, 6 = July

    // Academic year starts from July
    if (currentMonth < 6) {
      currentYear--; // Before July, still in previous academic year
    }

    const admissionFullYear = 2000 + parseInt(admissionYearCode);
    const diff = currentYear - admissionFullYear;

    if (enrollYearCode === "10") {
      if (diff === 0) {
        year = "First";
      } else if (diff === 1) {
        year = "Second";
      } else if (diff === 2) {
        year = "Third";
      } else if (diff === 3) {
        year = "Final";
      } else {
        year = "Graduated";
      }
    } else if (enrollYearCode === "20") {
      if (diff === 0) {
        year = "Second";
      } else if (diff === 1) {
        year = "Third";
      } else if (diff === 2) {
        year = "Final";
      } else {
        year = "Graduated";
      }
    } else {
      year = "Unknown";
    }
  }

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

app.get('/live-log', async (req, res) => {
  try {
    const today = getCurrentDateString();
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
    console.error("Failed to fetch all logs:", err);
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
app.post('/admin/force-exit', async (req, res) => {
  const today = getCurrentDateString();
  const now = new Date();

  try {
    const result = await Log.updateMany(
      { date: today, exitTime: null },
      { $set: { exitTime: now } }
    );
    return res.status(200).json({ message: "Force exit completed.", modifiedCount: result.modifiedCount });
  } catch (err) {
    console.error("❌ Manual force exit failed:", err);
    return res.status(500).json({ error: "Manual exit failed." });
  }
});

// Admin: Add a new notice
app.post('/admin/notices', async (req, res) => {
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

app.post('/admin/notices', async (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'Notice text required' });

  try {
    const newNotice = new Notice({ text });
    await newNotice.save();
    res.status(201).json({ success: true, message: 'Notice posted successfully' });
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

app.delete('/admin/notices/:id', async (req, res) => {
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



// UPDATE a visitor's details by barcode
app.put('/api/students/:barcode', upload.single('photo'), async (req, res) => {
  try {
    const { barcode } = req.params;

    const updateData = {
      name: req.body.name,
      email: req.body.email,
      mobile: req.body.mobile,
      department: req.body.department,
      year: req.body.year,
    };

    if (req.file) {
      updateData.photoUrl = `/uploads/${req.file.filename}`;
    }

    const updated = await Visitor.findOneAndUpdate(
      { barcode },
      updateData,
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ success: false, message: "Visitor not found" });
    }

    res.json({ success: true, updated });
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

require("dotenv").config();

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

app.post('/add-visitor', upload.single('photo'), async (req, res) => {
  const { barcode, name, mobile, email } = req.body;
  const file = req.file;

  if (!barcode || !name || !mobile || !file) {
    return res.status(400).json({ message: "Missing fields" });
  }

  const photoUrl = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;

  try {
    const visitor = new Visitor({ barcode, name, mobile, email, photoUrl });
    await visitor.save();
    res.status(200).json({ message: "✅ Visitor added" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "❌ Error saving visitor" });
  }
});



app.post('/bulk-add-visitors', tempUpload.fields([{ name: "csv" }, { name: "photos" }]), async (req, res) => {
  try {
    const csvFile = req.files["csv"]?.[0];
    const photoFiles = req.files["photos"] || [];

    if (!csvFile || photoFiles.length === 0) {
      return res.status(400).json({ success: false, message: "Missing files" });
    }

    const photoMap = {};
    photoFiles.forEach(file => {
      const key = path.parse(file.originalname).name.trim();
      photoMap[key] = `data:${file.mimetype};base64,${fs.readFileSync(file.path).toString('base64')}`;
    });

    const inserted = [];

    fs.createReadStream(csvFile.path)
      .pipe(csv())
      .on("data", async (row) => {
        const { barcode, name, mobile, email } = row;
        const photoUrl = photoMap[barcode];

        if (barcode && name && mobile && photoUrl) {
          const newVisitor = new Visitor({ barcode, name, mobile, email, photoUrl });
          await newVisitor.save();
          inserted.push(barcode);
        }
      })
      .on("end", () => {
        res.status(200).json({ success: true, insertedCount: inserted.length });
      });

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error" });
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
app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ success: false, message: "Email and password are required." });
    }
    const admin = await Admin.findOne({ email });

    if (!admin) {
      return res.status(401).json({ success: false, message: "Invalid credentials" });
    }

    const match = await bcrypt.compare(password, admin.password);
    if (!match) {
      return res.status(401).json({ success: false, message: "Invalid credentials" });
    }

    res.json({ success: true });
  } catch (err) {
    console.error("❌ Login error:", err);
    res.status(500).json({ success: false, message: "Server error during login" });
  }
});

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


app.post("/api/hod-login", async (req, res) => {
  const { email, password } = req.body;
  try {
    const hod = await Hod.findOne({ email });
    if (!hod) return res.status(401).json({ success: false, message: "Invalid credentials" });

    const match = await bcrypt.compare(password, hod.password);
    if (!match) return res.status(401).json({ success: false, message: "Invalid credentials" });

    res.json({ success: true, department: hod.department });
  } catch (err)
  {
    console.error("❌ HOD login error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Route to register a new HOD
app.post("/api/register-hod", async (req, res) => {
  const { email, password, department } = req.body;
   if (!email || !password || !department) {
        return res.status(400).json({ success: false, message: "Email, password, and department are required." });
    }
  try {
    const existing = await Hod.findOne({ email });
    if (existing) {
      return res.status(409).json({ success: false, message: "HOD with this email already exists" });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const newHod = new Hod({ email, password: hashedPassword, department });
    await newHod.save();
    res.status(201).json({ success: true, message: "✅ HOD registered successfully" });
  } catch (err) {
    console.error("❌ Register HOD error:", err);
    res.status(500).json({ success: false, message: "Server error during HOD registration." });
  }
});
// Starts the server
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});