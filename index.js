require('dotenv').config();
const express = require('express');
const path = require('path');
const mysql2 = require('mysql2');
const cors = require('cors');
const multer = require('multer');
const nodemailer = require('nodemailer');
const app = express();

// Database connection pool
const pool = mysql2.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 50,
    queueLimit: 0
});

// Middleware setup
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Multer storage configuration
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 } // Limit to 5 MB
});

// Email transporter setup
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

// Routes
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'main.html')));
app.use(express.static(path.join(__dirname, 'public')));
['cc', 'aboutus', 'contact', 'home', 'privacy', 'terms', 'index', 'suggest', 'display'].forEach(route => {
    app.get(`/${route}`, (req, res) => res.sendFile(path.join(__dirname, 'public', `${route}.html`)));
});

// Admin Login
app.post('/admin-login', (req, res) => {
    const { username, password } = req.body;
    if (username === 'admin' && password === 'admin123') {
        const currentTime = new Date().toISOString().slice(0, 19).replace('T', ' ');

        pool.getConnection((err, connection) => {
            if (err) return res.status(500).json({ error: "Database connection error" });

            connection.query("SELECT last_login FROM admins WHERE username = ?", [username], (err, results) => {
                if (err) {
                    connection.release();
                    return res.status(500).json({ error: "Database error" });
                }

                const lastLogin = results.length > 0 ? results[0].last_login : null;
                connection.query("UPDATE admins SET last_login = ? WHERE username = ?", [currentTime, username], (err) => {
                    if (err) {
                        connection.release();
                        return res.status(500).json({ error: "Update error" });
                    }

                    connection.query("SELECT category, description, status, sname, timestamp FROM complaints WHERE timestamp > ? AND status = 'uncleared'", [lastLogin || '1970-01-01'], (err, complaints) => {
                        connection.release();
                        if (err) return res.status(500).json({ error: "Error fetching complaints" });

                        res.json({ success: true, newComplaints: complaints });
                    });
                });
            });
        });
    } else {
        res.status(401).json({ success: false, message: "Invalid credentials" });
    }
});

// Handle Complaint Form
app.post('/handleform', upload.single('filepath'), (req, res) => {
    const { category, description, sname, email } = req.body;
    const fileBuffer = req.file?.buffer || null;
    const timestamp = new Date().toISOString().slice(0, 19).replace('T', ' ');

    pool.getConnection((err, connection) => {
        if (err) return res.status(500).send("Database connection error");

        connection.query("INSERT INTO complaints (category, description, filepath, sname, email, status, timestamp) VALUES (?, ?, ?, ?, ?, 'uncleared', ?)", 
            [category, description, fileBuffer, sname, email, timestamp], 
            (err) => {
                connection.release();
                if (err) return res.status(500).send("Registration unsuccessful");
                res.sendFile(path.join(__dirname, 'public', 'success.html'));
            }
        );
    });
});

// Suggestion Form
app.post('/suggestform', (req, res) => {
    const { name, suggestcol } = req.body;

    pool.getConnection((err, connection) => {
        if (err) return res.status(500).send("Database connection error");

        connection.query("INSERT INTO suggest (name, suggestcol) VALUES (?, ?)", [name, suggestcol], (err) => {
            connection.release();
            if (err) return res.status(500).send("Registration unsuccessful");
            res.sendFile(path.join(__dirname, 'public', 'thank.html'));
        });
    });
});

// Fetch Complaints
app.get('/fetch-complaints', (req, res) => {
    pool.getConnection((err, connection) => {
        if (err) return res.status(500).send("Database connection error");

        connection.query("SELECT category, description, status, filepath FROM complaints", (err, results) => {
            connection.release();
            if (err) return res.status(500).send("Failed to fetch complaints");
            res.json(results);
        });
    });
});

// Update Complaint Status
app.put('/update-status', (req, res) => {
    const { category, description, status } = req.body;

    pool.getConnection((err, connection) => {
        if (err) return res.status(500).send("Database connection error");

        connection.query("UPDATE complaints SET status = ? WHERE category = ? AND description = ?", [status, category, description], (err, result) => {
            if (err) {
                connection.release();
                return res.status(500).send("Failed to update status");
            }

            if (status === 'cleared') {
                connection.query("SELECT sname, email FROM complaints WHERE category = ? AND description = ?", [category, description], (err, results) => {
                    if (err) {
                        connection.release();
                        return res.status(500).send("Error fetching email");
                    }

                    const student = results[0];
                    if (student) {
                        transporter.sendMail({
                            from: process.env.EMAIL_USER,
                            to: student.email,
                            subject: 'Complaint Cleared',
                            text: `Dear ${student.sname}, your complaint has been marked as cleared.`
                        }, (error) => {
                            if (error) console.error("Email error:", error);
                        });
                    }
                    connection.release();
                });
            } else {
                connection.release();
            }

            res.send("Status updated successfully");
        });
    });
});

app.get('/fetch-suggestions', (req, res) => {
    const SQL_COMMAND = "SELECT name, suggestcol FROM suggest";

    pool.getConnection((err, connection) => {
        if (err) return res.status(500).json({ error: "Database connection error" });

        connection.query(SQL_COMMAND, (err, results) => {
            connection.release();
            if (err) {
                console.error("Error fetching suggestions:", err);
                return res.status(500).json({ error: "Failed to fetch suggestions" });
            }
            res.json(results); // Send suggestions to the frontend
        });
    });
});

// Start the server
const PORT = process.env.PORT || 4348;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
