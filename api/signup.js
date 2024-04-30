//import express
const express = require('express');

//import the Usermodel.js file
const User = require('../models/Usermodels');

const bcrypt = require('bcrypt');

//create the signup router
const signupRoute = express.Router();

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
                        dateOfbirth
                    })
                    newUser.save().then(result =>{
                        res.json({
                            status: "SUCCESS",
                            message: "Account creation was Successful"
                        })
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

module.exports = signupRoute