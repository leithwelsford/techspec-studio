/**
 * Encryption utilities for sensitive data (API keys)
 * Uses AES encryption with a device-specific key
 */

import CryptoJS from 'crypto-js';

// Generate a device-specific encryption key based on browser fingerprint
function getDeviceKey(): string {
  const fingerprint = [
    navigator.userAgent,
    navigator.language,
    new Date().getTimezoneOffset(),
    screen.width + 'x' + screen.height,
  ].join('|');

  return CryptoJS.SHA256(fingerprint).toString();
}

/**
 * Encrypt sensitive data (e.g., API keys)
 */
export function encrypt(plaintext: string): string {
  const deviceKey = getDeviceKey();
  return CryptoJS.AES.encrypt(plaintext, deviceKey).toString();
}

/**
 * Decrypt sensitive data
 */
export function decrypt(ciphertext: string): string {
  try {
    const deviceKey = getDeviceKey();
    const bytes = CryptoJS.AES.decrypt(ciphertext, deviceKey);
    return bytes.toString(CryptoJS.enc.Utf8);
  } catch (error) {
    console.error('Decryption failed:', error);
    return '';
  }
}

/**
 * Mask API key for display (show only first 4 and last 4 characters)
 */
export function maskApiKey(apiKey: string): string {
  if (!apiKey || apiKey.length < 12) return '••••••••';
  return `${apiKey.slice(0, 4)}••••${apiKey.slice(-4)}`;
}

/**
 * Validate API key format
 */
export function isValidApiKey(apiKey: string): boolean {
  // OpenRouter keys typically start with 'sk-or-v1-'
  return /^sk-or-v1-[a-zA-Z0-9]{64}$/.test(apiKey) || apiKey.length > 20;
}
