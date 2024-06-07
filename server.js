//create an express instance 
const app = require('express')();

//create a rate_limit middleware
const rate_limit = require('express-rate-limit'); 

//import the signup route
const SignupRoute = require('./api/signup');
//import the signin route
const SigninRoute = require('./api/signinRoute')

//import the password reset Router
const PasswordResetRoute = require('./api/PasswordReset');

//import the database.js file
require('./config/database')

//create a port that your application will run on
const port = 9090;

//Use bodyParser to let your application accept json data from client side.
const bodyParser = require('express').json;

let limiter = rate_limit({
    //create a maximum attempt amount
    max: 3,
     
    //Add the wait period in milliseconds after maximum attempts
    windowMs: 5000,

    //Add an error message
    message: "We recieved a lot of requests from this IP address, Please come back after 1 hour and retry"
})

//use your rate limiter in the signin route
app.use('/user/signin', limiter);

app.use(bodyParser());

//use the signup route to create a signup route for your server.
app.use('/user', SignupRoute)

//use the signin route to create a login route for your server.
app.use('/user', SigninRoute)

//use the password reset router to create a route for forgot password
app.use('/user', PasswordResetRoute)

//run your application on the port that you created.
app.listen(port, ()=>{
    console.log(`Server is running on localhost:${port}`);
});