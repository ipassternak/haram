'use strict';

class Exception extends Error {
  static TYPE = {
    PAGE_FAULT: 0,
  };

  name = 'Exception';
  
  constructor(type, args) {
    super('Unhandled exception');
    this.type = type;
    this.args = args;
  }

  /**
   * Creates a new exception instance for a page fault.
   *
   * @param {number} pid - The process ID of the target process.
   * @param {number} page - The memory page that caused the fault.
   * @returns {Exception} Page fault exception instance.
   */
  static PageFault(pid, page) {
    return new Exception(Exception.TYPE.PAGE_FAULT, {
      pid,
      page,
    });
  }
}

module.exports = {
  Exception,
};
