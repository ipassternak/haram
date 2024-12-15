'use strict';

const { Kernel } = require('./lib/cpu.js');

const main = () => {
  const algo = process.argv[2] ?? 'clock';
  const kernel = new Kernel(algo);
  kernel.run();
};

main();
