import crypto from 'crypto';

// Secret key for HMAC signing — uses env variable or fallback
const SECRET = process.env.OTP_SECRET || 'dutch-point-hotel-otp-secret-key-2025';

// Strict expiry in seconds
const EXPIRY_SECONDS = 90;

/**
 * Generate HMAC signature for a given employeeId + input
 */
const sign = (employeeId, input) => {
    return crypto
        .createHmac('sha256', SECRET)
        .update(`${employeeId}:${input}`)
        .digest('hex')
        .slice(0, 8); // Shortened to 8 chars for compact QR
};

/**
 * Generate a time-based OTP token for an employee
 * Format: "EMP-001:timestamp:sig"
 */
export const generateToken = (employeeId) => {
    const timestamp = Math.floor(Date.now() / 1000);
    const sig = sign(employeeId, timestamp);
    return `${employeeId}:${timestamp}:${sig}`;
};

/**
 * Verify a scanned OTP token
 * Enforces strict 90-second expiry from generation timestamp
 */
export const verifyToken = (token) => {
    if (!token || typeof token !== 'string') {
        return { valid: false, reason: 'Invalid token format' };
    }

    const parts = token.split(':');

    // Format: "employeeId:timestamp:sig"
    if (parts.length === 3) {
        const employeeId = parts[0];
        const timestamp = parseInt(parts[1]);
        const sig = parts[2];
        
        if (!employeeId || isNaN(timestamp) || !sig) {
            return { valid: false, reason: 'Token parse error' };
        }

        const now = Math.floor(Date.now() / 1000);
        const age = now - timestamp;

        // Strict 90 second expiry check
        if (age < 0) {
            return { valid: false, reason: 'Token is from the future? Check server time.' };
        }
        
        if (age > EXPIRY_SECONDS) {
            return { valid: false, reason: `QR code expired ${age - EXPIRY_SECONDS}s ago. Please refresh.` };
        }

        // Verify HMAC signature against the token's timestamp
        const expectedSig = sign(employeeId, timestamp);
        if (sig !== expectedSig) {
            return { valid: false, reason: 'Invalid QR signature' };
        }

        return { valid: true, employeeId };
    }

    return { valid: false, reason: 'Static QR codes are no longer accepted. Please use the live QR from your employee dashboard.' };
};
