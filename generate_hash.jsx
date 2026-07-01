const bcrypt = require('bcryptjs');

const password = process.env.TEST_PASSWORD || 'change_me';
const salt = bcrypt.genSaltSync(10);
const hash = bcrypt.hashSync(password, salt);

console.log('Password:', password);
console.log('Hash:', hash);

// Test verify
const isValid = bcrypt.compareSync(password, hash);
console.log('Verification:', isValid);
