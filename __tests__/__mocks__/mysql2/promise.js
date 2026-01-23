// Mock mysql2/promise module for testing
const mockPool = {
    getConnection: jest.fn(() => Promise.resolve({
        execute: jest.fn(),
        release: jest.fn(),
        beginTransaction: jest.fn(),
        commit: jest.fn(),
        rollback: jest.fn()
    })),
    execute: jest.fn()
};

const mysql = {
    createPool: jest.fn(() => mockPool),
    createConnection: jest.fn()
};

module.exports = mysql;
module.exports.mockPool = mockPool;
