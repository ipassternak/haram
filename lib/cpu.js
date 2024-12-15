'use strict';

const assert = require('node:assert');
const { setTimeout } = require('node:timers/promises');
const { Exception } = require('./exception.js');
const { PageTableEntry, MMU } = require('./mmu.js');
const { Syscall } = require('./syscall.js');
const { rand, roll, choose } = require('./util.js');

class Process {
  pid;
  pageTable;
  #ttl;
  #idleSet;
  #workingSet;
  #workingSetTtl = 0;
  #counter = 0;

  constructor(pid) {
    this.pid = pid;
    this.pageTable = Array.from(
      { 
        length: rand({
          /**
           * Generate a random page table for the process
           */
          min: 32,
          max: 64,
        }),
      },
      () => new PageTableEntry(),
    );
    this.#ttl = rand({
      /**
       * Generate a random time to live for the process
       */
      min: 1024,
      max: 2048,
    });
    this.#rotate();
  }

  #rotate() {
    this.#workingSetTtl += rand({
      /**
       * Generate a random working set time to live
       */
      min: 128,
      max: 256,
    });
    this.#workingSet = [];
    this.#idleSet = [];
    for (let page = 0; page < this.pageTable.length; page++)
      if (roll({
        /**
         * Distribute pages between working set and idle set
         */
        threshold: 0.20,
      })) this.#workingSet.push(page);
      else this.#idleSet.push(page);
  }

  run(kernel) {
    const counter = this.#counter++;
    if (counter >= this.#ttl) {
      kernel.syscall(Syscall.Exit(this.pid));
      return true;
    }
    if (counter >= this.#workingSetTtl)
      this.#rotate();
    const set = roll({
      /**
       * Choose between working set and idle set
       */
      threshold: 0.9,
    }) ? this.#workingSet : this.#idleSet;
    const page = choose(set);
    // Switch to kernel mode
    kernel.syscall(Syscall.AccessMemory(this.pid, page, roll({
      /**
       * Chose memory access mode
       */
      threshold: 0.5,
    })));
    // Switch back to user mode
    // ...
    return false;
  }

  get processStats() {
    const workingSetRation = (this.#workingSet.length / this.pageTable.length) * 100;
    return {
      PID: this.pid,
      TTL: this.#ttl,
      Access: this.#counter,
      'Page Table Size': this.pageTable.length,
      'Working Set Size': this.#workingSet.length,
      'Working Set TTL': this.#workingSetTtl,
      'Working Set Ratio (%)': workingSetRation.toFixed(2),
    };
  }
}

const MAX_PROCESS_COUNT = 25;

class Kernel {
  static #REPLACER = {
    'clock': class ClockReplacer {
      #kernel;
      #hand = 0;

      constructor(kernel) {
        this.#kernel = kernel;
      }
      
      replace() {
        const busyTable = this.#kernel.#mmu.busyTable;
        this.#hand = Math.min(this.#hand, busyTable.length - 1);
        while (true) {
          const fid = busyTable[this.#hand];
          this.#hand = (this.#hand + 1) % busyTable.length;
          const frame = this.#kernel.#mmu.get(fid);
          const process = this.#kernel.#processes.get(frame.pid);
          const pageTable = process.pageTable;
          const pte = pageTable[frame.page];
          if (!pte.referenced) return pte;
          pte.referenced = false;
        }
      }
    },
    'random': class RandomReplacer {
      #kernel

      constructor(kernel) {
        this.#kernel = kernel;
      }

      replace() {
        const busyTable = this.#kernel.#mmu.busyTable;
        const fid = choose(busyTable);
        const frame = this.#kernel.#mmu.get(fid);
        const process = this.#kernel.#processes.get(frame.pid);
        const pageTable = process.pageTable;
        const pte = pageTable[frame.page];
        return pte;
      }
    },
  };

  #replacer;
  #processes = new Map();
  #mmu = new MMU();
  #accessStats = {
    total: 0,
    faults: 0,
    replaced: 0,
  };

  constructor(algo) {
    const Replacer = Kernel.#REPLACER[algo];
    assert(Replacer, `Unknown page replacement algorithm: ${algo}`);
    this.#replacer = new Replacer(this);
    const count = rand({
      /**
       * Generate a random initial process count
       */
      min: 5,
      max: 10,
    });
    this.#spawn(count);
  }

  #spawn(count = 1) {
    for (let i = 0; i < Math.min(count, MAX_PROCESS_COUNT); i++) {
      const pid = rand({
        /**
         * Generate a unique process ID
         */
        min: 1000,
        max: 9999,
        unique: (pid) => this.#processes.has(pid),
      })
      this.#processes.set(pid, new Process(pid));
    }
  }

  async run() {
    let i = 0;
    while (this.#processes.size > 0) {
      i++;
      for (const process of this.#processes.values()) {
        const processTime = rand({
          /**
           * Generate a random process time
           */
          min: 64,
          max: 128,
        });
        for (let i = 0; i < processTime; i++) {
          this.#accessStats.total++;
          const terminated = process.run(this);
          if (terminated) break;
        }
      }
      if (this.#processes.size < MAX_PROCESS_COUNT) {
        if (roll({
          /**
           * Generate a random spawn condition
           */
          threshold: 0.45,
        })) {
          const count = rand({
            /**
             * Generate a random spawn count
             */
            min: 1,
            max: 3,
          });
          this.#spawn(Math.min(count, MAX_PROCESS_COUNT - this.#processes.size));
        }
      }
      this.#printStats();
      await setTimeout(500);
    }
  }

  #printStats() {
    const memoryStats = this.#mmu.getMemoryStats();
    const faultRate = this.#accessStats.faults / this.#accessStats.total * 100;
    const replacedRate = this.#accessStats.replaced / this.#accessStats.faults * 100;
    const accessStats = {
      Total: this.#accessStats.total,
      Faults: this.#accessStats.faults,
      Replaced: this.#accessStats.replaced,
      'Fault Rate (%)': faultRate.toFixed(2),
      'Replacement Rate (%)': replacedRate.toFixed(2),
    };
    const processStats = Array.from(this.#processes.values(), (process) => process.processStats);
    process.stdout.write('\x1Bc');
    console.log('Memory:');
    console.table(memoryStats);
    console.log();
    console.log('Access:');
    console.table(accessStats);
    console.log();
    console.log(`Processes: ${this.#processes.size} / ${MAX_PROCESS_COUNT}`);
    console.table(processStats.slice(0, 20));
  }

  syscall(syscall) {
    try {
      switch(syscall.type) {
        case Syscall.TYPE.EXIT: {
          const { pid } = syscall.args;
          this.#terminateProcess(pid);
          break;
        }
        case Syscall.TYPE.ACCESS_MEMORY: {
          const { pid, page, modify } = syscall.args;
          const process = this.#processes.get(pid);
          const pageTable = process.pageTable;
          this.#mmu.access(pid, pageTable, page, modify);
          break;
        }
      }
    } catch (exception) {
      this.#handleException(exception);
    }
  }

  #terminateProcess(pid) {
    const process = this.#processes.get(pid);
    for (const pte of process.pageTable) {
      if (pte.presented) this.#mmu.free(pte.frame);
    }
    this.#processes.delete(pid);
  }

  #handleException(exception) {
    switch (exception.type) {
      case Exception.TYPE.PAGE_FAULT: {
        const { pid, page } = exception.args;
        this.#handlePageFault(pid, page);
        break;
      }
    }
  }

  #handlePageFault(pid, page) {
    this.#accessStats.faults++;
    const process = this.#processes.get(pid);
    const pageTable = process.pageTable;
    const pte = pageTable[page];
    let fid = this.#mmu.alloc(pid, page);
    if (fid === -1) {
      this.#accessStats.replaced++;
      const victim = this.#replacer.replace();
      this.#mmu.realloc(victim.frame, pid, page);
      fid = victim.frame;
      victim.presented = false;
    }
    pte.presented = true;
    pte.frame = fid;
  }
}

module.exports = {
  Kernel,
};
