require('dotenv').config();

//import the mongoose library
const mongoose = require('mongoose');

//connect to your mongoDB cluster
mongoose.connect(process.env.MONGODB_URI).then(() => {
    console.log("Connection to Database was Successful !")
}).catch((err) => console.log(err));