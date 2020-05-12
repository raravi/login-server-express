if (process.env.ENVIRONMENT != 'PROD') {
  require('dotenv').config();
}
const app = require('../app');
const mongoose = require("mongoose");
const sinon = require('sinon');
const chai = require('chai');
const chaiHttp = require('chai-http');
const bcrypt = require("bcryptjs");
const jwtDecode = require('jwt-decode');
const nodemailer = require("nodemailer");

const expect = chai.expect;
chai.use(chaiHttp);

/**
 * Load User / Session models
 */
const User = require("../models/User");

/**
 * Stubs / Mocks
 */
const mockDateCreated = new Date("2020-03-03T22:39:32.371Z"),
      mockDateExpired = new Date("2020-03-04T22:39:32.371Z"),
      mockDateFuture = new Date("2220-03-26T22:39:32.371Z");

let registerData = {
      api: '/api/users/register',
      json: null,
      success: 'New user registered successfully, please validate your email before trying to login!',
      error: 'There was a problem, please try again!',
      emailError: "The validation email couldn't be sent, please try again!"
    },
    validateEmailData = {
      api: '/api/users/validate',
      json: null,
      resolve: null,
      success: 'Email has been successfully validated!',
      error: "Email couldn't be validated, please try again!",
    },
    loginData = {
      api: '/api/users/login',
      json: null
    },
    forgotPasswordData = {
      api: '/api/users/forgotpassword',
      json: null,
      resolve: {email: "amith.raravi@gmail.com"},
      sendMailResolve: {
        accepted: [ 'amith.raravi@gmail.com' ],
        rejected: [],
        envelopeTime: 218,
        messageTime: 1326,
        messageSize: 722,
        response: '250 2.0.0 OK  1585181557 z16sm901791wrr.56 - gsmtp',
        envelope: { from: 'notes-app@gmail.com', to: [ 'amith.raravi@gmail.com' ] },
        messageId: '<2eb7d96b-e5d9-9b2d-8a3a-1d1bd1301fe6@gmail.com>'
      },
      emailSuccess: 'The reset email has been sent, please check your inbox!',
      emailError: "The reset email couldn't be sent, please try again!"
    },
    resetPasswordData = {
      api: '/api/users/resetpassword',
      json: null,
      resolve: null,
      success: 'Password changed successfully!',
      error: "Password couldn't be changed, please try again!"
    },
    validationData = {
      emailExists: 'Email already exists',
      emailNotFound: 'Email not found',
      emailNotValidated: 'Email not validated yet',
      emailRequired: 'Email field is required',
      emailInvalid: 'Email is invalid',
      nameRequired: 'Name field is required',
      passwordIncorrect: 'Password incorrect',
      passwordRequired: 'Password field is required',
      passwordMinimumLength: 'Password must be at least 6 characters',
      password2Required: 'Confirm password field is required',
      password2Match: 'Passwords must match',
      resetCodeExpired: 'Reset code has expired',
      resetCodeInvalid: 'Reset code is invalid',
      resetCodeRequired: 'Reset code is required',
      validateCodeRequired: 'Validation code is required',
      validateCodeInvalid: 'Validation code is invalid',
    },
    errorData = {
      simpleError: { error: "Error" }
    };

before(function() {
  console.log("  before");
});

after(function() {
  setTimeout(() => {
    mongoose.disconnect();
    console.log("  after: disconnected DB");
  }, 500);
});

/**
 * Tests for the REGISTER endpoint.
 */
