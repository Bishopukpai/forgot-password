//import express
const express = require('express');

//import the Usermodel.js file
const User = require('../models/Usermodels');

//import the userverification model 
const Userverification = require('./../models/Userverification');

//import nodemailer package to create a transporter for sending email verification messages
const nodemailer = require('nodemailer');

//import uuid
const {v4: uuidv4} = require('uuid')

const bcrypt = require('bcrypt');

//import dotenv package to access the environmental variables
require('dotenv').config();

//import path
const path = require('path');

//create the signup router
const signupRoute = express.Router();

//create the nodemailer transporter 
const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        //this is the email that will be sending the verification email
        user: process.env.AUTH_EMAIL,
        pass: process.env.AUTH_PASS
    }
})

//verify that the transporter is working properly
transporter.verify((error, success) => {
    if(error) {
        //if the transporter is not working, log the error message to the console
        console.log(error)
    }else {
        console.log("Transporter is ready to start messaging");
        console.log(success)
    }
})

signupRoute.post('/signup', (req, res) => {
    //collect user data from the request body.
    let {name, email, username, password, dateOfbirth} = req.body;

    //trim the collected data to remove all white spaces.
    name = name.trim();
    email = email.trim();
    username = username.trim();
    password = password.trim();
    dateOfbirth = dateOfbirth.trim();

    //check if any of the fields are empty and respond with an error.
    if(name == "" || email == "" || username == "" || password == "" || dateOfbirth == ""){
        res.json({
            status: "FAILED",
            message: "All input fields are required! Please make sure you fill in the correct details in all fields."
        })
    }else if(!/^[a-zA-Z ]*$/.test(name)){
        res.json({
            status: "FAILED",
            message: "Your name can only contain letters from A-z"
        })
    }else if(!/^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/.test(email)){
        res.json({
            status: "FAILED",
            message: "Please enter a valid email address!"
        })
    }else if(!/^[a-zA-Z]*$/.test(username)){
        res.json({
            status: "FAILED",
            message: "Your username can only contain letters without white spaces"
        })
    }else if(!/^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*])[a-zA-Z0-9!@#$%^&*]{8,30}$/.test(password)){
        res.json({
            status: "FAILED",
            message: "A strong password should be atleast 8 characters long, with 1 uppercase and lower  case letter a number and any special character"
        })
    }else {
        //if all the fields are correctly filled then you can start the signup process.

        //Check if a user with the provided email address alrready exists
        User.find({email}).then(result => {
            if(result.length){
                res.json({
                    status: "FAILED",
                    message: "A user with the provided email already exists! Please login instead"
                })
            }else {
                //Create an account if the user does not exist, first hash the provided user password
                const saltRounds = 10;
                bcrypt.hash(password, saltRounds).then(hashedPassword => {
                    const newUser = new User({
                        name,
                        email,
                        username,
                        password: hashedPassword,
                        dateOfbirth,
                        //set the verified property to false
                        verified: false
                    })
                    newUser.save().then(result =>{
                        //instead of returning a success message, call the sendVerificationEmail function
                        sendVerificationEmail(result, res)
                    }).catch(err => {
                        res.json({
                            status: "FAILED",
                            message: "Account creation failed"
                        })
                    })
                }).catch(err => {
                    res.json({
                        status: "FAILED",
                        message: "Password could not be hashed!"
                    })
                })
            }
        }).catch(err => {
            console.log(err)
            res.json({
                status: "FAILED",
                message: "An error occured"
            })
        })
    }
})

