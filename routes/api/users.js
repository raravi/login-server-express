const express = require("express");
const router = express.Router();
const { login,
        register,
        forgotPassword,
        resetPassword } = require("./functions");

/**
 * @route POST api/users/register
 * @desc Register user
 * @access Public
 */
router.post("/register", register);

/**
 * @route POST api/users/login
 * @desc Login user and return JWT token
 * @access Public
 */
router.post("/login", login);

/**
 * @route FORGOTPASSWORD api/users/forgotpassword
 * @desc Get valid email from user and send a RESET mail to the registered email.
 * @access Public
 */
router.post("/forgotpassword", forgotPassword);

/**
 * @route RESETPASSWORD api/users/resetpassword
 * @desc Get valid RESET code, new password from user and update the password in DB.
 * @access Public
 */
router.post("/resetpassword", resetPassword);

module.exports = router;
