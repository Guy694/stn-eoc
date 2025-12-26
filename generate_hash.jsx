const bcrypt = require('bcryptjs');

// Generate hash for password123
const password = 'password123';
const salt = bcrypt.genSaltSync(10);
const hash = bcrypt.hashSync(password, salt);

console.log('Password:', password);
console.log('Hash:', hash);

// Test verify
const isValid = bcrypt.compareSync(password, hash);
console.log('Verification:', isValid);