describe('POST /register', function() {
  beforeEach(function() {
    registerData.json = {
      "name": "Amith Raravi",
      "email": "amith.raravi1@gmail.com",
      "password": "aQ2aKX8a7rGjiE",
      "password2": "aQ2aKX8a7rGjiE"
    };
  });

  it('success: new user registered successfully', function(done) {
    // Without this stub, mail is sent every time!
    const transporter = sinon.stub(nodemailer, 'createTransport');
    transporter.returns({
      sendMail: (mailOptions) => Promise.resolve(forgotPasswordData.sendMailResolve)
    });

    chai.request(app)
      .post(registerData.api)
      .set('Accept', 'application/json')
      .send(registerData.json)
      .end(function(error, response) {
        expect(error).to.be.null;
        expect(response).to.have.status(200);
        expect(response).to.be.json;
        expect(response.body.createduser).to.equal(registerData.success);
        User.findOneAndRemove({email: 'amith.raravi1@gmail.com'}).then(() => {
          console.log("    User deleted!");
        })
        .catch(err => {
          console.log("    User delete failed!", err);
        });
        nodemailer.createTransport.restore();
        done();
      });
  });

  it('error: email sending failed', function(done) {
    const userSave = sinon.stub(User.prototype, 'save');
    userSave.resolves(forgotPasswordData.resolve);
    // Without this stub, mail is sent every time!
    const transporter = sinon.stub(nodemailer, 'createTransport');
    transporter.returns({
      sendMail: (mailOptions) => Promise.reject({
        error: "Email couldn't be sent"
      })
    });

    chai.request(app)
      .post(registerData.api)
      .set('Accept', 'application/json')
      .send(registerData.json)
      .end(function(error, response) {
        expect(error).to.be.null;
        expect(response).to.have.status(404);
        expect(response).to.be.json;
        expect(response.body.email).to.equal(registerData.emailError);
        nodemailer.createTransport.restore();
        User.prototype.save.restore();
        done();
      });
  });

  it('error: bcrypt hashing error', function(done) {
    const bcryptHash = sinon.stub(bcrypt, 'hash');
    bcryptHash.callsFake((p1, p2, cb) => cb(errorData.simpleError));

    chai.request(app)
      .post(registerData.api)
      .set('Accept', 'application/json')
      .send(registerData.json)
      .end(function(error, response) {
        expect(error).to.be.null;
        expect(response).to.have.status(404);
        expect(response).to.be.json;
        expect(response.body.email).to.equal(registerData.error);
        bcrypt.hash.restore();
        done();
      });
  });

  it('error: User.save error', function(done) {
    const userSave = sinon.stub(User.prototype, 'save');
    userSave.rejects(errorData.simpleError);

    chai.request(app)
      .post(registerData.api)
      .set('Accept', 'application/json')
      .send(registerData.json)
      .end(function(error, response) {
        expect(error).to.be.null;
        expect(response).to.have.status(404);
        expect(response).to.be.json;
        expect(response.body.email).to.equal(registerData.error);
        User.prototype.save.restore();
        done();
      });
  });

  it('error: email already exists', function(done) {
    registerData.json["email"] = "amith.raravi@gmail.com";

    chai.request(app)
      .post(registerData.api)
      .set('Accept', 'application/json')
      .send(registerData.json)
      .end(function(error, response) {
        expect(error).to.be.null;
        expect(response).to.have.status(400);
        expect(response).to.be.json;
        expect(response.body.email).to.equal(validationData.emailExists);
        done();
      });
  });

  it('validation error: name field is required', function(done) {
    registerData.json["name"] = "";

    chai.request(app)
      .post(registerData.api)
      .set('Accept', 'application/json')
      .send(registerData.json)
      .end(function(error, response) {
        expect(error).to.be.null;
        expect(response).to.have.status(400);
        expect(response).to.be.json;
        expect(response.body.name).to.equal(validationData.nameRequired);
        done();
      });
  });

  it('validation error: email field is required', function(done) {
    registerData.json["email"] = "";

    chai.request(app)
      .post(registerData.api)
      .set('Accept', 'application/json')
      .send(registerData.json)
      .end(function(error, response) {
        expect(error).to.be.null;
        expect(response).to.have.status(400);
        expect(response).to.be.json;
        expect(response.body.email).to.equal(validationData.emailRequired);
        done();
      });
  });

  it('validation error: email is invalid', function(done) {
    registerData.json["email"] = "amith.raravi1gmail.com";

    chai.request(app)
      .post(registerData.api)
      .set('Accept', 'application/json')
      .send(registerData.json)
      .end(function(error, response) {
        expect(error).to.be.null;
        expect(response).to.have.status(400);
        expect(response).to.be.json;
        expect(response.body.email).to.equal(validationData.emailInvalid);
        done();
      });
  });

  it('validation error: password field is required', function(done) {
    registerData.json["password"] = "";

    chai.request(app)
      .post(registerData.api)
      .set('Accept', 'application/json')
      .send(registerData.json)
      .end(function(error, response) {
        expect(error).to.be.null;
        expect(response).to.have.status(400);
        expect(response).to.be.json;
        expect(response.body.password).to.equal(validationData.passwordRequired);
        done();
      });
  });

  it('validation error: password must be at least 6 characters', function(done) {
    registerData.json["password"] = "DmN";
    registerData.json["password2"] = "DmN";

    chai.request(app)
      .post(registerData.api)
      .set('Accept', 'application/json')
      .send(registerData.json)
      .end(function(error, response) {
        expect(error).to.be.null;
        expect(response).to.have.status(400);
        expect(response).to.be.json;
        expect(response.body.password).to.equal(validationData.passwordMinimumLength);
        done();
      });
  });

  it('validation error: password2 field is required', function(done) {
    registerData.json["password2"] = "";

    chai.request(app)
      .post(registerData.api)
      .set('Accept', 'application/json')
      .send(registerData.json)
      .end(function(error, response) {
        expect(error).to.be.null;
        expect(response).to.have.status(400);
        expect(response).to.be.json;
        expect(response.body.password2).to.equal(validationData.password2Required);
        done();
      });
  });

  it('validation error: passwords must match', function(done) {
    registerData.json["password2"] = "DmNcMZ";

    chai.request(app)
      .post(registerData.api)
      .set('Accept', 'application/json')
      .send(registerData.json)
      .end(function(error, response) {
        expect(error).to.be.null;
        expect(response).to.have.status(400);
        expect(response).to.be.json;
        expect(response.body.password2).to.equal(validationData.password2Match);
        done();
      });
  });
});

