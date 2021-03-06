const crypto = require('crypto');
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");

// Config from Environment variables
let keys = {};
keys.secretOrKey = process.env.APP_SECRETORKEY;
keys.email = process.env.APP_EMAIL;
keys.password = process.env.APP_PASSWORD;
keys.resetEmail = process.env.APP_RESETEMAIL;
keys.resetLink = process.env.APP_RESETLINK;
keys.validateLink = process.env.APP_VALIDATELINK;

/**
 * Load input validation
 */
const validateRegisterInput = require("../../validation/register");
const validateValidateEmailInput = require("../../validation/validateemail");
const validateLoginInput = require("../../validation/login");
const validateForgotPasswordInput = require("../../validation/forgotpassword");
const validateResetPasswordInput = require("../../validation/resetpassword");

/**
 * Load User model
 */
const User = require("../../models/User");

/**
 * This function handles registering of new users.
 * Checks if all the details are correct, then writes it
 * to the DB and responds to the user. If the details are
 * wrong, throws relevant errors.
 */
const register = (req, res) => {
  // Form validation
  const { errors, isValid } = validateRegisterInput(req.body);
  // Check validation
  if (!isValid) {
    return res.status(400).json(errors);
  }
  User.findOne({ email: req.body.email }).then(user => {
    if (user) {
      return res.status(400).json({ email: "Email already exists" });
    } else {
      const newUser = new User({
        name: req.body.name,
        email: req.body.email,
        password: req.body.password,
        validated: false
      });
      // Hash password before saving in database
      // The top result on Google, the tutorial from scotch.io, also uses bcrypt with a lesser cost factor of 8. Both of these are small, but 8 is really small. Most bcrypt libraries these days use 12. The cost factor of 8 was for administrator accounts eighteen years ago when the original bcrypt paper was released.
      bcrypt.genSalt(12, (err, salt) => {
        bcrypt.hash(newUser.password, salt, (err, hash) => {
          if (err) {
            console.error('bcrypt hashing error: ', err);
            return res.status(404).json({email: "There was a problem, please try again!"});
          }
          // TODO: If your web site supports email/password account creation, always validate that email address before sending further email correspondence (or God forbid, sharing your customer list.) Nobody likes being the target of trolls or bots that sign up your email address to hundreds of web sites that then proceed to send newsletters every day. Always have a validation process for email addresses. It seems like this should go without saying, but so many sites still don't do this.
          newUser.password = hash;
          newUser
            .save()
            .then(user => {
              // Generate random string
              const randomString = crypto.randomBytes(16).toString('hex');

              const transporter = nodemailer.createTransport({
                service: 'gmail',
                auth: {
                  user: keys.email,
                  pass: keys.password,
                },
              });

              const mailOptions = {
                from: '${keys.resetEmail}',
                to: `${user.email}`,
                subject: 'Email Validation is Required',
                text:
                  'You are receiving this because you (or someone else) have recently created your account.\n\n'
                  + 'Please click on the following link, or paste this into your browser to complete the registration process:\n\n'
                  + `${keys.validateLink}\n\n`
                  + `Validation Code: ${randomString}\n\n`
                  + 'If you did not request this, please ignore this email and no action will be taken.\n',
              };

              // Send mail
              transporter.sendMail(mailOptions)
                .then(response => {
                  console.log('sendMail success: ', response);
                  res.json({createduser: "New user registered successfully, please validate your email before trying to login!"})
                })
                .catch(err => {
                  console.error('sendMail error: ', err);
                  res.status(404).json({email: "The validation email couldn't be sent, please try again!"});
                });
            })
            .catch(err => {
              console.log('MongoDB new user save error: ', err);
              res.status(404).json({email: "There was a problem, please try again!"});
            });
        });
      });
    }
  });
};

/**
 * This function handles "Validate Email" functionality of the user.
 * Checks if the details provided are correct, then validates the email
 * of the user. If the details are wrong, throws relevant errors.
 */
const validate = (req, res) => {
  // Form validation
  const { errors, isValid } = validateValidateEmailInput(req.body);
  // Check validation
  if (!isValid) {
    return res.status(400).json(errors);
  }
  const validateCode = req.body.validatecode;
  // Find user by email
  User.findOne({ validateEmailToken: validateCode }).then(user => {
    // Check if user exists
    if (!user) {
      return res.status(404).json({ validatecode: "Validation code is invalid" });
    }

    user.validated = true;
    user.validateEmailToken = undefined;

    // save the user to DB
    user.save()
      .then(user => {
        return res.json({success: "Email has been successfully validated!"});
      })
      .catch(err => {
        console.log("MongoDB save error: ", err);
        return res.status(400).json({validatecode: "Email couldn't be validated, please try again!"});
      });
  });
};

/**
 * This function handles login of the user. Checks if all the
 * details are correct, then responds to the user with a token.
 * If the details are wrong, throws relevant errors.
 */
