require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const mysql2 = require('mysql2');
const cors = require('cors'); 
const multer = require('multer');
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
app.use(express.static(path.join(__dirname, 'public')));

// Multer storage configuration
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 } // Limit to 5 MB
});


// Serve static files and HTML pages
app.get('/', (req, res) => {
    const htmlfile = path.join(__dirname, 'public', 'index.html');
    res.sendFile(htmlfile, (err) => {
        if (err) {
            console.error(err);
            res.status(err.status).end();
        }
    });
});

// Other static page routes
['cc', 'aboutus', 'contact', 'privacy', 'terms', 'home', 'suggest', 'display'].forEach(route => {
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


app.post('/handleform', upload.single('filepath'), (req, res) => {
    try {
        const { category, description, sname } = req.body; // Extract text fields
        const fileBuffer = req.file?.buffer || null; // Optional file upload

        console.log("Form Data:", req.body); // Debugging
        console.log("Uploaded File:", req.file); // Debugging

        const SQL_COMMAND = "INSERT INTO complaints (category, description, filepath, sname, status) VALUES (?, ?, ?, ?, 'uncleared')";
        pool.query(SQL_COMMAND, [category, description, fileBuffer, sname], (err, result) => {
            if (err) {
                console.error("SQL error:", err); // Log SQL errors
                return res.status(500).send("Registration unsuccessful");
            }
            console.log("SQL Result:", result); // Debugging

            // Send success page
            const successFile = path.join(__dirname, 'public', 'success.html');
            return res.sendFile(successFile);
        });
    } catch (err) {
        console.error("Server error:", err); // Log server errors
        res.status(500).send("An error occurred");
    }
});



// Handle suggestion form submissions
app.post('/suggestform', (req, res) => {
    try {
        const { name, suggestcol } = req.body;
        const SQL_COMMAND = "INSERT INTO suggest (name, suggestcol) VALUES (?, ?)";
        pool.query(SQL_COMMAND, [name, suggestcol], (err, result) => {
            if (err) {
                console.error(err);
                return res.send("Registration unsuccessful");
            }
            console.log(result);

            const successFile = path.join(__dirname, 'public', 'thank.html');
            return res.sendFile(successFile);
        });
    } catch (err) {
        console.error(err);
    }
});

// Fetch all complaints
app.get('/fetch-complaints', (req, res) => {
    const SQL_COMMAND = "SELECT category, description, status, filepath FROM complaints";
    pool.query(SQL_COMMAND, (err, results) => {
        if (err) {
            console.error(err);
            return res.status(500).send("Failed to fetch complaints");
        }
        res.json(results); // Send complaints to the frontend
    });
});
app.get('/fetch-image', (req, res) => {
    const { category, description } = req.query;

    if (!category || !description) {
        return res.status(400).send("Missing required fields: category or description.");
    }

    const SQL_COMMAND = "SELECT filepath FROM complaints WHERE category = ? AND description = ?";
    pool.query(SQL_COMMAND, [category, description], (err, results) => {
        if (err) {
            console.error("Error fetching image:", err);
            return res.status(500).send("Failed to fetch image.");
        }

        if (results.length > 0 && results[0].filepath) {
            const imageBuffer = results[0].filepath;
            res.setHeader('Content-Type', 'image/jpeg'); // Default to JPEG (adjust as needed)
            return res.end(imageBuffer); // Serve image directly as binary
        } else {
            res.status(404).send("Image not found.");
        }
    });
});

// Fetch all suggestions
app.get('/fetch-suggestions', (req, res) => {
    const SQL_COMMAND = "SELECT name, suggestcol FROM suggest";
    pool.query(SQL_COMMAND, (err, results) => {
        if (err) {
            console.error(err);
            return res.status(500).send("Failed to fetch suggestions");
        }
        res.json(results); // Send suggestions to the frontend
    });
});

// Update complaint status (cleared or uncleared)
app.put('/update-status', (req, res) => {
    const { category, description, status } = req.body;

    if (!category || !description || !status) {
        return res.status(400).send("Missing required fields: category, description, or status.");
    }

    const SQL_COMMAND = "UPDATE complaints SET status = ? WHERE category = ? AND description = ?";
    pool.query(SQL_COMMAND, [status, category, description], (err, result) => {
        if (err) {
            console.error("Error executing query:", err);
            return res.status(500).send("Failed to update complaint status.");
        }

        if (result.affectedRows === 0) {
            console.error("No rows updated. Check your query conditions.");
            return res.status(404).send("No matching complaint found.");
        }

        res.send("Complaint status successfully updated.");
    });
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

// Start the server
const PORT = process.env.PORT || 4348;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
