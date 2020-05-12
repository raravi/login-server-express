const Validator = require("validator");
const isEmpty = require("is-empty");

/**
 * Validations for the field(s) in /validateemail API endpoint:
 * 1. validate token
 */
module.exports = function validateValidateEmailInput(data) {
  let errors = {};

  // Convert empty fields to an empty string so we can use validator functions
  data.validatecode = !isEmpty(data.validatecode) ? data.validatecode : "";

  // Validate Code checks
  if (Validator.isEmpty(data.validatecode)) {
    errors.validatecode = "Validation code is required";
  }

  return {
    errors,
    isValid: isEmpty(errors)
  };
};
