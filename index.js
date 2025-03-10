const express=require('express')
const path=require('path');
const fs = require('fs');
const mysql2=require('mysql2')
const app=express();

const database=mysql2.createConnection({
    host:"127.0.0.1",
    user:"root",
    password:"kiranprasad@123",
    database:"college_complaints"
});
database.connect((error)=>{
    if(error){
        return console.error(error)
    }
    console.log("mysql is kiran")
})
app.use(express.urlencoded({extended:true}))
app.use(express.static(path.join(__dirname, 'public'))); 

app.get('/', (req, res) => {
    const htmlfile = path.join(__dirname,'public','index.html');
    console.log(`Serving file: ${htmlfile}`);
    res.sendFile(htmlfile, (err) => {
        if (err) {
            console.error(err);
            res.status(err.status).end();
        }
    });
});

app.get('/cc', (req, res) => {
    const htmlfile = path.join(__dirname, 'public', 'cc.html'); 
    console.log(`Serving file: ${htmlfile}`);
    
    // Check if the file exists
    fs.access(htmlfile, fs.constants.F_OK, (err) => {
        if (err) {
            console.error(`File ${htmlfile} not found`);
            return res.status(404).send('File not found');
        }
        res.sendFile(htmlfile, (err) => {
            if (err) {
                console.error(err);
                res.status(err.status).end();
            }
        });
    });
});

app.get('/aboutus', (req, res) => {
    const htmlfile = path.join(__dirname, 'public', 'aboutus.html');
    console.log(`Serving file: ${htmlfile}`);
    
    // Check if the file exists
    fs.access(htmlfile, fs.constants.F_OK, (err) => {
        if (err) {
            console.error(`File ${htmlfile} not found`);
            return res.status(404).send('File not found');
        }
        res.sendFile(htmlfile, (err) => {
            if (err) {
                console.error(err);
                res.status(err.status).end();
            }
        });
    });
});
app.get('/contact', (req, res) => {
    const htmlfile = path.join(__dirname, 'public', 'contact.html'); // Ensure 'public' folder exists
    console.log(`Serving file: ${htmlfile}`);
    
    // Check if the file exists
    fs.access(htmlfile, fs.constants.F_OK, (err) => {
        if (err) {
            console.error(`File ${htmlfile} not found`);
            return res.status(404).send('File not found');
        }
        res.sendFile(htmlfile, (err) => {
            if (err) {
                console.error(err);
                res.status(err.status).end();
            }
        });
    });
});
app.get('/privacy', (req, res) => {
    const htmlfile = path.join(__dirname, 'public', 'privacy.html'); // Ensure 'public' folder exists
    console.log(`Serving file: ${htmlfile}`);
    
    // Check if the file exists
    fs.access(htmlfile, fs.constants.F_OK, (err) => {
        if (err) {
            console.error(`File ${htmlfile} not found`);
            return res.status(404).send('File not found');
        }
        res.sendFile(htmlfile, (err) => {
            if (err) {
                console.error(err);
                res.status(err.status).end();
            }
        });
    });
});
app.get('/terms', (req, res) => {
    const htmlfile = path.join(__dirname, 'public', 'terms.html'); // Ensure 'public' folder exists
    console.log(`Serving file: ${htmlfile}`);
    
    // Check if the file exists
    fs.access(htmlfile, fs.constants.F_OK, (err) => {
        if (err) {
            console.error(`File ${htmlfile} not found`);
            return res.status(404).send('File not found');
        }
        res.sendFile(htmlfile, (err) => {
            if (err) {
                console.error(err);
                res.status(err.status).end();
            }
        });
    });
});
app.get('/home', (req, res) => {
    const htmlfile = path.join(__dirname, 'public', 'home.html'); // Ensure 'public' folder exists
    console.log(`Serving file: ${htmlfile}`);
    
    // Check if the file exists
    fs.access(htmlfile, fs.constants.F_OK, (err) => {
        if (err) {
            console.error(`File ${htmlfile} not found`);
            return res.status(404).send('File not found');
        }
        res.sendFile(htmlfile, (err) => {
            if (err) {
                console.error(err);
                res.status(err.status).end();
            }
        });
    });
});

app.get('/suggest', (req, res) => {
    const htmlfile = path.join(__dirname, 'public', 'suggest.html'); // Ensure 'public' folder exists
    console.log(`Serving file: ${htmlfile}`);
    
    // Check if the file exists
    fs.access(htmlfile, fs.constants.F_OK, (err) => {
        if (err) {
            console.error(`File ${htmlfile} not found`);
            return res.status(404).send('File not found');
        }
        res.sendFile(htmlfile, (err) => {
            if (err) {
                console.error(err);
                res.status(err.status).end();
            }
        });
    });
});

app.post('/handleform',(req,res) =>{
 try {
    const {category,description,file,sname}=req.body
    const SQL_COMMAND = "INSERT INTO complaints (category,description,file,sname) VALUES (?,?,?,?)"
    database.query(SQL_COMMAND,[category,description,file,sname],(err,result)=>{
        if(err){
            console.error(err);
            return res.send("registration unsucesfull")
        }
        console.log(result);
        const successFile = path.join(__dirname, 'success.html');
        return res.sendFile(successFile);
        //return res.send("registration sucesfull")
    })
 }
 catch(err){
    console.error(err);
 }
})
app.listen(4348,() =>{
    console.log("server kiran prasad ")
})
const kiran=mysql2.createConnection({
    host:"127.0.0.1",
    user:"root",
    password:"kiranprasad@123",
    database:"college_complaints"
});
kiran.connect((error)=>{
    if(error){
        return console.error(error)
    }
    console.log("mysql is kiran")
})
app.post('/suggestform',(req,res) =>{
    try {
       const {name,suggestcol}=req.body
       const SQL_COMMAND = "INSERT INTO suggest (name,suggestcol) VALUES (?,?)"
       kiran.query(SQL_COMMAND,[name,suggestcol],(err,result)=>{
           if(err){
               console.error(err);
               return res.send("registration unsucesfull")
           }
           console.log(result);
           const successFile = path.join(__dirname, 'thank.html');
           return res.sendFile(successFile);
           //return res.send("registration sucesfull")
       })
    }
    catch(err){
       console.error(err);
    }
   })

   app.get('/fetch-complaints', (req, res) => {
    const SQL_COMMAND = "SELECT * FROM complaints";
    database.query(SQL_COMMAND, (err, results) => {
        if (err) {
            console.error(err);
            return res.status(500).send("Failed to fetch complaints");
        }
        res.json(results);
    });
});

app.get('/fetch-suggestions', (req, res) => {
    const SQL_COMMAND = "SELECT * FROM suggest";
    kiran.query(SQL_COMMAND, (err, results) => {
        if (err) {
            console.error(err);
            return res.status(500).send("Failed to fetch suggestions");
        }
        res.json(results);
    });
});

app.get('/display', (req, res) => {
    const htmlfile = path.join(__dirname, 'public', 'display.html');
    console.log(`Serving file: ${htmlfile}`);
    res.sendFile(htmlfile, (err) => {
        if (err) {
            console.error(err);
            res.status(err.status).end();
        }
    });
});
