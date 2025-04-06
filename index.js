require('dotenv').config();
const express = require('express');
const path = require('path');
const multer = require('multer');
const nodemailer = require('nodemailer');
const cors = require('cors');
const bodyParser = require('body-parser');
const firebase = require('firebase-admin');
const app = express();

const serviceAccount = require('./serviceAccountKey.json');
firebase.initializeApp({
  credential: firebase.credential.applicationDefault(),
  projectId: 'complaint-portal-b7394',  
});

const db = firebase.firestore();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }
});

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
app.post('/handleform', async (req, res) => {
  const { category, description, sname, email } = req.body;  // Extract the data from the request body
  const timestamp = firebase.firestore.Timestamp.now();

  // Check if all required fields are present
  if (!category || !description || !sname || !email) {
    return res.status(400).json({ success: false, message: 'All fields are required.' });
  }

  try {
    const counterDocRef = db.collection('counters').doc('complaintId');
    const counterDoc = await counterDocRef.get();

    // Initialize counter if it doesn't exist
    if (!counterDoc.exists) await counterDocRef.set({ counter: 1001 });
    const currentCounter = counterDoc.data().counter;

    const complaintId = currentCounter;
    await counterDocRef.update({ counter: currentCounter + 1 });

    // Save complaint data to Firestore
    await db.collection('complaints').doc(complaintId.toString()).set({
      complaintId,
      category,
      description,
      sname,
      email,
      status: 'uncleared',
      timestamp
    });

    res.json({ success: true });  // Send success response
  } catch (err) {
    console.error("Error storing complaint:", err);
    res.status(500).json({ success: false, message: "Registration unsuccessful" });
  }
});

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
    // Get reference to the complaint document
    const complaintRef = db.collection('complaints').doc(complaintId.toString());
    const complaintDoc = await complaintRef.get();

    if (!complaintDoc.exists) {
      return res.status(404).send("Complaint not found");
    }

    // Update the complaint status
    await complaintRef.update({ status });

    // If the complaint is marked as "cleared", send an email
    if (status === 'cleared') {
      const student = complaintDoc.data();
      if (student?.email && student?.sname) {
        transporter.sendMail({
          from: process.env.EMAIL_USER,
          to: student.email,
          subject: 'Complaint Cleared',
          text: `Dear ${student.sname}, your complaint has been marked as cleared.`,
        }, (error) => {
          if (error) {
            console.error("Email error:", error);
          }
        });
      }
    }

    res.send("Status updated successfully");
  } catch (error) {
    console.error("Error updating status:", error);
    res.status(500).send("Failed to update status");
  }
});

const PORT = process.env.PORT || 4348;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
