const jwt = require('jsonwebtoken');
const User = require('../models/userModel');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');

const signToken = id => {
    jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRES_IN
    });
}

exports.signup = catchAsync(async (req, res, next) => {
    const newUser = await User.create({
        name: req.body.name,
        email: req.body.email,
        password: req.body.password,
        passwordConfirm: req.body.passwordConfirm
    });

    const token = signToken(newUser._id);

    res.status(201).json({
        status: 'success',
        token,
        data: {
            user: newUser
        }
    });
});

exports.login = catchAsync(async (req,res, next) => {
    const { email, password } = req.body;

    // 1- CHECK IF EMAIL AND PASSWORD EXIST
    if(!email || !password) {
       return next(new AppError('Please provide email and password!', 400));
    }
    // 2- CHECK IF USER EXISTS && PASSWORD IS CORRECT
    const user = await User.findOne({ email }).select('+password');
    
    if(!user || !(await user.correctPassword(password, user.password))) {
        return next(new AppError('Incorrect email or password', 401));
    }

    // 3 - IF EVERYTHING IS OK, SEND TOKEN TO CLIENT
    const token = signToken(user._id);
    res.status(200).json({
        status: 'success',
        token
    });
});

exports.protect = catchAsync(async (req, res, next) => {
    // 1 - GETTING TOKEN AND CHECK OF IT'S THERE
    let token;
    if(req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
    }

    if(!token) {
        return next(new AppError('You are not logged in! Please log in to get access.', 401));
    };
    // 2 - VERIFICATE TOKEN

    // 3 - CHECK IF USER STILL EXISTS 

    // 4 - CHECK IF USER CHANGED PASSWORD AFTER THE TOKEN WAS ISSUED


    next();
});