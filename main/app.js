require('log-timestamp');
const Snapshotter = require('./snapshotter.js');
const Controller = require('./controller.js');

const MODE = process.env.MODE;
const MODE_SNAPSHOT = 'snapshot';
const MODE_CONTROLLER = 'controller';

const CHECK_INTERVAL = parseInt(process.env.CHECK_INTERVAL || '120');

if (!MODE || (MODE !== MODE_SNAPSHOT && MODE !== MODE_CONTROLLER)) {
   console.log('env. var. MODE must be one of: '+MODE_SNAPSHOT+', '+MODE_CONTROLLER);
   process.exit(1);
}

if (MODE == MODE_SNAPSHOT) {
   let snapshotter = new Snapshotter();
   snapshotter.createSnapshots();
}

if (MODE == MODE_CONTROLLER) {
   let controller = new Controller();
   setInterval(() => {
      controller.claimSnapshots()
      .then(() => { return controller.backupJobs(); } )
      .then(() => { return controller.cleanup(); } );
   }, CHECK_INTERVAL*1000);
}