/**
 * Tests for the VALIDATE endpoint.
 */
describe('POST /validate', function() {
  beforeEach(function() {
    validateEmailData.json = {
      "validatecode": "aQ2aKX8a7rGjiE"
    };
    validateEmailData.resolve = {
      _id: '5e5edca43aa9dc587503e1b4',
      name: 'Amith Raravi',
      email: 'amith.raravi@gmail.com',
      password: '$2a$12$.TdDUPO04ICoSdHmVy90x.rBptpYykbAFd4bTqxrEuutJQR2zjV5K',
      date: mockDateCreated,
      __v: 0,
      resetPasswordExpires: mockDateFuture,
      resetPasswordToken: '$2a$12$5z5/4rfoZHi7y4nrtvtHzuWgA8d9UnCLQpydhHLvm3hS.gpo9akkW'
    };
  });

  it('success: Email validated successfully', function(done) {
    let userFindOneResolve = {
      validated: false
    };
    userFindOneResolve.save = () => Promise.resolve(validateEmailData.resolve);
    const userFindOne = sinon.stub(User, 'findOne');
    userFindOne.resolves(userFindOneResolve);

    chai.request(app)
      .post(validateEmailData.api)
      .set('Accept', 'application/json')
      .send(validateEmailData.json)
      .end(function(error, response) {
        expect(error).to.be.null;
        expect(response).to.have.status(200);
        expect(response).to.be.json;
        expect(response.body.success).to.equal(validateEmailData.success);
        User.findOne.restore();
        done();
      });
  });

  it('error: validate code is invalid', function(done) {
    validateEmailData.json.validatecode = "aaaaaaaaaaaaaaaa";

    chai.request(app)
      .post(validateEmailData.api)
      .set('Accept', 'application/json')
      .send(validateEmailData.json)
      .end(function(error, response) {
        expect(error).to.be.null;
        expect(response).to.have.status(404);
        expect(response).to.be.json;
        expect(response.body.validatecode).to.equal(validationData.validateCodeInvalid);
        done();
      });
  });

  it('error: MongoDB Save error', function(done) {
    let userFindOneResolve = {
      validated: false
    };
    userFindOneResolve.save = () => Promise.reject(errorData.simpleError);
    const userFindOne = sinon.stub(User, 'findOne');
    userFindOne.resolves(userFindOneResolve);

    chai.request(app)
      .post(validateEmailData.api)
      .set('Accept', 'application/json')
      .send(validateEmailData.json)
      .end(function(error, response) {
        expect(error).to.be.null;
        expect(response).to.have.status(400);
        expect(response).to.be.json;
        expect(response.body.validatecode).to.equal(validateEmailData.error);
        User.findOne.restore();
        done();
      });
  });

  it('validation error: validate code is empty', function(done) {
    validateEmailData.json.validatecode = "";

    chai.request(app)
      .post(validateEmailData.api)
      .set('Accept', 'application/json')
      .send(validateEmailData.json)
      .end(function(error, response) {
        expect(error).to.be.null;
        expect(response).to.have.status(400);
        expect(response).to.be.json;
        expect(response.body.validatecode).to.equal(validationData.validateCodeRequired);
        done();
      });
  });
});

