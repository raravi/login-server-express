# login-server-lambda

An Express application for the Login Server!

This module gives the Express backend server for the LOGIN functionality. It returns the express application which is set up with the following:

## API endpoints

1. `/login`: For login of users.
2. `/register`: To register new users.
3. `/forgotpassword`: To send a reset mail to the registered email address of the user.
4. `/resetpassword`: To handle reset password functionality.

## CORS

CORS is setup with:
* **Access-Control-Allow-Origin**: Allows `http://localhost:3000` & `process.env.APP_CLIENTURL`.
* **Access-Control-Allow-Methods**: `GET` / `POST` are allowed.
* **Access-Control-Allow-Credentials**: set to `TRUE` (needed for sending `AUTHORIZATION` header).

## Rate Limiter

Rate Limiting of each IP to 100 requests per 15 minutes.

## MongoDB Connection

Connect to MongoDB using Mongoose by specifying the Database in `process.env.APP_DB`.

## Reset Password Mail

The Reset Password API endpoint will send out a mail if the details provided are correct. It uses `process.env.APP_EMAIL`, `process.env.APP_PASSWORD`, `process.env.APP_RESETEMAIL` & `process.env.APP_RESETLINK`.

## Environment Variables expected by the module

These variables should be stored in Environment Variables, and will be accessible to the module in the form `process.env.APP_DB`. Node.js platform will do this by default.

* **APP_DB**: The MongoDB URI used to connect to the DB.
* **APP_SECRETORKEY**: A Secret key for generating random strings to be used as JWTs (JSON Web Tokens).
* **APP_EMAIL**: Email from which you want to send mail.
* **APP_PASSWORD**: Password for the above APP_EMAIL.
* **APP_RESETEMAIL**: The Email that is displayed in the 'From' field in the mail sent.
* **APP_RESETLINK**: Link to reset password. For e.g., https://www.myapp.com/resetpassword
* **APP_CLIENTURL**: The URL of your Client application which will connect to this server. For e.g., https://www.myapp.com

## Usage

For a demo, check out the [repo](https://github.com/raravi/notes-server-lambda) of my Notes App!
