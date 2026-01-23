// Add custom jest matchers from jest-dom
import '@testing-library/jest-dom'

// Mock environment variables for tests
process.env.SECRET_KEY = 'test_secret_key_for_testing'
process.env.DB_HOST = 'localhost'
process.env.DB_USER = 'test_user'
process.env.DB_PASSWORD = 'test_password'
process.env.DB_NAME = 'test_db'