/**
 * Tests for the LOGIN endpoint.
 */
describe('POST /login', function() {
  beforeEach(function() {
    loginData.json = {
      "email": "amith.raravi@gmail.com",
      "password": "aQ2aKX8a7rGjiE",
    };
  });

  it('success: responds with json', function(done) {
    chai.request(app)
      .post(loginData.api)
      .set('Accept', 'application/json')
      .send(loginData.json)
      .end(function(error, response) {
        expect(error).to.be.null;
        expect(response).to.have.status(200);
        expect(response).to.be.json;

        let token = response.body.token.slice(7);
        let tokenDecoded = jwtDecode(response.body.token);
        expect(response.body.success).to.equal(true);
        expect(tokenDecoded.name).to.equal('Amith Raravi');

        done();
      });
  });

  it('error: email not found', function(done) {
    loginData.json["email"] = "amith.raravi@gmail.co";

    chai.request(app)
      .post(loginData.api)
      .set('Accept', 'application/json')
      .send(loginData.json)
      .end(function(error, response) {
        expect(error).to.be.null;
        expect(response).to.have.status(404);
        expect(response).to.be.json;
        expect(response.body.email).to.equal(validationData.emailNotFound);
        done();
      });
  });

  it('error: user not validated', function(done) {
    let userFindOneResolve = {
      validated: false
    };
    const userFindOne = sinon.stub(User, 'findOne');
    userFindOne.resolves(userFindOneResolve);

    chai.request(app)
      .post(loginData.api)
      .set('Accept', 'application/json')
      .send(loginData.json)
      .end(function(error, response) {
        expect(error).to.be.null;
        expect(response).to.have.status(404);
        expect(response).to.be.json;
        expect(response.body.email).to.equal(validationData.emailNotValidated);
        User.findOne.restore();
        done();
      });
  });

  it('error: password incorrect', function(done) {
    loginData.json["password"] = "DmNcMZKa488WiB";

    chai.request(app)
      .post(loginData.api)
      .set('Accept', 'application/json')
      .send(loginData.json)
      .end(function(error, response) {
        expect(error).to.be.null;
        expect(response).to.have.status(400);
        expect(response).to.be.json;
        expect(response.body.password).to.equal(validationData.passwordIncorrect);
        done();
      });
  });

  it('validation error: email is empty', function(done) {
    loginData.json["email"] = "";

    chai.request(app)
      .post(loginData.api)
      .set('Accept', 'application/json')
      .send(loginData.json)
      .end(function(error, response) {
        expect(error).to.be.null;
        expect(response).to.have.status(400);
        expect(response).to.be.json;
        expect(response.body.email).to.equal(validationData.emailRequired);
        done();
      });
  });

  it('validation error: email is invalid', function(done) {
    loginData.json["email"] = "amith.raravigmail.com";

    chai.request(app)
      .post(loginData.api)
      .set('Accept', 'application/json')
      .send(loginData.json)
      .end(function(error, response) {
        expect(error).to.be.null;
        expect(response).to.have.status(400);
        expect(response).to.be.json;
        expect(response.body.email).to.equal(validationData.emailInvalid);
        done();
      });
  });

  it('validation error: password is empty', function(done) {
    loginData.json["password"] = "";

    chai.request(app)
      .post(loginData.api)
      .set('Accept', 'application/json')
      .send(loginData.json)
      .end(function(error, response) {
        expect(error).to.be.null;
        expect(response).to.have.status(400);
        expect(response).to.be.json;
        expect(response.body.password).to.equal(validationData.passwordRequired);
        done();
      });
  });
});

