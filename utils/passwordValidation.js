// utils/passwordValidation.js
/**
 * Password validation utility for Charitrace platform
 * Validates password strength according to security requirements
 */

/**
 * Validates password strength
 * @param {string} password - The password to validate
 * @returns {Object} - Validation result with success status and details
 */
export const validatePassword = (password) => {
  const errors = [];
  const requirements = {
    minLength: false,
    hasUppercase: false,
    hasLowercase: false,
    hasNumber: false,
    hasSpecialChar: false
  };

  // Check minimum length (at least 8 characters)
  if (!password || password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  } else {
    requirements.minLength = true;
  }

  // Check for uppercase letter
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must include at least one uppercase letter');
  } else {
    requirements.hasUppercase = true;
  }

  // Check for lowercase letter
  if (!/[a-z]/.test(password)) {
    errors.push('Password must include at least one lowercase letter');
  } else {
    requirements.hasLowercase = true;
  }

  // Check for number
  if (!/\d/.test(password)) {
    errors.push('Password must include at least one number');
  } else {
    requirements.hasNumber = true;
  }

  // Check for special character
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(password)) {
    errors.push('Password must include at least one special character (!@#$%^&*()_+-=[]{};\':"\\|,.<>/?~`)');
  } else {
    requirements.hasSpecialChar = true;
  }

  const isValid = errors.length === 0;

  return {
    isValid,
    errors,
    requirements,
    strength: calculatePasswordStrength(requirements)
  };
};

/**
 * Calculates password strength based on requirements met
 * @param {Object} requirements - Object containing boolean values for each requirement
 * @returns {string} - Password strength level
 */
const calculatePasswordStrength = (requirements) => {
  const metRequirements = Object.values(requirements).filter(Boolean).length;
  
  switch (metRequirements) {
    case 0:
    case 1:
      return 'Very Weak';
    case 2:
      return 'Weak';
    case 3:
      return 'Fair';
    case 4:
      return 'Good';
    case 5:
      return 'Strong';
    default:
      return 'Very Weak';
  }
};

/**
 * Middleware function to validate password in request body
 * @param {string} passwordField - The field name containing the password (default: 'password')
 * @returns {Function} - Express middleware function
 */
export const passwordValidationMiddleware = (passwordField = 'password') => {
  return (req, res, next) => {
    const password = req.body[passwordField];
    
    if (!password) {
      return res.status(400).json({
        success: false,
        message: `${passwordField} is required`,
        field: passwordField
      });
    }

    const validation = validatePassword(password);
    
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        message: 'Password does not meet security requirements',
        field: passwordField,
        errors: validation.errors,
        requirements: validation.requirements,
        strength: validation.strength
      });
    }

    // Password is valid, continue to next middleware
    next();
  };
};

/**
 * Validates both current and new password for password change operations
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
export const changePasswordValidationMiddleware = (req, res, next) => {
  const { currentPassword, newPassword, confirmPassword } = req.body;

  // Check if all required fields are present
  if (!currentPassword || !newPassword || !confirmPassword) {
    return res.status(400).json({
      success: false,
      message: 'Current password, new password, and password confirmation are required',
      errors: {
        currentPassword: !currentPassword ? 'Current password is required' : null,
        newPassword: !newPassword ? 'New password is required' : null,
        confirmPassword: !confirmPassword ? 'Password confirmation is required' : null
      }
    });
  }

  // Check if new password and confirmation match
  if (newPassword !== confirmPassword) {
    return res.status(400).json({
      success: false,
      message: 'New password and confirmation do not match',
      field: 'confirmPassword'
    });
  }

  // Check if new password is different from current password
  if (currentPassword === newPassword) {
    return res.status(400).json({
      success: false,
      message: 'New password must be different from current password',
      field: 'newPassword'
    });
  }

  // Validate new password strength
  const validation = validatePassword(newPassword);
  
  if (!validation.isValid) {
    return res.status(400).json({
      success: false,
      message: 'New password does not meet security requirements',
      field: 'newPassword',
      errors: validation.errors,
      requirements: validation.requirements,
      strength: validation.strength
    });
  }

  // All validations passed
  next();
};

/**
 * Get password requirements for frontend display
 * @returns {Object} - Password requirements object
 */
export const getPasswordRequirements = () => {
  return {
    minLength: 8,
    requireUppercase: true,
    requireLowercase: true,
    requireNumber: true,
    requireSpecialChar: true,
    allowedSpecialChars: '!@#$%^&*()_+-=[]{};\':"\\|,.<>/?~`',
    description: [
      'At least 8 characters long',
      'Include uppercase and lowercase letters',
      'Include at least one number',
      'Include at least one special character'
    ]
  };
};

export default {
  validatePassword,
  passwordValidationMiddleware,
  changePasswordValidationMiddleware,
  getPasswordRequirements
};