const express = require('express');

//import uuid
const {v4: uuidv4} = require('uuid');

//import bcrypt
const bcrypt = require('bcrypt');

//import dotenv package so that you can access the .env file
require('dotenv').config();

//import nodemailer
const nodemailer = require('nodemailer');

//import the User model from the models folder. The User model was created in the last two videos
const User = require('../models/Usermodels');

//import the password reset model
const PasswordReset = require('../models/Passwordresetmodel');

//create the nodemailer transporter
const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        //these variables were created in the .env file in the last two videos
        user: process.env.AUTH_EMAIL,
        pass: process.env.AUTH_PASS
    }
})

//verify the transport is working
transporter.verify((error, success) => {
    if(error) {
        //the transporter is not working
        console.log(error)
    }else {
        //the transporter is working
        console.log('Password reset Transporter is ready for messaging!')
        console.log(success)
    }
})

const passwordResetRouter = express.Router();

passwordResetRouter.post("/forgotpassword", (req, res) => {
    //we will use an email property to send the password reset message to the user and a redirect url will be attached to it, so destructure them
    const {email, redirectUrl} = req.body;

    //check if the provided email is valid
    User.find({email})
        .then((data) => {
            if(data.length){
                //the user exists, therefore check if the provided email address is verified.
                //In the past two videos I thought how to set up email verification in Nodejs
                if(!data[0].verified){
                    res.json({
                        status: "FAILED",
                        message: "You are yet to verify your email address!"
                    }) 
                }else {
                    //user email is verified so continue with the password resetting process 
                    sendPasswordResetEmail(data[0], redirectUrl, res)
                }
            }else {
                //user does not exist
                res.json({
                    status: "FAILED",
                    message: "No account matches the provided email address!"
                })
            }
        })
        .catch(error => {
            console.log(error);
            res.json({
                status: "FAILED",
                message: "An error occured while checking if the email address is valid!"
            })
        })
})

//create a function that will be responsible for sending the password reset email to the user
const sendPasswordResetEmail = ({_id, email}, redirectUrl, res) => {
    
    //Generate a password reset string that will defferentiate each user
    const passwordResetString = uuidv4() + _id;

    //Do user might make several password reset requests at the same, may be due to mistake
    //so clear all old password reset requests whenever a new one is made.
    PasswordReset.deleteMany({userId:_id})
        .then(result => {
            //send the password reset email

            //create a mailOptions object that will contian information about where to send the email to, the address that will send the email
            //the email subject and the message body
            const mailOptions = {
                //This is the address that will send the reset email. This variable was created inside the .env file in the last two videos. 
                //check them out in the description below
                from: process.env.AUTH_EMAIL,
                //This will be the email address that will recieve the message. It will be gotten from the request body.
                to: email,
                //This is the email subject
                subject: "Password Reset",
                //This is the body of the email
                html: `<p>Use this <a href=${redirectUrl + "/" + _id + "/" + passwordResetString}>link</a> to reset your password.</p><p>This link will expire in 60 minutes</p>`
            }
            //hash the password Reset string
            const saltRounds = 10
            bcrypt.hash(passwordResetString, saltRounds)
                .then(hashedPasswordResetString => {
                    //Create a new password reset record, with the same properties that were created in the passwordReset model
                    const newPasswordResetRecord = new PasswordReset({
                        userId: _id,
                        passwordResetString: hashedPasswordResetString,
                        //the createdAt property will be the current time
                        createdAt: Date.now(),
                        //the expiresAt property will be 60 minutes in miliseconds plus the current time, since the link is expected to expire after 60 minutes
                        expiresAt: Date.now() + 3600000
                    });

                    //save the new password reset record
                    newPasswordResetRecord.save()
                        .then(() => {
                            //send the email with nodemailer transporter
                            transporter.sendMail(mailOptions)
                                .then(() => {
                                    //while sending the mai, set the status to PENDING. This is because the process of setting a new password is not yet complete
                                    res.json({
                                        status: "PENDING",
                                        message: "Password reset email sent!"
                                    })
                                })
                                .catch(error => {
                                    console.log(error);
                                    res.json({
                                        status: "FAILED",
                                        message: "Could not send password reset mail!"
                                    })
                                })
                        })
                        .catch(error => {
                            console.log(error);
                            res.json({
                                status: "FAILED",
                                message: "Could not save new password request. Please try again"
                            })
                        })
                })
                .catch(error => {
                    console.log(error);
                    res.json({
                        status: "FAILED",
                        message: "An error occured! It is not your fault. Please try again"
                    })
                })
        })
        .catch(error => {
            console.log(error)
            res.json({
                status: "FAILED",
                message: "Failed to clear all old password reset requests!"
            })
        })

}