/**
 * Tests for the FORGOTPASSWORD endpoint.
 */
describe('POST /forgotpassword', function() {
  beforeEach(function() {
    forgotPasswordData.json = {
      "email": "amith.raravi@gmail.com"
    };
  });

  it('success: responds with email', function(done) {
    const userSave = sinon.stub(User.prototype, 'save');
    userSave.resolves(forgotPasswordData.resolve);
    // Without this stub, mail is sent every time!
    const transporter = sinon.stub(nodemailer, 'createTransport');
    transporter.returns({
      sendMail: (mailOptions) => Promise.resolve(forgotPasswordData.sendMailResolve)
    });

    chai.request(app)
      .post(forgotPasswordData.api)
      .set('Accept', 'application/json')
      .send(forgotPasswordData.json)
      .end(function(error, response) {
        expect(error).to.be.null;
        expect(response).to.have.status(200);
        expect(response).to.be.json;
        expect(response.body.emailsent).to.equal(forgotPasswordData.emailSuccess);
        nodemailer.createTransport.restore();
        User.prototype.save.restore();
        done();
      });
  });

  it('error: email sending failed', function(done) {
    const userSave = sinon.stub(User.prototype, 'save');
    userSave.resolves(forgotPasswordData.resolve);
    // Without this stub, mail is sent every time!
    const transporter = sinon.stub(nodemailer, 'createTransport');
    transporter.returns({
      sendMail: (mailOptions) => Promise.reject({
        error: "Email couldn't be sent"
      })
    });

    chai.request(app)
      .post(forgotPasswordData.api)
      .set('Accept', 'application/json')
      .send(forgotPasswordData.json)
      .end(function(error, response) {
        expect(error).to.be.null;
        expect(response).to.have.status(404);
        expect(response).to.be.json;
        expect(response.body.email).to.equal(forgotPasswordData.emailError);
        nodemailer.createTransport.restore();
        User.prototype.save.restore();
        done();
      });
  });

  it('error: bcrypt hashing failed', function(done) {
    const bcryptHash = sinon.stub(bcrypt, 'hash');
    bcryptHash.callsFake((p1, p2, cb) => cb(errorData.simpleError));

    chai.request(app)
      .post(forgotPasswordData.api)
      .set('Accept', 'application/json')
      .send(forgotPasswordData.json)
      .end(function(error, response) {
        expect(error).to.be.null;
        expect(response).to.have.status(404);
        expect(response).to.be.json;
        expect(response.body.email).to.equal(forgotPasswordData.emailError);
        bcrypt.hash.restore();
        done();
      });
  });

  it('error: email not found', function(done) {
    forgotPasswordData.json["email"] = "amith.raravi1@gmail.com";

    chai.request(app)
      .post(forgotPasswordData.api)
      .set('Accept', 'application/json')
      .send(forgotPasswordData.json)
      .end(function(error, response) {
        expect(error).to.be.null;
        expect(response).to.have.status(404);
        expect(response).to.be.json;
        expect(response.body.email).to.equal(validationData.emailNotFound);
        done();
      });
  });

  it('validation error: email field is required', function(done) {
    forgotPasswordData.json["email"] = "";

    chai.request(app)
      .post(forgotPasswordData.api)
      .set('Accept', 'application/json')
      .send(forgotPasswordData.json)
      .end(function(error, response) {
        expect(error).to.be.null;
        expect(response).to.have.status(400);
        expect(response).to.be.json;
        expect(response.body.email).to.equal(validationData.emailRequired);
        done();
      });
  });

  it('validation error: email is invalid', function(done) {
    forgotPasswordData.json["email"] = "amith.raravigmail.com";

    chai.request(app)
      .post(forgotPasswordData.api)
      .set('Accept', 'application/json')
      .send(forgotPasswordData.json)
      .end(function(error, response) {
        expect(error).to.be.null;
        expect(response).to.have.status(400);
        expect(response).to.be.json;
        expect(response.body.email).to.equal(validationData.emailInvalid);
        done();
      });
  });
});

/**
 * Tests for the RESETPASSWORD endpoint.
 */
