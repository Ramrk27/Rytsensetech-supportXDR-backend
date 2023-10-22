// const mongoose = require("mongoose");
// mongoose.connect("mongodb://localhost:27017/browser-extension");

require('dotenv').config('../.env')
const mysql = require('mysql2')
const con = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    // port : 3306
});
con.connect((err) => {
    if(err){
        console.log(err);
        console.log("error is connection")
    }else{
        console.log("Connected")
    }
}); 
module.exports =con;