//create a function that will carry out the process of sending the verificatio email
const sendVerificationEmail = ({_id, email}, res) => {
    //create a url that will be attached to the verification link. Must be the same as the port in which your application is running on
    const currentUrl = "http://localhost:9090/"

    //create a unique String that will differentiate each user
    const uniqueString = uuidv4() + _id// this id will be generated from mongoDB as the user signs up

    const mailOptions = {
        //the email address that will send the verification message
        from: process.env.AUTH_EMAIL,
        //the email address that will recieve the verification message. This will be gotten from the request body when the user signs up
        to: email,
        subject: "Please Verify Your Email",
        //Add a body to your email
        html: `<h2>Welcome</h2><p>Click <a href=${currentUrl + "user/verify/" + _id + "/" + uniqueString}>Here</a>To verify your email address!</p><p>This link <b> expires in 6 Hours </b></p>`
    }

    //hash the unique string to make it secure
    const saltRounds = 10;
    bcrypt.hash(uniqueString, saltRounds)
        .then((hashedUniquestring) => {
            //set a new user verification record with the Userverification model
            const newVerificationRecord = new Userverification({
                userId: _id,
                uniqueString: hashedUniquestring,
                createdAt: Date.now(),
                //add 6 hours to the current time to create the expiresAt property
                expiresAt: Date.now() + 21600000,
            })
            //save the new verification record
            newVerificationRecord.save()
                .then(() => {
                    //after saving the verification record, send the verification email
                    transporter.sendMail(mailOptions)
                        .then(() => {
                            res.json({
                                //SET THE STATUS TO PENDING SINCE THE VERIFICATION MESSAGE WAS JUST SENT, AND YOU ARE STILL WAITING FOR A RESPONSE
                                status: "PENDING",
                                message: "A verification message was sent to the provided email address, check your inbox or spam to get verified!"
                            })
                        })
                        .catch((error) => {
                            res.json({
                                status: "FAILED",
                                message: "Could not send verification email!"
                            })
                        })
                })
                .catch((error) => {
                    console.log(error);
                    res.json({
                        status: "FAILED",
                        message: "Verification record was not saved!"
                    })
                })
        })
        .catch(() => {
            res.json({
                status: "FAILED",
                message: "Failed to hash unique string!"
            })
        })
}

//create a route to confirm account verification
signupRoute.get("/verified", (req, res) => {
    res.sendFile(path.join(__dirname, "./../verified/verified.html"))
})

//create a route for the email verification link
signupRoute.get("/verify/:userId/:uniqueString", (req, res) => {
    let {userId, uniqueString} = req.params;

    //check if the user verification record exist
    Userverification.find({userId})
        .then((result) => {
            if(result.length > 0){
                //verification record exist, so check if the record is still valid
                const {expiresAt} = result[0]

                const hashedUniquestring = result[0].uniqueString

                //compare the value of expiresAt with the current time
                if(expiresAt < Date.now()){
                    //verification record has expired, so delete it
                    Userverification.deleteOne({userId})
                        .then(result => {
                            //after deleting the expired verification record, delete the user associated with the expired record
                            User.deleteOne({_id:userId})
                                .then(() => {
                                    //after deleting user with expired record, let the user know that thier verification record has expired
                                    let message = "Verification link has expired! Please signup to get another one"
                                    res.redirect(`/user/verified/error=true&message=${message}`)
                                })
                                .catch(error => {
                                    let message = "Failed to clear user with expired record!"
                                    res.redirect(`/user/verified/error=true&message=${message}`)
                                })
                        })
                        .catch((error) => {
                            console.log(error)
                            let message = "Failed to clear expired verification record!"
                            res.redirect(`/user/verified/error=true&message=${message}`)
                        })
                }else {
                    //verification record is still valid
                    bcrypt.compare(uniqueString, hashedUniquestring)
                        .then(result => {
                            if(result){
                                //strig matches, so update the user record to show verified
                                User.updateOne({_id:userId}, {verified:true})
                                    .then(() => {
                                        //delete the already updated verification record
                                        Userverification.deleteOne({userId})
                                            .then(() => {
                                                //notify the user of successful verification
                                                res.sendFile(path.join(__dirname, "./../verified/verified.html"))
                                            })
                                            .catch(error => {
                                                let message = "Failed to delete update verification record!"
                                                res.redirect(`/user/verified/error=true&message=${message}`)
                                            })
                                    })
                                    .catch(error => {
                                        console.log(error)
                                        let message = "Failed to update verification status"
                                        res.redirect(`/user/verified/error=true&message=${message}`)
                                    })
                            }else {
                                //string does not match
                                let message = "Invalid verification string!"
                                res.redirect(`/user/verified/error=true&message=${message}`)
                            }
                        })
                        .catch(error => {
                            let message = "Unique strings comparison failed!"
                            res.redirect(`/user/verified/error=true&message=${message}`)
                        })
                }

            }else{
                //verification record does not exist
                let message = "No verification record found!"
                res.redirect(`/user/verified/error=true&message=${message}`)
            }
        })
        .catch((error) => {
            console.log(error)
            let message = "Failed to complete verification record check!"
            res.redirect(`/user/verified/error=true&message=${message}`)
        })
})

module.exports = signupRoute