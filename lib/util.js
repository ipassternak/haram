'use strict';

/**
 * Generates a random number within a specified range and ensures it meets a unique condition.
 *
 * @param {Object} options - The options object.
 * @param {number} [options.min=0] - The minimum value of the range (inclusive).
 * @param {number} options.max - The maximum value of the range (inclusive).
 * @param {Function} [options.unique=Function] - A function to test the uniqueness of the generated number.
 * @returns {number} A random number within the specified range that satisfies the unique condition.
 */
const rand = ({ min = 0, max, unique }) => {
  let num = 0;
  do {
    num = Math.floor(Math.random() * (max - min + 1)) + min;
  } while (unique && unique(num));
  return num;
};

/**
 * Determines if a random number is less than the given threshold value.
 *
 * @param {Object} options - The options object.
 * @param {number} options.threshold - A threshold value between 0 and 1.
 * @returns {boolean} Returns true if a random number is less than the test value, otherwise false.
 */
const roll = ({ threshold }) => Math.random() < threshold;

/**
 * Chooses a random element from an array.
 *
 * @param {Array} arr - The array to choose from.
 * @returns {*} A random element from the array.
 */
const choose = (arr) => arr[Math.floor(Math.random() * arr.length)];

module.exports = {
  rand,
  roll,
  choose,
};
