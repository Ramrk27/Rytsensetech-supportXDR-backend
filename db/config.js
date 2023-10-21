// const mongoose = require("mongoose");
// mongoose.connect("mongodb://localhost:27017/browser-extension");

const mysql = require('mysql2')
const con = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'sidhu7sid@123',
    database: 'extension',
    port : 3306
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