describe('POST /resetpassword', function() {
  beforeEach(function() {
    resetPasswordData.json = {
      "email": "amith.raravi@gmail.com",
      "resetcode": "e1ca0470bd9c356a7c5ec0e89c246f9b",
      "password": "DmNcMZKa488WiBy",
      "password2": "DmNcMZKa488WiBy"
    };
    resetPasswordData.resolve = {
      _id: '5e5edca43aa9dc587503e1b4',
      name: 'Amith Raravi',
      email: 'amith.raravi@gmail.com',
      password: '$2a$12$.TdDUPO04ICoSdHmVy90x.rBptpYykbAFd4bTqxrEuutJQR2zjV5K',
      date: mockDateCreated,
      __v: 0,
      resetPasswordExpires: mockDateFuture,
      resetPasswordToken: '$2a$12$5z5/4rfoZHi7y4nrtvtHzuWgA8d9UnCLQpydhHLvm3hS.gpo9akkW'
    };
  });

  it('success: password changed successfully', function(done) {
    let userFindOneResolve = Object.assign({}, resetPasswordData.resolve);
    userFindOneResolve.save = () => Promise.resolve(resetPasswordData.resolve);
    const userFindOne = sinon.stub(User, 'findOne');
    userFindOne.resolves(userFindOneResolve);

    chai.request(app)
      .post(resetPasswordData.api)
      .set('Accept', 'application/json')
      .send(resetPasswordData.json)
      .end(function(error, response) {
        expect(error).to.be.null;
        expect(response).to.have.status(200);
        expect(response).to.be.json;
        expect(response.body.success).to.equal(resetPasswordData.success);
        User.findOne.restore();
        done();
      });
  });

  it('error: bcrypt hashing error', function(done) {
    const userFindOne = sinon.stub(User, 'findOne');
    userFindOne.resolves(resetPasswordData.resolve);
    const bcryptCompare = sinon.stub(bcrypt, 'compare');
    bcryptCompare.resolves(true);
    const bcryptHash = sinon.stub(bcrypt, 'hash');
    bcryptHash.callsFake((p1, p2, cb) => cb(errorData.simpleError));

    chai.request(app)
      .post(resetPasswordData.api)
      .set('Accept', 'application/json')
      .send(resetPasswordData.json)
      .end(function(error, response) {
        expect(error).to.be.null;
        expect(response).to.have.status(404);
        expect(response).to.be.json;
        expect(response.body.resetcode).to.equal(resetPasswordData.error);
        bcrypt.hash.restore();
        bcrypt.compare.restore();
        User.findOne.restore();
        done();
      });
  });

  it('error: password saving to DB failed', function(done) {
    resetPasswordData.resolve.save = () => Promise.reject(errorData.simpleError);
    const userFindOne = sinon.stub(User, 'findOne');
    userFindOne.resolves(resetPasswordData.resolve);

    chai.request(app)
      .post(resetPasswordData.api)
      .set('Accept', 'application/json')
      .send(resetPasswordData.json)
      .end(function(error, response) {
        expect(error).to.be.null;
        expect(response).to.have.status(400);
        expect(response).to.be.json;
        expect(response.body.resetcode).to.equal(resetPasswordData.error);
        User.findOne.restore();
        done();
      });
  });

  it('error: email not found', function(done) {
    resetPasswordData.json["email"] = "amith.raravi@gmail.co";

    chai.request(app)
      .post(resetPasswordData.api)
      .set('Accept', 'application/json')
      .send(resetPasswordData.json)
      .end(function(error, response) {
        expect(error).to.be.null;
        expect(response).to.have.status(404);
        expect(response).to.be.json;
        expect(response.body.email).to.equal(validationData.emailNotFound);
        done();
      });
  });

  it('error: reset code has expired', function(done) {
    resetPasswordData.resolve.resetPasswordExpires = mockDateExpired;
    resetPasswordData.resolve.save = () => {};
    const userFindOne = sinon.stub(User, 'findOne');
    userFindOne.resolves(resetPasswordData.resolve);

    chai.request(app)
      .post(resetPasswordData.api)
      .set('Accept', 'application/json')
      .send(resetPasswordData.json)
      .end(function(error, response) {
        expect(error).to.be.null;
        expect(response).to.have.status(400);
        expect(response).to.be.json;
        expect(response.body.resetcode).to.equal(validationData.resetCodeExpired);
        User.findOne.restore();
        done();
      });
  });

  it('error: reset code is invalid', function(done) {
    const userFindOne = sinon.stub(User, 'findOne');
    userFindOne.resolves(resetPasswordData.resolve);
    const bcryptCompare = sinon.stub(bcrypt, 'compare');
    bcryptCompare.resolves(false);
    resetPasswordData.json["resetcode"] = "8c4e65";

    chai.request(app)
      .post(resetPasswordData.api)
      .set('Accept', 'application/json')
      .send(resetPasswordData.json)
      .end(function(error, response) {
        expect(error).to.be.null;
        expect(response).to.have.status(400);
        expect(response).to.be.json;
        expect(response.body.resetcode).to.equal(validationData.resetCodeInvalid);
        User.findOne.restore();
        bcrypt.compare.restore();
        done();
      });
  });

  it('validation error: email field is required', function(done) {
    resetPasswordData.json["email"] = "";

    chai.request(app)
      .post(resetPasswordData.api)
      .set('Accept', 'application/json')
      .send(resetPasswordData.json)
      .end(function(error, response) {
        expect(error).to.be.null;
        expect(response).to.have.status(400);
        expect(response).to.be.json;
        expect(response.body.email).to.equal(validationData.emailRequired);
        done();
      });
  });

  it('validation error: email is invalid', function(done) {
    resetPasswordData.json["email"] = "amith.raravigmail.com";

    chai.request(app)
      .post(resetPasswordData.api)
      .set('Accept', 'application/json')
      .send(resetPasswordData.json)
      .end(function(error, response) {
        expect(error).to.be.null;
        expect(response).to.have.status(400);
        expect(response).to.be.json;
        expect(response.body.email).to.equal(validationData.emailInvalid);
        done();
      });
  });

  it('validation error: reset code is required', function(done) {
    resetPasswordData.json["resetcode"] = "";

    chai.request(app)
      .post(resetPasswordData.api)
      .set('Accept', 'application/json')
      .send(resetPasswordData.json)
      .end(function(error, response) {
        expect(error).to.be.null;
        expect(response).to.have.status(400);
        expect(response).to.be.json;
        expect(response.body.resetcode).to.equal(validationData.resetCodeRequired);
        done();
      });
  });

  it('validation error: password field is required', function(done) {
    resetPasswordData.json["password"] = "";

    chai.request(app)
      .post(resetPasswordData.api)
      .set('Accept', 'application/json')
      .send(resetPasswordData.json)
      .end(function(error, response) {
        expect(error).to.be.null;
        expect(response).to.have.status(400);
        expect(response).to.be.json;
        expect(response.body.password).to.equal(validationData.passwordRequired);
        done();
      });
  });

  it('validation error: password must be at least 6 characters', function(done) {
    resetPasswordData.json["password"] = "Dm";

    chai.request(app)
      .post(resetPasswordData.api)
      .set('Accept', 'application/json')
      .send(resetPasswordData.json)
      .end(function(error, response) {
        expect(error).to.be.null;
        expect(response).to.have.status(400);
        expect(response).to.be.json;
        expect(response.body.password).to.equal(validationData.passwordMinimumLength);
        done();
      });
  });

  it('validation error: confirm password field is required', function(done) {
    resetPasswordData.json["password2"] = "";

    chai.request(app)
      .post(resetPasswordData.api)
      .set('Accept', 'application/json')
      .send(resetPasswordData.json)
      .end(function(error, response) {
        expect(error).to.be.null;
        expect(response).to.have.status(400);
        expect(response).to.be.json;
        expect(response.body.password2).to.equal(validationData.password2Required);
        done();
      });
  });

  it('validation error: passwords must match', function(done) {
    resetPasswordData.json["password"] = "DmN";

    chai.request(app)
      .post(resetPasswordData.api)
      .set('Accept', 'application/json')
      .send(resetPasswordData.json)
      .end(function(error, response) {
        expect(error).to.be.null;
        expect(response).to.have.status(400);
        expect(response).to.be.json;
        expect(response.body.password2).to.equal(validationData.password2Match);
        done();
      });
  });
});