const login = (req, res) => {
  // Form validation
  const { errors, isValid } = validateLoginInput(req.body);
  // Check validation
  if (!isValid) {
    return res.status(400).json(errors);
  }
  const email = req.body.email;
  const password = req.body.password;
  // Find user by email
  User.findOne({ email }).then(user => {
    // Check if user exists
    if (!user) {
      return res.status(404).json({ email: "Email not found" });
    }
    if (user.validated === false) {
      return res.status(404).json({ email: "Email not validated yet" });
    }
    // Check password
    bcrypt.compare(password, user.password).then(isMatch => {
      if (isMatch) {
        // User matched
        // Create JWT Payload
        const payload = {
          id: user.id,
          name: user.name
        };
        // Sign token
        // JWT is not encrypted!
        jwt.sign(
          payload,
          keys.secretOrKey,
          {
            expiresIn: 31556926 // 1 year in seconds
          },
          (err, token) => {
            res.json({
              success: true,
              token: "Bearer " + token
            });
          }
        );
      } else {
        return res
          .status(400)
          .json({ password: "Password incorrect" });
      }
    });
  });
};

/**
 * This function handles "Forgot Password" of the user. Checks if the
 * email address is correct, then sends an email to the user with a token.
 * If the details are wrong, throws relevant errors.
 */
const forgotPassword = (req, res) => {
  // Form validation
  const { errors, isValid } = validateForgotPasswordInput(req.body);
  // Check validation
  if (!isValid) {
    return res.status(400).json(errors);
  }
  const email = req.body.email;
  // Find user by email
  User.findOne({ email }).then(user => {
    // Check if user exists
    if (!user) {
      return res.status(404).json({ email: "Email not found" });
    }

    // Generate random string
    const randomString = crypto.randomBytes(16).toString('hex');
    user.resetPasswordToken = randomString.toString();
    user.resetPasswordExpires = new Date(Date.now() + 3600000);

    // hash the Reset token
    bcrypt.genSalt(12, (err, salt) => {
      bcrypt.hash(user.resetPasswordToken, salt, (err, hash) => {
        if (err) {
          console.error('bcrypt hashing error: ', err);
          return res.status(404).json({email: "The reset email couldn't be sent, please try again!"});
        }
        user.resetPasswordToken = hash;

        // Save the user to DB
        user.save().then((user) => {
          const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
              user: keys.email,
              pass: keys.password,
            },
          });

          const mailOptions = {
            from: '${keys.resetEmail}',
            to: `${user.email}`,
            subject: 'Link To Reset Password',
            text:
              'You are receiving this because you (or someone else) have requested the reset of the password for your account.\n\n'
              + 'Please click on the following link, or paste this into your browser to complete the process within one hour of receiving it:\n\n'
              + `${keys.resetLink}\n\n`
              + `Reset Code: ${randomString}\n\n`
              + 'If you did not request this, please ignore this email and your password will remain unchanged.\n',
          };

          // Send mail
          transporter.sendMail(mailOptions)
            .then(response => {
              console.log('sendMail success: ', response);
              res.status(200).json({emailsent: 'The reset email has been sent, please check your inbox!'});
            })
            .catch(err => {
              console.error('sendMail error: ', err);
              res.status(404).json({email: "The reset email couldn't be sent, please try again!"});
            });
        });
      });
    });
  });
};

/**
 * This function handles "Reset Password" of the user. Checks if the
 * details provided are correct, then resets the password of the user.
 * If the details are wrong, throws relevant errors.
 */
const resetPassword = (req, res) => {
  // Form validation
  const { errors, isValid } = validateResetPasswordInput(req.body);
  // Check validation
  if (!isValid) {
    return res.status(400).json(errors);
  }
  const email = req.body.email;
  const resetCode = req.body.resetcode;
  const newPassword = req.body.password;
  // Find user by email
  User.findOne({ email: email }).then(user => {
    // Check if user exists
    if (!user) {
      return res.status(404).json({ email: "Email not found" });
    }

    // Check RESET code
    bcrypt.compare(resetCode, user.resetPasswordToken).then(isMatch => {
      if (isMatch) {
        // Token matched
        if (user.resetPasswordExpires < Date.now()) {
          user.resetPasswordToken = undefined;
          user.resetPasswordExpires = undefined;
          user.save();

          return res.status(400).json({ resetcode: "Reset code has expired" });
        }

        // hash the new password
        bcrypt.genSalt(12, (err, salt) => {
          bcrypt.hash(newPassword, salt, (err, hash) => {
            if (err) {
              console.error("bcrypt hashing error: ", err);
              return res.status(404).json({resetcode: "Password couldn't be changed, please try again!"});
            }
            user.password = hash;
            user.resetPasswordToken = undefined;
            user.resetPasswordExpires = undefined;

            // save the user to DB
            user.save()
              .then(user => {
                return res.json({success: "Password changed successfully!"});
              })
              .catch(err => {
                console.log("MongoDB save password error: ", err);
                return res.status(400).json({resetcode: "Password couldn't be changed, please try again!"});
              });
          });
        });
      } else {
        return res
          .status(400)
          .json({ resetcode: "Reset code is invalid" });
      }
    });

  });
};

module.exports = {  login,
                    register,
                    validate,
                    forgotPassword,
                    resetPassword };
