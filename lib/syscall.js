'use strict';

class Syscall {
  static TYPE = {
    ACCESS_MEMORY: 0,
    EXIT: 1,
  };

  constructor(type, args) {
    this.type = type;
    this.args = args;
  }
  
  /**
   * Creates a new syscall instance for accessing memory.
   *
   * @param {number} pid - The process ID of the target process.
   * @param {number} page - The memory page to be accessed.
   * @param {boolean} modify - Whether the memory page should be modified.
   * @returns {Syscall} Access memory syscall instance.
   */
  static AccessMemory(pid, page, modify) {
    return new Syscall(Syscall.TYPE.ACCESS_MEMORY, {
      pid,
      page,
      modify,
    });
  }

  /**
   * Creates a new Syscall instance for exiting a process.
   *
   * @param {number} pid - The process ID of the process to exit.
   * @returns {Syscall} Exit syscall instance.
   */
  static Exit(pid) {
    return new Syscall(Syscall.TYPE.EXIT, {
      pid,
    });
  }
}

module.exports = {
  Syscall,
};
