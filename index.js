require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
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
    connectionLimit: 10,
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

app.get('/', (req, res) => {
    console.log('Serving main.html');
    const htmlfile = path.join(__dirname, 'public', 'main.html');
    res.sendFile(htmlfile, (err) => {
        if (err) {
            console.error(err);
            res.status(err.status).end();
        }
    });
});

app.use(express.static(path.join(__dirname, 'public')));
// Other static page routes
['cc', 'aboutus', 'contact', 'home', 'privacy', 'terms', 'index', 'suggest', 'display'].forEach(route => {
    app.get(`/${route}`, (req, res) => {
        const htmlfile = path.join(__dirname, 'public', `${route}.html`);
        res.sendFile(htmlfile, (err) => {
            if (err) {
                console.error(err);
                res.status(err.status).end();
            }
        });
    });
});

app.post('/admin-login', async (req, res) => {
    const { username, password } = req.body;
    console.log('Login attempt:', username);

    // Hardcoded credentials for admin login
    const validUsername = 'admin';
    const validPassword = 'admin123';

    // Check if the provided username and password match the hardcoded credentials
    if (username === validUsername && password === validPassword) {
        const currentTime = new Date().toISOString().slice(0, 19).replace('T', ' ');  // Convert to 'YYYY-MM-DD HH:mm:ss'
        console.log('Login successful. Current login time:', currentTime);

        try {
            const [results] = await pool.promise().query("SELECT last_login FROM admins WHERE username = ?", [username]);
            const lastLogin = results.length > 0 ? results[0].last_login : null;
            console.log('Last login time:', lastLogin);

            await pool.promise().query("UPDATE admins SET last_login = ? WHERE username = ?", [currentTime, username]);
            console.log("Last login updated successfully!");

            // Fetch new complaints after the last login time
            const [complaints] = await pool.promise().query(`
                SELECT category, description, status, sname, timestamp
                FROM complaints
                WHERE timestamp > ? AND status = 'uncleared'
            `, [lastLogin || '1970-01-01']);
            
            console.log('New complaints count:', complaints.length);

            // Send response back to frontend with the new complaints
            res.json({
                success: true,
                newComplaints: complaints || [],
                redirect: '/index'  // Redirecting after login
            });

        } catch (err) {
            console.error('Error:', err);
            res.status(500).json({ error: "Server error occurred during admin login." });
        }
    } else {
        console.log('Invalid username or password');
        res.status(401).json({ success: false, message: "Invalid username or password" });
    }
});

app.post('/handleform', upload.single('filepath'), async (req, res) => {
    try {
        const { category, description, sname, email } = req.body;
        const fileBuffer = req.file?.buffer || null;

        // Convert ISO 8601 format to MySQL compatible format (YYYY-MM-DD HH:MM:SS.sss)
        const timestamp = new Date().toISOString().slice(0, 19).replace('T', ' ');

        const [result] = await pool.promise().query(`
            INSERT INTO complaints (category, description, filepath, sname, email, status, timestamp)
            VALUES (?, ?, ?, ?, ?, 'uncleared', ?)
        `, [category, description, fileBuffer, sname, email, timestamp]);

        const successFile = path.join(__dirname, 'public', 'success.html');
        res.sendFile(successFile);
    } catch (err) {
        console.error("Server error:", err);
        res.status(500).send("An error occurred");
    }
});

app.post('/suggestform', async (req, res) => {
    try {
        const { name, suggestcol } = req.body;

        const [result] = await pool.promise().query("INSERT INTO suggest (name, suggestcol) VALUES (?, ?)", [name, suggestcol]);

        console.log(result);
        const successFile = path.join(__dirname, 'public', 'thank.html');
        res.sendFile(successFile);
    } catch (err) {
        console.error(err);
        res.send("Registration unsuccessful");
    }
});

// Fetch all complaints
app.get('/fetch-complaints', async (req, res) => {
    try {
        const [results] = await pool.promise().query(`
            SELECT category, description, status, filepath
            FROM complaints
            LIMIT 50
        `);
        res.json(results); // Send complaints to the frontend
    } catch (err) {
        console.error(err);
        res.status(500).send("Failed to fetch complaints");
    }
});

app.get('/fetch-image', async (req, res) => {
    const { category, description } = req.query;

    if (!category || !description) {
        return res.status(400).send("Missing required fields: category or description.");
    }

    try {
        const [results] = await pool.promise().query("SELECT filepath FROM complaints WHERE category = ? AND description = ?", [category, description]);

        if (results.length > 0 && results[0].filepath) {
            const imageBuffer = results[0].filepath;
            res.setHeader('Content-Type', 'image/jpeg'); // Default to JPEG (adjust as needed)
            return res.end(imageBuffer); // Serve image directly as binary
        } else {
            res.status(404).send("Image not found.");
        }
    } catch (err) {
        console.error("Error fetching image:", err);
        return res.status(500).send("Failed to fetch image.");
    }
});

// Fetch all suggestions
app.get('/fetch-suggestions', async (req, res) => {
    try {
        const [results] = await pool.promise().query("SELECT name, suggestcol FROM suggest");
        res.json(results); // Send suggestions to the frontend
    } catch (err) {
        console.error(err);
        res.status(500).send("Failed to fetch suggestions");
    }
});

let transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    tls: {
        rejectUnauthorized: false
    },
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

app.put('/update-status', async (req, res) => {
    const { category, description, status } = req.body;

    if (!category || !description || !status) {
        return res.status(400).send("Missing required fields: category, description, or status.");
    }

    try {
        const [existing] = await pool.promise().query("SELECT * FROM complaints WHERE category = ? AND description = ?", [category, description]);

        if (existing.length === 0) {
            return res.status(404).send("Complaint not found.");
        }

        if (existing[0].status === status) {
            return res.send("No change in status.");
        }

        await pool.promise().query("UPDATE complaints SET status = ? WHERE category = ? AND description = ?", [status, category, description]);

        if (status === 'cleared') {
            const [studentResult] = await pool.promise().query("SELECT sname, email FROM complaints WHERE category = ? AND description = ?", [category, description]);

            if (studentResult.length > 0) {
                const student = studentResult[0];
                const mailOptions = {
                    from: process.env.EMAIL_USER,
                    to: student.email,
                    subject: 'Complaint Status Update',
                    text: `Dear ${student.sname},\n\nYour complaint regarding the category "${category}" has been marked as cleared. Thank you for your patience!\n\nBest regards,\nYour Support Team`,
                };

                transporter.sendMail(mailOptions, (error, info) => {
                    if (error) {
                        console.error("Error sending email:", error);
                    } else {
                        console.log("Email sent:", info.response);
                    }
                });
            } else {
                console.log("Student email not found.");
            }
        }

        res.send("Complaint status successfully updated.");
    } catch (err) {
        console.error("Error updating status:", err);
        res.status(500).send("Failed to update complaint status.");
    }
});

// Serve display page for complaints and suggestions
app.get('/display', (req, res) => {
    const htmlfile = path.join(__dirname, 'public', 'display.html');
    res.sendFile(htmlfile, (err) => {
        if (err) {
            console.error(err);
            res.status(err.status).end();
        }
    });
});

const PORT = process.env.PORT || 4348;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
