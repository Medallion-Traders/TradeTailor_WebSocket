module.exports = {
  preset: "@shelf/jest-mongodb",
  transform: {
    '^.+\\.[t|j]sx?$': 'babel-jest',
  },
  transformIgnorePatterns: ['node_modules/?!(babel-jest)'],
};
