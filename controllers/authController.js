const { promisify } = require('util');
const jwt = require('jsonwebtoken');
const User = require('../models/userModel');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const sendEmail = require('../utils/email');

const signToken = id => {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
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
    };

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
    };

    if(!token) {
        return next(new AppError('You are not logged in! Please log in to get access.', 401));
    };
    // 2 - VERIFICATE TOKEN
    const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);
    
    // 3 - CHECK IF USER STILL EXISTS 
    const currentUser = await User.findById(decoded.id);
    if(!currentUser) {
        return next(new AppError('The user belonging to this token does no longer exist.', 401));
    };
    // 4 - CHECK IF USER CHANGED PASSWORD AFTER THE TOKEN WAS ISSUED
    if (currentUser.changedPasswordAfter(decoded.iat)) {
        return next(new AppError('User recently changed password! Please log in again.', 401));
    };

    // GRANT ACCESS TO PROTECTED ROUTE
    req.user = currentUser;
    next();
});

exports.restrictTo = (...roles) => {
    return (req, res, next) => {
      // roles ['admin', 'lead-guide']
      if(!roles.includes(req.user.role)) {
        return next(new AppError('You do not have permission to perform this action', 403));
      }
      next();
    };
};

exports.forgotPassword = catchAsync( async(req, res, next) => {
    // 1 - GET USER BASED ON POSTED EMAIL
    const user = await User.findOne({ email: req.body.email });
    if(!user) {
        return next(new AppError('There is no user with email address', 404));
    };
    // 2 - GENERATE THE RANDOM RESET TOKEN
    const resetToken = user.createPasswordResetToken();
    await user.save({ validateBeforeSave: false });

    // 3 - SEND IT TO USER'S EMAIL
    const resetURL = `${req.protocol}://${req.get('host')}/api/v1/users/resetPassword/${resetToken}`;

    const message = `Forgot your password? submit a PATCH request with your new password and passwordConfirm to: ${resetURL}. \nIf you didn't forget your password, please ignore this email!`

    try {
        await sendEmail({
            email: user.email,
            subject: 'Your password reset token (valid for 10 minutes)',
            message
        });
    
        res.status(200).json({
            status: 'success',
            message: 'Token sent to email!'
        });
    } catch (error) {
        user.passwordResetToken = undefined;
        user.passwordResetExpires = undefined;
        await user.save({ validateBeforeSave: false });

        return next(new AppError('There was an error sending the email. Try again later', 500));
    };
    
});

exports.resetPassword = (req, res, next) => {}