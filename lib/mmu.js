'use strict';

const { Exception } = require('./exception.js');
const { rand } = require('./util.js');

class PageTableEntry {
  constructor() {
    this.presented = false;
    this.referenced = false;
    this.modified = false;
    this.fid = 0;
  }
}

class Frame {
  constructor(fid) {
    this.fid = fid;
    this.busy = false;
    this.pid = 0;
    this.page = 0;
  }
}

class MMU {
  #frameTable;
  #busyTable;
  #freeTable;

  get busyTable() {
    return [...this.#busyTable];
  }

  get freeTable() {
    return [...this.#freeTable];
  }

  constructor() {
    this.#frameTable = Array.from(
      { 
        length: rand({
          /**
           * Generate a random frame table
           */
          min: 512,
          max: 1024,
        }),
      },
      (_, fid) => new Frame(fid),
    );
    this.#busyTable = new Set();
    this.#freeTable = [...this.#frameTable.keys()];
  }

  get(fid) {
    return this.#frameTable[fid];
  }

  alloc(pid, page) {
    if (this.#freeTable.length === 0) return -1;
    const fid = this.#freeTable.pop();
    const frame = this.get(fid);
    frame.busy = true;
    frame.pid = pid;
    frame.page = page;
    this.#busyTable.add(fid);
    return fid;
  }

  free(fid) {
    if (!this.#busyTable.has(fid)) return false;
    const frame = this.get(fid);
    frame.busy = false;
    frame.pid = 0;
    frame.page = 0;
    this.#busyTable.delete(fid);
    this.#freeTable.push(fid);
    return true;
  }

  realloc(fid, pid, page) {
    const frame = this.get(fid);
    frame.busy = true;
    frame.pid = pid;
    frame.page = page;
    return true;
  }

  access(pid, pageTable, page, modify) {
    const pte = pageTable[page];
    if (!pte.presented) throw Exception.PageFault(pid, page);
    pte.referenced = true;
    if (modify) pte.modified = true;
  }

  getMemoryStats() {
    const total = this.#frameTable.length;
    const free = this.#freeTable.length;
    const busy = this.#busyTable.size;
    const load = (busy / total) * 100;
    return {
      Total: total,
      Busy: busy,
      Free: free,
      'Load (%)': load.toFixed(2),
    };
  }
} 

module.exports = {
  PageTableEntry,
  MMU,
};
