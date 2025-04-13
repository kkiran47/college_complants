require('dotenv').config();
const express = require('express');
const path = require('path');
const multer = require('multer');
const nodemailer = require('nodemailer');
const cors = require('cors');
const bodyParser = require('body-parser');
const firebase = require('firebase-admin');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('cloudinary').v2;

const app = express();

const serviceAccount = require('./serviceAccountKey.json');
firebase.initializeApp({
  credential: firebase.credential.applicationDefault(),
  projectId: 'complaint-portal-b7394',  
});

const db = firebase.firestore();
app.use(cors());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// === Cloudinary Config ===
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// === Multer with Cloudinary ===
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'complaints_uploads',
    allowed_formats: ['jpg', 'png', 'jpeg', 'pdf']
  }
});
const upload = multer({ storage });

// === Nodemailer Setup ===
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  tls: { rejectUnauthorized: false },
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// === Admin Login ===
app.post('/admin-login', async (req, res) => {
  const { username, password } = req.body;
  if (username === 'admin' && password === 'admin123') {
    try {
      const adminRef = db.collection('admins').doc('TtWSX5YYUMyfgilpmn6Y');
      const adminDoc = await adminRef.get();

      if (!adminDoc.exists) {
        return res.status(404).json({ error: "Admin not found in Firestore" });
      }

      const lastLoginRaw = adminDoc.data().last_login;
      let lastLoginDate = lastLoginRaw?.toDate ? lastLoginRaw.toDate() : new Date(0);

      const currentLoginTimestamp = firebase.firestore.Timestamp.now();
      await adminRef.update({ last_login: currentLoginTimestamp });

      const complaintsSnapshot = await db.collection('complaints')
        .where('status', '==', 'uncleared')
        .get();

      const newComplaints = [];
      complaintsSnapshot.forEach(doc => {
        const data = doc.data();
        const complaintDate = data.timestamp?.toDate?.();
        if (complaintDate > lastLoginDate) newComplaints.push(data);
      });

      res.json({ success: true, newComplaints });
    } catch (error) {
      console.error("Admin login error:", error);
      res.status(500).json({ error: "Something went wrong" });
    }
  } else {
    res.status(401).json({ success: false, message: "Invalid credentials" });
  }
});

// === Handle Complaint Form (with file upload) ===
app.post('/handleform', upload.single('file'), async (req, res) => {
  const { category, description, sname, email } = req.body;
  const timestamp = firebase.firestore.Timestamp.now();

  try {
    const counterDocRef = db.collection('counters').doc('complaintId');
    const counterDoc = await counterDocRef.get();

    if (!counterDoc.exists) await counterDocRef.set({ counter: 1001 });
    const currentCounter = counterDoc.data().counter;

    const complaintId = currentCounter;
    await counterDocRef.update({ counter: currentCounter + 1 });

    const fileUrl = req.file ? req.file.path : null;

    await db.collection('complaints').doc(complaintId.toString()).set({
      complaintId,
      category,
      description,
      filepath: fileUrl,
      sname,
      email,
      status: 'uncleared',
      timestamp
    });

    res.json({ success: true });
  } catch (err) {
    console.error("Error storing complaint:", JSON.stringify(err, null, 2));
    res.status(500).json({ success: false, message: "Registration unsuccessful" });
  }
});

// === Suggestion Form ===
app.post('/suggestform', upload.none(), async (req, res) => {
  const { name, suggestcol } = req.body;
  if (!name || !suggestcol) {
    return res.status(400).json({ success: false, message: 'Name and suggestion are required.' });
  }
  try {
    await db.collection('suggest').add({ name, suggestcol });
    res.json({ success: true });
  } catch (err) {
    console.error("Error storing suggestion:", err);
    res.status(500).json({ success: false, message: 'Registration unsuccessful' });
  }
});

// === Fetch Complaints ===
app.get('/fetch-complaints', async (req, res) => {
  try {
    const snapshot = await db.collection('complaints').get();
    const complaints = snapshot.docs.map(doc => doc.data());
    res.json({ success: true, complaints });
  } catch (err) {
    console.error("Error fetching complaints:", err);
    res.status(500).json({ success: false, message: "Failed to fetch complaints" });
  }
});

// === Fetch Suggestions ===
app.get('/fetch-suggestions', async (req, res) => {
  try {
    const snapshot = await db.collection('suggest').get();
    const suggestions = snapshot.docs.map(doc => doc.data());
    res.json({ success: true, suggestions });
  } catch (err) {
    console.error("Error fetching suggestions:", err);
    res.status(500).json({ success: false, message: "Failed to fetch suggestions" });
  }
});
app.put('/update-status', async (req, res) => {
  const { complaintId, status } = req.body;
  try {
    const complaintRef = db.collection('complaints').doc(complaintId.toString());
    const complaintDoc = await complaintRef.get();

    if (!complaintDoc.exists) return res.status(404).json({ success: false, message: "Complaint not found" });

    await complaintRef.update({ status });

    if (status === 'cleared') {
      const student = complaintDoc.data();
      if (student?.email && student?.sname) {
        transporter.sendMail({
          from: process.env.EMAIL_USER,
          to: student.email,
          subject: 'Your Complaint Has Been Resolved',
          text: `Dear ${student.sname},\n\nYour complaint has been successfully marked as cleared.\n\n` +
                `You can view the update or attachment here: ${student.updatedfile ? student.updatedfile : "No update available."}\n\n` +
                `Thank you for bringing this to our attention. We appreciate your patience.\n\nBest regards,\nVignan's College Complaint Management Team`
        }, (error, info) => {
          if (error) {
            console.error("Email error:", error);
          } else {
            console.log("Email sent:", info.response);
          }
        });
      }
    }
    res.json({ success: true, message: "Status updated successfully" });
  } catch (error) {
    console.error("Error updating status:", error);
    res.status(500).json({ success: false, message: "Failed to update status" });
  }
});

app.delete('/delete-complaint', async (req, res) => {
  const { complaintId } = req.body;

  if (!complaintId) return res.status(400).send("Complaint ID is required");

  try {
    const complaintRef = db.collection('complaints').doc(complaintId.toString());
    const complaintDoc = await complaintRef.get();

    if (!complaintDoc.exists) {
      return res.status(404).send("Complaint not found");
    }

    await complaintRef.delete();
    res.send("Complaint deleted successfully");
  } catch (error) {
    console.error("Error deleting complaint:", error);
    res.status(500).send("Failed to delete complaint");
  }
});
app.post('/update-remark', async (req, res) => {
  const { complaintId, remarks } = req.body;
  try {
    await db.collection('complaints').doc(complaintId).update({ remarks });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update remarks' });
  }
});

app.post('/update-status-with-image', upload.single('image'), async (req, res) => {
  try {
    const { complaintId, status } = req.body;
    const file = req.file;

    if (!complaintId || !status || !file) {
      return res.status(400).json({ success: false, message: 'Missing required fields.' });
    }

    const fileUrl = file.path; // Cloudinary URL

    await db.collection('complaints').doc(complaintId).update({
      status,
      updatedfile: fileUrl,
      updatedAt: new Date().toISOString(),
    });

    res.status(200).json({ success: true, message: 'Status and image updated successfully.', fileUrl });
  } catch (error) {
    console.error('Error updating status with image:', error);
    res.status(500).json({ success: false, message: 'Internal server error.' });
  }
});
const PORT = process.env.PORT || 4348;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