//create another route. This route will be for resetting the password. The former one was for requesting a reset.
passwordResetRouter.post("/resetpassword", (req, res) => {
    //this route will collect userId, password reset string and a new password properties from the use, through the request body.
    //So destructure these properties
    let {userId, passwordResetString, newPassword} = req.body;

    //check if the provided userId exists
    PasswordReset.find({userId})
        .then(result => {
            if(result.length > 0){
                //userId is valid
                //check if the request have not expired
                const {expiresAt} = result[0]

                const hashedPasswordResetString = result[0].passwordResetString

                if(expiresAt < Date.now()){
                    //this means the link has expired, so delete the reset record
                    PasswordReset.deleteOne({userId})
                        .then(() => {
                            res.json({
                                status: "FAILED",
                                message: "Password reset link has expired!"
                            })
                        })
                        .catch(error => {
                            console.log(error)
                            res.json({
                                status: "FAILED",
                                message: "Failed to delete expired request link!"
                            })
                        })
                }else {
                    //password reset link has not expired 
                    //so compare the provided reset string with the one stored in the database using bcrypt
                    bcrypt.compare(passwordResetString, hashedPasswordResetString)
                        .then(result => {
                            if(result){
                                //this means that the reset strings matches
                                //therefore hash the new password and store in the database
                                //currently the user can reset their password to weak password. So implement a password complexity checker
                                if(!/^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*])[a-zA-Z0-9!@#$%^&*]{8,30}$/.test(newPassword)){
                                    //the provided new password is week
                                    res.json({
                                        status: "FAILED",
                                        message: "A strong password should be 8 characters long, and contain atleast 1 uppercase and lowercase letter, 1 number and any special character!"
                                    })
                                }else {
                                    //the new password is strong enough
                                const saltRounds = 10;
                                bcrypt.hash(newPassword, saltRounds)
                                    .then(hashedNewPassword => {
                                        //update the user model with the new password
                                        User.updateOne({_id:userId}, {password:hashedNewPassword})
                                            .then(()=> {
                                                //after updating the user's password with the new one, clear the password reset record from the database and inform them of the success
                                                PasswordReset.deleteOne({userId})
                                                    .then(() => {
                                                        //inform the user of a successful password update
                                                        res.json({
                                                            status: "SUCCESS",
                                                            message: "You have successfully set a new password!"
                                                        })
                                                    })
                                                    .catch(error => {
                                                        console.log(error);
                                                        res.json({
                                                            status: "FAILED",
                                                            message: "Failed to remove already updated password reset record!"
                                                        })
                                                    })
                                            })
                                            .catch(error =>{
                                                console.log(error);
                                                res.json({
                                                    status: "FAILED",
                                                    message: "Failed to update new user's password!"
                                                })
                                            })
                                    })
                                    .catch(error => {
                                        console.log(error);
                                        res.json({
                                            status: "FAILED",
                                            message: "New password could not be saved!"
                                        })
                                    })
                                }
                                
                            }else {
                                //the reset strings does not match
                                res.json({
                                    status: "FAILED",
                                    message: "Invalid password reset details!!"
                                })
                            }
                        })
                        .catch(error => {
                            console.log(error);
                            res.json({
                                status: "FAILED",
                                message: "Password reset data comparison failed!"
                            })
                        })
                }
            }else {
                //UserId is not valid
                res.json({
                    status: "FAILED",
                    message: "Password reset request failed! Provide valid data"
                })
            }
        })
        .catch(error =>{
            console.log(error);
            res.json({
                status: "FAILED",
                message: "Invalid reset data entered!"
            })
        })
})
module.exports = passwordResetRouter;